import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import express from "express";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, readFile, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pipeline } from "node:stream/promises";

const PORT = Number(process.env.PORT ?? 8080);
const WORKER_SECRET = process.env.WORKER_SECRET;
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const DEFAULT_ORIGINAL_BUCKET = process.env.ORIGINAL_VIDEO_BUCKET ?? "loco-video-originals";
const DEFAULT_VIDEO_BUCKET = process.env.PROCESSED_VIDEO_BUCKET ?? "loco-videos";
const DEFAULT_THUMBNAIL_BUCKET = process.env.VIDEO_THUMBNAIL_BUCKET ?? "loco-video-thumbnails";
const FFMPEG_TIMEOUT_MS = Number(process.env.FFMPEG_TIMEOUT_MS ?? 120000);
const DOWNLOAD_TIMEOUT_MS = Number(process.env.STORAGE_DOWNLOAD_TIMEOUT_MS ?? 60000);

if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
  throw new Error("R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY are required.");
}

if (!WORKER_SECRET) {
  throw new Error("WORKER_SECRET is required.");
}

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

const app = express();
app.use(express.json({ limit: "1mb" }));

function requireWorkerSecret(req, res, next) {
  const headerSecret = req.get("x-worker-secret");
  const bearerSecret = req.get("authorization")?.replace(/^Bearer\s+/i, "");

  if (headerSecret === WORKER_SECRET || bearerSecret === WORKER_SECRET) {
    next();
    return;
  }

  res.status(401).json({ error: "Unauthorized" });
}

