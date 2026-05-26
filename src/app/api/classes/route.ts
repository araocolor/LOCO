import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_LEVELS = ["beginner", "elementary", "intermediate", "advanced", "all"] as const;
const ALLOWED_CREATE_STATUSES = ["recruiting", "closed"] as const;
const LEVEL_ALIASES: Record<string, (typeof ALLOWED_LEVELS)[number]> = {
  beginner: "beginner",
  입문: "beginner",
  elementary: "elementary",
  초급: "elementary",
  intermediate: "intermediate",
  중급: "intermediate",
  advanced: "advanced",
  고급: "advanced",
  all: "all",
  올레벨: "all",
};

function normalizeLevel(value: unknown): (typeof ALLOWED_LEVELS)[number] | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return LEVEL_ALIASES[value.trim()] ?? LEVEL_ALIASES[normalized] ?? null;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const level = normalizeLevel(body?.level);
  const status = ALLOWED_CREATE_STATUSES.includes(body?.status) ? body.status : "recruiting";

  if (!level) {
    return NextResponse.json(
      { error: "레벨 값이 올바르지 않습니다. (입문/초급/중급/고급/올레벨)" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("classes")
    .insert({
      ...body,
      level,
      host_id: user.id,
      status,
      datetime: body?.datetime ?? body?.deadline,
      capacity: body?.capacity ?? 9999,
      price: body?.price ?? 0,
      view_count: 0,
      is_modified: false,
    })
    .select()
    .single();

  if (error) {
    if (error.message.includes("violates check constraint")) {
      return NextResponse.json({ error: "입력한 항목을 다시 확인해주세요." }, { status: 400 });
    }
    if (error.message.includes("classes_level_check")) {
      return NextResponse.json(
        { error: "레벨 값이 올바르지 않습니다. (입문/초급/중급/고급/올레벨)" },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
