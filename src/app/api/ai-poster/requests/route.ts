import { NextRequest, NextResponse } from "next/server";
import { buildAiPosterPromptPayload, validateAiPosterPromptInput } from "@/lib/ai-poster/prompt";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { AiPosterSourceImage } from "@/types/ai-poster";

const POSTER_IMAGE_BUCKET = "class-images";
const MAX_IMAGE_COUNT = 5;

function getFileExtension(file: File, fallbackIndex: number) {
  const nameExtension = file.name.match(/\.([a-zA-Z0-9]+)$/)?.[1]?.toLowerCase();
  if (nameExtension) return nameExtension;

  const mimeExtension = file.type.split("/")[1]?.toLowerCase();
  if (mimeExtension) return mimeExtension;

  return `img-${fallbackIndex}`;
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("ai_poster_requests")
    .select("id, title, created_at")
    .eq("user_id", user.id)
    .eq("status", "reviewed")
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ drafts: data ?? [] });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const uploadedPaths: string[] = [];

  try {
    const formData = await request.formData();
    const title = String(formData.get("title") ?? "");
    const content = String(formData.get("content") ?? "");
    const style = String(formData.get("style") ?? "");
    const personFocus = String(formData.get("personFocus") ?? "");
    const tone = String(formData.get("tone") ?? "");
    const ratio = String(formData.get("ratio") ?? "");
    const useRecommendedGeneration = String(formData.get("useRecommendedGeneration") ?? "") === "true";
    const imageFiles = formData
      .getAll("images")
      .filter((value): value is File => value instanceof File && value.size > 0);

    if (imageFiles.length > MAX_IMAGE_COUNT) {
      return NextResponse.json({ error: "사진은 최대 5장까지 업로드할 수 있습니다." }, { status: 400 });
    }

    const promptPayload = buildAiPosterPromptPayload({
      title,
      content,
      sourceImageCount: imageFiles.length,
      options: {
        style,
        personFocus,
        tone,
        ratio,
        useRecommendedGeneration,
      },
    });

    const validation = validateAiPosterPromptInput({
      title,
      content,
      sourceImageCount: imageFiles.length,
      options: promptPayload.options,
    });

    if (!validation.isValid) {
      return NextResponse.json({ error: validation.errors[0] }, { status: 400 });
    }

    const requestId = crypto.randomUUID();
    const sourceImages: AiPosterSourceImage[] = [];

    for (const [index, file] of imageFiles.entries()) {
      if (!file.type.startsWith("image/")) {
        return NextResponse.json({ error: "이미지 파일만 업로드할 수 있습니다." }, { status: 400 });
      }

      const extension = getFileExtension(file, index + 1);
      const normalizedPath =
        `${user.id}/ai-poster-requests/${requestId}/source-${index + 1}.${extension}`.replace(
          /^\/+/,
          ""
        );
      const buffer = Buffer.from(await file.arrayBuffer());

      const { error: uploadError } = await admin.storage.from(POSTER_IMAGE_BUCKET).upload(
        normalizedPath,
        buffer,
        {
          contentType: file.type || "image/jpeg",
          upsert: false,
        }
      );

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      uploadedPaths.push(normalizedPath);

      const {
        data: { publicUrl },
      } = admin.storage.from(POSTER_IMAGE_BUCKET).getPublicUrl(normalizedPath);

      sourceImages.push({
        bucket: POSTER_IMAGE_BUCKET,
        path: normalizedPath,
        url: publicUrl,
        fileName: file.name,
      });
    }

    const { data, error } = await supabase
      .from("ai_poster_requests")
      .insert({
        id: requestId,
        user_id: user.id,
        title: promptPayload.title,
        raw_content: promptPayload.rawContent,
        prompt_text: promptPayload.promptText,
        source_image_count: promptPayload.sourceImageCount,
        source_images: sourceImages,
        options: promptPayload.options,
        extracted_fields: promptPayload.extractedFields,
        status: "reviewed",
      })
      .select("id")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ id: data.id }, { status: 201 });
  } catch (error) {
    if (uploadedPaths.length > 0) {
      await admin.storage.from(POSTER_IMAGE_BUCKET).remove(uploadedPaths);
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "프롬프트 저장 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