function run(command, args, options = {}) {
  const timeoutMs = options.timeoutMs ?? FFMPEG_TIMEOUT_MS;
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill("SIGKILL");
      reject(new Error(`${command} timed out after ${Math.round(timeoutMs / 1000)}s`));
    }, timeoutMs);

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    });

    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);

      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} exited with ${code}: ${stderr.slice(-3000)}`));
    });
  });
}

async function ffprobe(filePath) {
  return new Promise((resolve) => {
    const child = spawn("ffprobe", [
      "-v",
      "error",
      "-select_streams",
      "v:0",
      "-show_entries",
      "stream=width,height,duration",
      "-of",
      "json",
      filePath,
    ]);
    let output = "";

    child.stdout.on("data", (chunk) => {
      output += chunk.toString();
    });

    child.on("close", () => {
      try {
        const parsed = JSON.parse(output);
        const stream = parsed.streams?.[0] ?? {};
        resolve({
          width: Number(stream.width) || null,
          height: Number(stream.height) || null,
          duration: Number(stream.duration) || null,
        });
      } catch {
        resolve({ width: null, height: null, duration: null });
      }
    });
  });
}

function buildOutputPath(originalPath, suffix) {
  const parsed = path.posix.parse(originalPath);
  return path.posix.join(parsed.dir, `${parsed.name}${suffix}`);
}

async function downloadFromR2(bucket, objectPath, destination) {
  console.log(`[video-worker] downloading ${bucket}/${objectPath}`);
  const url = await getSignedUrl(r2, new GetObjectCommand({ Bucket: bucket, Key: objectPath }), { expiresIn: 300 });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);

  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`download failed with ${res.status}`);

    await pipeline(res.body, createWriteStream(destination));
    console.log(`[video-worker] downloaded to ${destination}`);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(`download timed out after ${Math.round(DOWNLOAD_TIMEOUT_MS / 1000)}s`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function uploadToR2(bucket, objectPath, filePath, contentType) {
  const buffer = await readFile(filePath);
  console.log(`[video-worker] uploading ${bucket}/${objectPath} (${buffer.length} bytes)`);

  await r2.send(new PutObjectCommand({
    Bucket: bucket,
    Key: objectPath,
    Body: buffer,
    ContentType: contentType,
    CacheControl: "public, max-age=31536000",
  }));

  const PUBLIC_URLS = {
    "loco-videos": "https://pub-6158801308ca41479e54f41bbfe0cebe.r2.dev",
    "loco-video-thumbnails": "https://pub-acaa222bd90b4d50988570f0818fb4a9.r2.dev",
  };
  const baseUrl = PUBLIC_URLS[bucket];
  if (!baseUrl) throw new Error(`No public URL for bucket: ${bucket}`);
  return `${baseUrl}/${objectPath}`;
}

async function removeFromR2(bucket, objectPath) {
  try {
    await r2.send(new DeleteObjectCommand({ Bucket: bucket, Key: objectPath }));
  } catch (error) {
    console.error("[video-worker] failed to remove from R2", error);
  }
}

async function processVideoTask({
  messageId,
  originalBucket,
  originalPath,
  videoBucket,
  thumbnailBucket,
  supabaseUrl,
  supabaseKey,
}) {
  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

  const workDir = path.join(os.tmpdir(), `loco-video-${randomUUID()}`);
  const inputPath = path.join(workDir, "original");
  const outputPath = path.join(workDir, "processed.mp4");
  const thumbnailPath = path.join(workDir, "thumbnail.jpg");
  const videoPath = buildOutputPath(originalPath, "_720p.mp4");
  const thumbPath = buildOutputPath(originalPath, "_thumb.jpg");
  let originalDownloaded = false;
  const startedAt = Date.now();

  try {
    await mkdir(workDir, { recursive: true });
    await downloadFromR2(originalBucket, originalPath, inputPath);
    originalDownloaded = true;

    console.log(`[video-worker] ffmpeg transcode start message=${messageId}`);
    await run("ffmpeg", [
      "-y",
      "-i",
      inputPath,
      "-map",
      "0:v:0",
      "-map",
      "0:a?",
      "-vf",
      "scale=-2:720,fps=30",
      "-c:v",
      "libx264",
      "-preset",
      "medium",
      "-profile:v",
      "main",
      "-b:v",
      "900k",
      "-maxrate",
      "1200k",
      "-bufsize",
      "1800k",
      "-movflags",
      "+faststart",
      "-c:a",
      "aac",
      "-b:a",
      "96k",
      "-ac",
      "2",
      outputPath,
    ]);
    console.log(`[video-worker] ffmpeg transcode done message=${messageId}`);

    console.log(`[video-worker] thumbnail start message=${messageId}`);
    await run("ffmpeg", [
      "-y",
      "-ss",
      "00:00:01",
      "-i",
      outputPath,
      "-frames:v",
      "1",
      "-vf",
      "scale=720:-2",
      "-q:v",
      "5",
      thumbnailPath,
    ], { timeoutMs: 30000 });
    console.log(`[video-worker] thumbnail done message=${messageId}`);

    const [metadata, videoStat] = await Promise.all([ffprobe(outputPath), stat(outputPath)]);
    const [videoUrl, thumbnailUrl] = await Promise.all([
      uploadToR2(videoBucket, videoPath, outputPath, "video/mp4"),
      uploadToR2(thumbnailBucket, thumbPath, thumbnailPath, "image/jpeg"),
    ]);

    const content = {
      type: "video",
      status: "ready",
      video_url: videoUrl,
      thumbnail_url: thumbnailUrl,
      video_path: videoPath,
      thumbnail_path: thumbPath,
      duration: metadata.duration,
      width: metadata.width,
      height: metadata.height,
      file_size: videoStat.size,
    };

    const { error: updateError } = await supabase
      .from("chat_messages")
      .update({ kind: "file", content: JSON.stringify(content) })
      .eq("id", messageId);

    if (updateError) throw updateError;

    await removeFromR2(originalBucket, originalPath);
    originalDownloaded = false;
    console.log(`[video-worker] completed message=${messageId} in ${Math.round((Date.now() - startedAt) / 1000)}s`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message.slice(0, 2000) : "video processing failed";
    console.error("[video-worker] process failed", error);

    if (originalDownloaded) {
      await removeFromR2(originalBucket, originalPath);
    }

    await supabase
      .from("chat_messages")
      .update({
        kind: "file",
        content: JSON.stringify({
          type: "video",
          status: "failed",
          error: errorMessage,
        }),
      })
      .eq("id", messageId);
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
}

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/process-video", requireWorkerSecret, (req, res) => {
  const messageId = typeof req.body?.messageId === "string" ? req.body.messageId : "";
  const originalPath = typeof req.body?.originalPath === "string" ? req.body.originalPath : "";
  const originalBucket = typeof req.body?.originalBucket === "string" ? req.body.originalBucket : DEFAULT_ORIGINAL_BUCKET;
  const videoBucket = typeof req.body?.videoBucket === "string" ? req.body.videoBucket : DEFAULT_VIDEO_BUCKET;
  const thumbnailBucket = typeof req.body?.thumbnailBucket === "string" ? req.body.thumbnailBucket : DEFAULT_THUMBNAIL_BUCKET;

  if (!messageId || !originalPath) {
    res.status(400).json({ error: "messageId and originalPath are required." });
    return;
  }

  console.log(`[video-worker] accepted message=${messageId} path=${originalPath}`);
  res.status(202).json({ ok: true, messageId, status: "processing" });

  void processVideoTask({
    messageId,
    originalBucket,
    originalPath,
    videoBucket,
    thumbnailBucket,
    supabaseUrl: SUPABASE_URL,
    supabaseKey: SUPABASE_SERVICE_ROLE_KEY,
  });
});

app.listen(PORT, () => {
  console.log(`[video-worker] listening on ${PORT}`);
});
