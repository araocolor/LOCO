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
const mentionProfileCache = new Map<string, MentionProfile>();
const mentionRequestCache = new Map<string, Promise<void>>();

function getMentionHandles(text: string) {
  const handles = new Set<string>();
  for (const match of text.matchAll(MENTION_PATTERN)) {
    handles.add(match[2]);
  }
  return Array.from(handles);
}

function getCachedProfiles(handles: string[]) {
  return handles.reduce<Record<string, MentionProfile>>((acc, handle) => {
    const profile = mentionProfileCache.get(handle);
    if (profile) acc[handle] = profile;
    return acc;
  }, {});
}

export default function MentionText({ text, emptyText, className }: MentionTextProps) {
  const content = text || emptyText || "";
  const handles = useMemo(() => getMentionHandles(content), [content]);
  const [profiles, setProfiles] = useState<Record<string, MentionProfile>>(() => getCachedProfiles(handles));

  useEffect(() => {
    let cancelled = false;

    if (handles.length === 0) {
      queueMicrotask(() => {
        if (!cancelled) setProfiles({});
      });
      return () => {
        cancelled = true;
      };
    }

    queueMicrotask(() => {
      if (!cancelled) setProfiles(getCachedProfiles(handles));
    });

    const missingHandles = handles.filter((handle) => !mentionProfileCache.has(handle));
    if (missingHandles.length === 0) {
      return () => {
        cancelled = true;
      };
    }

    const requestKey = [...missingHandles].sort().join(",");
    const run = async () => {
      try {
        let request = mentionRequestCache.get(requestKey);
        if (!request) {
          request = (async () => {
            const params = new URLSearchParams({ handles: missingHandles.join(",") });
            const res = await fetch(`/api/users/mentions?${params.toString()}`, { method: "GET" });
            if (!res.ok) return;
            const json = (await res.json()) as { data?: MentionProfile[] };
            (json.data ?? []).forEach((profile) => {
              mentionProfileCache.set(profile.nickname, profile);
            });
          })();
          mentionRequestCache.set(requestKey, request);
        }

        await request;
        if (cancelled) return;

        setProfiles(getCachedProfiles(handles));
      } catch {
        if (!cancelled) setProfiles({});
      } finally {
        mentionRequestCache.delete(requestKey);
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
