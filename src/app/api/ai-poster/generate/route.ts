import { NextRequest, NextResponse } from "next/server";
import OpenAI, { toFile } from "openai";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { AiPosterSourceImage } from "@/types/ai-poster";

const POSTER_IMAGE_BUCKET = "class-images";

function createOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY 환경 변수가 설정되지 않았습니다.");
  }

  return new OpenAI({ apiKey });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let requestId: string | null = null;

  try {
    const body = (await request.json()) as {
      requestId: string;
      promptText?: string;
      title?: string;
      extractedFields?: Record<string, string | null>;
    };
    requestId = body.requestId;

    if (!requestId) {
      return NextResponse.json({ error: "requestId가 필요합니다." }, { status: 400 });
    }

    const { data: record, error: fetchError } = await supabase
      .from("ai_poster_requests")
      .select("*")
      .eq("id", requestId)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !record) {
      return NextResponse.json({ error: "요청을 찾을 수 없습니다." }, { status: 404 });
    }

    if (record.status === "generated") {
      return NextResponse.json({ imageUrl: record.generated_image_url });
    }

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: recentGeneratedRequest } = await supabase
      .from("ai_poster_requests")
      .select("id, generated_at")
      .eq("user_id", user.id)
      .eq("status", "generated")
      .gte("generated_at", sevenDaysAgo)
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (recentGeneratedRequest) {
      return NextResponse.json(
        { error: "최근 7일 내 이미지를 생성해서 다시 만들 수 없어요." },
        { status: 429 }
      );
    }

    const finalPrompt = body.promptText ?? record.prompt_text;
    const updatePayload: Record<string, unknown> = { status: "submitted" };
    if (body.promptText) updatePayload.prompt_text = body.promptText;
    if (body.title) updatePayload.title = body.title;
    if (body.extractedFields) updatePayload.extracted_fields = body.extractedFields;

    await supabase
      .from("ai_poster_requests")
      .update(updatePayload)
      .eq("id", requestId);

    const sourceImages = Array.isArray(record.source_images)
      ? (record.source_images as AiPosterSourceImage[])
      : [];

    const EXT_TO_MIME: Record<string, string> = {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      webp: "image/webp",
    };

    const admin = createAdminClient();
    const openai = createOpenAIClient();

    const imageFiles = await Promise.all(
      sourceImages.map(async (img, i) => {
        if (img.bucket !== POSTER_IMAGE_BUCKET || !img.path.startsWith(`${user.id}/`)) {
          throw new Error("강사 사진을 불러올 수 없습니다.");
        }
        const { data: fileData, error: dlError } = await admin.storage
          .from(POSTER_IMAGE_BUCKET)
          .download(img.path);
        if (dlError || !fileData) throw new Error("강사 사진을 불러올 수 없습니다.");
        const buf = Buffer.from(await fileData.arrayBuffer());
        const ext = img.path.split(".").pop()?.toLowerCase() || "jpg";
        const mime = EXT_TO_MIME[ext] || "image/jpeg";
        return toFile(buf, `source-${i + 1}.${ext}`, { type: mime });
      })
    );

    const response = await openai.images.edit({
      model: "gpt-image-2",
      prompt: finalPrompt,
      image: imageFiles,
      n: 1,
      size: "1024x1536",
      quality: "low",
    });

    const imageData = response.data?.[0];
    if (!imageData?.b64_json) {
      throw new Error("이미지 생성에 실패했습니다.");
    }

    const buffer = Buffer.from(imageData.b64_json, "base64");
    const storagePath = `${user.id}/ai-poster-requests/${requestId}/generated.webp`;

    const { error: uploadError } = await admin.storage
      .from(POSTER_IMAGE_BUCKET)
      .upload(storagePath, buffer, {
        contentType: "image/webp",
        upsert: true,
      });

    if (uploadError) {
      throw new Error(uploadError.message);
    }

    const {
      data: { publicUrl },
    } = admin.storage.from(POSTER_IMAGE_BUCKET).getPublicUrl(storagePath);

    await supabase
      .from("ai_poster_requests")
      .update({
        status: "generated",
        generated_image_url: publicUrl,
        generated_storage_bucket: POSTER_IMAGE_BUCKET,
        generated_storage_path: storagePath,
        generated_at: new Date().toISOString(),
      })
      .eq("id", requestId);

    return NextResponse.json({ imageUrl: publicUrl });
  } catch (error) {
    if (requestId) {
      await supabase
        .from("ai_poster_requests")
        .update({ status: "failed" })
        .eq("id", requestId);
    }

    console.error("[ai-poster/generate]", error);

    return NextResponse.json(
      { error: "이미지 생성 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
