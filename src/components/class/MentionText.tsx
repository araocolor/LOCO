"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

interface MentionProfile {
  id: string;
  nickname: string;
}

interface MentionTextProps {
  text: string;
  emptyText?: string;
  className?: string;
}

const MENTION_PATTERN = /(^|[^\p{L}\p{N}_-])@([\p{L}\p{N}_-]{1,30})/gu;

function getMentionHandles(text: string) {
  const handles = new Set<string>();
  for (const match of text.matchAll(MENTION_PATTERN)) {
    handles.add(match[2]);
  }
  return Array.from(handles);
}

export default function MentionText({ text, emptyText, className }: MentionTextProps) {
  const content = text || emptyText || "";
  const handles = useMemo(() => getMentionHandles(content), [content]);
  const [profiles, setProfiles] = useState<Record<string, MentionProfile>>({});

  useEffect(() => {
    if (handles.length === 0) {
      setProfiles({});
      return;
    }

    let cancelled = false;
    const run = async () => {
      try {
        const params = new URLSearchParams({ handles: handles.join(",") });
        const res = await fetch(`/api/users/mentions?${params.toString()}`, { method: "GET" });
        if (!res.ok) return;
        const json = (await res.json()) as { data?: MentionProfile[] };
        if (cancelled) return;

        setProfiles(
          (json.data ?? []).reduce<Record<string, MentionProfile>>((acc, profile) => {
            acc[profile.nickname] = profile;
            return acc;
          }, {})
        );
      } catch {
        if (!cancelled) setProfiles({});
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [handles]);

  if (!content) return null;

  const nodes: ReactNode[] = [];
  let lastIndex = 0;

  for (const match of content.matchAll(MENTION_PATTERN)) {
    const fullMatch = match[0];
    const prefix = match[1];
    const nickname = match[2];
    const start = match.index ?? 0;
    const mentionStart = start + prefix.length;
    const mentionEnd = start + fullMatch.length;

    if (mentionStart > lastIndex) {
      nodes.push(content.slice(lastIndex, mentionStart));
    }

    const profile = profiles[nickname];
    if (profile) {
      nodes.push(
        <Link
          key={`${mentionStart}-${nickname}`}
          href={`/users/${profile.id}`}
          className="font-semibold text-blue-600 hover:underline"
        >
          @{nickname}
        </Link>
      );
    } else {
      nodes.push(`@${nickname}`);
    }

    lastIndex = mentionEnd;
  }

  if (lastIndex < content.length) {
    nodes.push(content.slice(lastIndex));
  }

  return <p className={className}>{nodes}</p>;
}
