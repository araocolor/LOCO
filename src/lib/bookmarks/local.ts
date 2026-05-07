export interface BookmarkEntry {
  id: string;
  created_at: string;
}

function isBookmarkObject(value: unknown): value is BookmarkEntry {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<BookmarkEntry>;
  return typeof row.id === "string" && typeof row.created_at === "string";
}

export function parseBookmarkEntries(raw: string | null): BookmarkEntry[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    // backward compatibility: string[] 캐시를 발견하면 현재 시각으로 보정
    if (parsed.every((item) => typeof item === "string")) {
      const now = new Date().toISOString();
      return (parsed as string[]).map((id) => ({ id, created_at: now }));
    }

    return parsed.filter(isBookmarkObject);
  } catch {
    return [];
  }
}
