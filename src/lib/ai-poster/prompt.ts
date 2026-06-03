import type { AiPosterExtractedFields, AiPosterPromptInput, AiPosterPromptPayload } from "@/types/ai-poster";

const FIELD_LABEL_PATTERN = /^(모집기간|장소|회비|연락처)\s*[:：]?\s*/;

function normalizeMultilineText(value: string) {
  return value.replace(/\r\n/g, "\n").trim();
}

function getNonEmptyLines(value: string) {
  return normalizeMultilineText(value)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function extractLineValue(lines: string[], label: string) {
  const line = lines.find((current) => current.startsWith(label));
  if (!line) return null;

  const extracted = line.replace(new RegExp(`^${label}\\s*[:：]?\\s*`), "").trim();
  return extracted || null;
}

function extractSummary(lines: string[]) {
  const summaryLine = lines.find((line) => !FIELD_LABEL_PATTERN.test(line));
  return summaryLine ?? "";
}

export function extractAiPosterFields(content: string): AiPosterExtractedFields {
  const lines = getNonEmptyLines(content);

  return {
    summary: extractSummary(lines),
    recruitDeadline: extractLineValue(lines, "모집기간"),
    location: extractLineValue(lines, "장소"),
    fee: extractLineValue(lines, "회비"),
    contact: extractLineValue(lines, "연락처"),
  };
}

export function validateAiPosterPromptInput(input: AiPosterPromptInput) {
  const errors: string[] = [];

  if (input.sourceImageCount < 1) {
    errors.push("강사 사진을 1장 이상 올려주세요.");
  }

  if (!input.title.trim()) {
    errors.push("제목을 입력해주세요.");
  }

  if (!input.content.trim()) {
    errors.push("내용을 입력해주세요.");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

export function buildAiPosterPromptPayload(input: AiPosterPromptInput): AiPosterPromptPayload {
  const title = input.title.trim();
  const rawContent = normalizeMultilineText(input.content);
  const extractedFields = extractAiPosterFields(rawContent);
  const recommendationLine = input.options.useRecommendedGeneration
    ? "세부 연출은 모델이 가장 자연스럽게 판단하되, 전체 인상은 아래 옵션을 우선 반영해줘."
    : "아래 옵션을 기준으로 포스터 분위기와 구성을 맞춰줘.";

  const requiredInfo = [
    `제목: ${title}`,
    extractedFields.summary ? `수업 소개: ${extractedFields.summary}` : null,
    extractedFields.recruitDeadline ? `모집기간: ${extractedFields.recruitDeadline}` : null,
    extractedFields.location ? `장소: ${extractedFields.location}` : null,
    extractedFields.fee ? `회비: ${extractedFields.fee}` : null,
    extractedFields.contact ? `연락처: ${extractedFields.contact}` : null,
  ].filter(Boolean);

  const promptText = [
    `첨부된 강사 프로필 사진 ${input.sourceImageCount}장을 참고해서 클래스 홍보용 AI 포스터를 만들어줘.`,
    `포스터의 핵심 제목은 "${title}" 이야.`,
    recommendationLine,
    `스타일은 ${input.options.style}, 인물 강조는 ${input.options.personFocus}, 전체 톤은 ${input.options.tone}, 비율은 ${input.options.ratio}로 맞춰줘.`,
    "포스터 안에는 아래 정보를 읽기 쉽게 정리해서 넣어줘.",
    ...requiredInfo,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    title,
    rawContent,
    promptText,
    sourceImageCount: input.sourceImageCount,
    options: input.options,
    extractedFields,
  };
}
