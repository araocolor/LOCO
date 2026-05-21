import { createClient } from "@supabase/supabase-js";
import express from "express";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const PORT = Number(process.env.PORT ?? 8080);
const WORKER_SECRET = process.env.WORKER_SECRET;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DEFAULT_ORIGINAL_BUCKET = process.env.ORIGINAL_VIDEO_BUCKET ?? "message-video-originals";
const DEFAULT_VIDEO_BUCKET = process.env.PROCESSED_VIDEO_BUCKET ?? "message-videos";
const DEFAULT_THUMBNAIL_BUCKET = process.env.VIDEO_THUMBNAIL_BUCKET ?? "message-video-thumbnails";
const FFMPEG_TIMEOUT_MS = Number(process.env.FFMPEG_TIMEOUT_MS ?? 120000);
const STORAGE_DOWNLOAD_TIMEOUT_MS = Number(process.env.STORAGE_DOWNLOAD_TIMEOUT_MS ?? 60000);

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
}

if (!WORKER_SECRET) {
  throw new Error("WORKER_SECRET is required.");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
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

async function downloadStorageObject(bucket, objectPath, destination) {
  console.log(`[video-worker] downloading ${bucket}/${objectPath}`);
  const { data: signed, error: signedError } = await supabase.storage
    .from(bucket)
    .createSignedUrl(objectPath, 300);

  if (signedError) throw signedError;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), STORAGE_DOWNLOAD_TIMEOUT_MS);

  try {
    const res = await fetch(signed.signedUrl, { signal: controller.signal });
    if (!res.ok) throw new Error(`download failed with ${res.status}`);

    const buffer = Buffer.from(await res.arrayBuffer());
    await writeFile(destination, buffer);
    console.log(`[video-worker] downloaded ${buffer.length} bytes`);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(`download timed out after ${Math.round(STORAGE_DOWNLOAD_TIMEOUT_MS / 1000)}s`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function uploadStorageObject(bucket, objectPath, filePath, contentType) {
  const buffer = await readFile(filePath);
  console.log(`[video-worker] uploading ${bucket}/${objectPath} (${buffer.length} bytes)`);
  const { error } = await supabase.storage.from(bucket).upload(objectPath, buffer, {
    contentType,
    cacheControl: "31536000",
    upsert: true,
  });

  if (error) throw error;

  const {
    data: { publicUrl },
  } = supabase.storage.from(bucket).getPublicUrl(objectPath);

  return publicUrl;
}

async function removeOriginal(bucket, objectPath) {
  const { error } = await supabase.storage.from(bucket).remove([objectPath]);
  if (error) {
    console.error("[video-worker] failed to remove original", error);
  }
}

async function processVideoTask({
  messageId,
  originalBucket,
  originalPath,
  videoBucket,
  thumbnailBucket,
}) {
  const workDir = path.join(os.tmpdir(), `loco-video-${randomUUID()}`);
  const inputPath = path.join(workDir, "original");
  const outputPath = path.join(workDir, "processed.mp4");
  const thumbnailPath = path.join(workDir, "thumbnail.webp");
  const videoPath = buildOutputPath(originalPath, "_480p.mp4");
  const thumbPath = buildOutputPath(originalPath, "_thumb.webp");
  let originalDownloaded = false;
  const startedAt = Date.now();

  try {
    await mkdir(workDir, { recursive: true });
    await downloadStorageObject(originalBucket, originalPath, inputPath);
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
      "scale=-2:480:force_original_aspect_ratio=decrease,fps=30",
      "-c:v",
      "libx264",
      "-preset",
      "ultrafast",
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
      "scale=480:-2",
      "-c:v",
      "libwebp",
      "-quality",
      "78",
      thumbnailPath,
    ], { timeoutMs: 30000 });
    console.log(`[video-worker] thumbnail done message=${messageId}`);

    const metadata = await ffprobe(outputPath);
    const [videoUrl, thumbnailUrl] = await Promise.all([
      uploadStorageObject(videoBucket, videoPath, outputPath, "video/mp4"),
      uploadStorageObject(thumbnailBucket, thumbPath, thumbnailPath, "image/webp"),
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
    };

    const { error: updateError } = await supabase
      .from("chat_messages")
      .update({ kind: "file", content: JSON.stringify(content) })
      .eq("id", messageId);

    if (updateError) throw updateError;

    await removeOriginal(originalBucket, originalPath);
    originalDownloaded = false;
    console.log(`[video-worker] completed message=${messageId} in ${Math.round((Date.now() - startedAt) / 1000)}s`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message.slice(0, 500) : "video processing failed";
    console.error("[video-worker] process failed", error);

    if (originalDownloaded) {
      await removeOriginal(originalBucket, originalPath);
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
  });
});

app.listen(PORT, () => {
  console.log(`[video-worker] listening on ${PORT}`);
});
