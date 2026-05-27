import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ClassImage } from "@/types/class";

interface GridClass {
  id: string;
  images: ClassImage[] | null;
  title: string;
  status?: string;
  created_at?: string;
  isBookmark?: boolean;
}

interface BookmarkClassRow {
  created_at: string;
  classes:
    | {
        id: string;
        images: ClassImage[] | null;
        title: string;
        status: string;
      }
    | {
        id: string;
        images: ClassImage[] | null;
        title: string;
        status: string;
      }[]
    | null;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, nickname, profile_image_url, bio, member_type, country, region, last_active_at")
    .eq("id", id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const { data: myClassesRaw } = await supabase
    .from("classes")
    .select("id, images, title, status, created_at")
    .eq("host_id", id)
    .order("created_at", { ascending: false })
    .limit(300);

  const { data: bookmarkRaw } = await supabase
    .from("class_bookmarks")
    .select("created_at, classes(id, images, title, status)")
    .eq("user_id", id)
    .order("created_at", { ascending: false })
    .limit(300);

  const admin = createAdminClient();
  const { count: followerCount } = await admin
    .from("friendships")
    .select("id", { count: "exact", head: true })
    .eq("friend_id", id)
    .in("status", ["approved", "friend"]);

  const myClasses = ((myClassesRaw ?? []) as GridClass[]).map((c) => ({
    ...c,
    isBookmark: false,
  }));

  const bookmarkRows = (bookmarkRaw ?? []) as BookmarkClassRow[];
  const bookmarkClasses: GridClass[] = bookmarkRows.flatMap((row) => {
    if (!row.classes) return [];
    const cls = Array.isArray(row.classes) ? row.classes[0] : row.classes;
    if (!cls) return [];
    return [{
      id: cls.id,
      images: cls.images,
      title: cls.title,
      status: cls.status,
      created_at: row.created_at,
      isBookmark: true,
    }];
  });

  return NextResponse.json({
    profile: {
      id: profile.id,
      email: profile.email ?? (user?.id === id ? user.email ?? null : null),
      nickname: profile.nickname,
      bio: profile.bio,
      country: profile.country ?? null,
      last_active_at: profile.last_active_at ?? null,
      member_type: profile.member_type ?? [],
      profile_image_url: profile.profile_image_url,
      region: profile.region ?? null,
    },
    myClasses,
    bookmarkClasses,
    followerCount: followerCount ?? 0,
  });
}
