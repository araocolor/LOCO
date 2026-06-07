import { NextRequest, NextResponse } from "next/server";
import OpenAI, { toFile } from "openai";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { AiPosterSourceImage } from "@/types/ai-poster";

const POSTER_IMAGE_BUCKET = "class-images";

interface AiPosterErrorInfo {
  code: string;
  message: string;
  detail: string;
  requestId: string | null;
  provider: string;
}

function createOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY 환경 변수가 설정되지 않았습니다.");
  }

  return new OpenAI({ apiKey });
}

function getErrorProperty(error: unknown, key: string): unknown {
  if (!error || typeof error !== "object") return null;
  return (error as Record<string, unknown>)[key];
}

function getErrorDetail(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;

  try {
    return JSON.stringify(error);
  } catch {
    return "알 수 없는 오류";
  }
}

function extractOpenAIRequestId(error: unknown, detail: string) {
  const fromObject =
    getErrorProperty(error, "request_id") ??
    getErrorProperty(error, "requestId") ??
    getErrorProperty(error, "requestID");

  if (typeof fromObject === "string" && fromObject) return fromObject;

  return detail.match(/req_[a-zA-Z0-9]+/)?.[0] ?? null;
}

function normalizeAiPosterError(error: unknown): AiPosterErrorInfo {
  const detail = getErrorDetail(error).slice(0, 4000);
  const normalized = detail.toLowerCase();
  const status = getErrorProperty(error, "status");
  const requestId = extractOpenAIRequestId(error, detail);
  const provider = normalized.includes("openai") || requestId ? "openai" : "system";

  if (normalized.includes("safety") || normalized.includes("policy")) {
    const isSexual = normalized.includes("sexual");
    return {
      code: isSexual ? "safety_sexual" : "safety_rejected",
      message: isSexual
        ? "참조 이미지나 문구가 선정적으로 인식되어 생성하지 못했어요. 프롬프트를 순화하거나 참조 이미지를 바꾼 뒤 다시 시도해 주세요."
        : "참조 이미지나 문구가 안전 기준에 맞지 않아 생성하지 못했어요. 내용을 조금 수정한 뒤 다시 시도해 주세요.",
      detail,
      requestId,
      provider: "openai",
    };
  }

  if (
    normalized.includes("unsupported") ||
    normalized.includes("invalid image") ||
    normalized.includes("image format") ||
    normalized.includes("mime") ||
    normalized.includes("file type")
  ) {
    return {
      code: "invalid_image_format",
      message: "지원되지 않는 이미지 형식이에요. JPG, PNG, WEBP 이미지로 다시 올려 주세요.",
      detail,
      requestId,
      provider,
    };
  }

  if (
    normalized.includes("too large") ||
    normalized.includes("file size") ||
    normalized.includes("image size") ||
    normalized.includes("maximum") ||
    normalized.includes("50mb")
  ) {
    return {
      code: "image_too_large",
      message: "이미지 용량이 너무 커요. 더 작은 이미지로 다시 올려 주세요.",
      detail,
      requestId,
      provider,
    };
  }

  if (
    normalized.includes("low quality") ||
    normalized.includes("blurry") ||
    normalized.includes("resolution") ||
    normalized.includes("too small") ||
    normalized.includes("can't identify") ||
    normalized.includes("cannot identify")
  ) {
    return {
      code: "image_quality_low",
      message: "이미지가 흐리거나 인식하기 어려워요. 더 선명한 이미지로 바꿔 주세요.",
      detail,
      requestId,
      provider,
    };
  }

  if (
    normalized.includes("prompt") &&
    (normalized.includes("invalid") ||
      normalized.includes("too long") ||
      normalized.includes("maximum length") ||
      normalized.includes("required"))
  ) {
    return {
      code: "invalid_prompt",
      message: "입력한 문구를 처리하기 어려워요. 내용을 조금 줄이거나 구체적으로 수정해 주세요.",
      detail,
      requestId,
      provider,
    };
  }

  if (
    status === 429 ||
    normalized.includes("rate limit") ||
    normalized.includes("too many requests")
  ) {
    return {
      code: "rate_limit",
      message: "이미지 생성 요청이 잠시 몰려 있어요. 조금 뒤 다시 시도해 주세요.",
      detail,
      requestId,
      provider: "openai",
    };
  }

  if (
    normalized.includes("quota") ||
    normalized.includes("billing") ||
    normalized.includes("credit") ||
    normalized.includes("insufficient") ||
    normalized.includes("exceeded your current")
  ) {
    return {
      code: "quota_exceeded",
      message: "현재 생성 가능한 횟수를 모두 사용했어요. 이용 가능 시점을 확인해 주세요.",
      detail,
      requestId,
      provider: "openai",
    };
  }

  if (
    status === 401 ||
    status === 403 ||
    normalized.includes("api key") ||
    normalized.includes("permission") ||
    normalized.includes("unauthorized") ||
    normalized.includes("forbidden")
  ) {
    return {
      code: "openai_auth",
      message: "이미지 생성 설정에 문제가 있어요. 관리자 확인이 필요합니다.",
      detail,
      requestId,
      provider: "openai",
    };
  }

  if (
    status === 408 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504 ||
    normalized.includes("timeout") ||
    normalized.includes("temporarily") ||
    normalized.includes("server error") ||
    normalized.includes("service unavailable") ||
    normalized.includes("fetch failed") ||
    normalized.includes("upstream")
  ) {
    return {
      code: "temporary_error",
      message: "일시적인 문제로 이미지를 생성하지 못했어요. 잠시 후 다시 시도해 주세요.",
      detail,
      requestId,
      provider,
    };
  }

  return {
    code: "temporary_error",
    message: "일시적인 문제로 이미지를 생성하지 못했어요. 잠시 후 다시 시도해 주세요.",
    detail,
    requestId,
    provider,
  };
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
      regenerate?: boolean;
      extractedFields?: Record<string, string | null>;
    };
    requestId = body.requestId;
    const shouldRegenerate = body.regenerate === true;

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

    if (record.status === "generated" && !shouldRegenerate) {
      return NextResponse.json({ imageUrl: record.generated_image_url });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    const role = profile?.role ?? "unknown";

    if (role !== "admin") {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: recentGeneratedRequest } = await supabase
        .from("ai_poster_requests")
        .select("id, generated_at")
        .eq("user_id", user.id)
        .eq("status", "generated")
        .neq("id", requestId)
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
    }

    const finalPrompt = body.promptText ?? record.prompt_text;
    const updatePayload: Record<string, unknown> = {
      status: "submitted",
      error_code: null,
      error_message: null,
      error_detail: null,
      error_request_id: null,
      error_provider: null,
      failed_at: null,
    };
    if (body.promptText) updatePayload.prompt_text = body.promptText;
    if (body.title) updatePayload.title = body.title;
    if (body.extractedFields) updatePayload.extracted_fields = body.extractedFields;

    await supabase.from("ai_poster_requests").update(updatePayload).eq("id", requestId);

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
        error_code: null,
        error_message: null,
        error_detail: null,
        error_request_id: null,
        error_provider: null,
        failed_at: null,
      })
      .eq("id", requestId);

    return NextResponse.json({ imageUrl: publicUrl });
  } catch (error) {
    const errorInfo = normalizeAiPosterError(error);

    if (requestId) {
      await supabase
        .from("ai_poster_requests")
        .update({
          status: "failed",
          error_code: errorInfo.code,
          error_message: errorInfo.message,
          error_detail: errorInfo.detail,
          error_request_id: errorInfo.requestId,
          error_provider: errorInfo.provider,
          failed_at: new Date().toISOString(),
        })
        .eq("id", requestId);
    }

    console.error("[ai-poster/generate]", error);

    return NextResponse.json(
      {
        error: errorInfo.message,
        errorCode: errorInfo.code,
        errorRequestId: errorInfo.requestId,
      },
      { status: 500 }
    );
  }
}
