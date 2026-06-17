"use client";

import Image from "next/image";
import type { ArchiveItem } from "../../_lib/message-content";

interface ArchiveGridProps {
  items: ArchiveItem[];
}

export default function ArchiveGrid({ items }: ArchiveGridProps) {
  if (items.length === 0) {
    return <div className="flex h-full items-center justify-center text-sm text-white">보관된 항목이 없습니다</div>;
  }

  return (
    <div className="grid grid-cols-3 gap-2">
      {items.map((item) =>
        item.type === "video" ? (
          <video
            key={item.id}
            src={item.href}
            poster={item.thumb ?? undefined}
            controls
            preload="metadata"
            className="aspect-square w-full rounded-md bg-black object-cover"
          />
        ) : (
          <a
            key={item.id}
            href={item.href}
            target="_blank"
            rel="noreferrer"
            className="relative aspect-square overflow-hidden rounded-md bg-gray-200"
            aria-label="사진 열기"
          >
            <Image src={item.thumb} alt="" fill sizes="33vw" className="object-cover" unoptimized />
          </a>
        )
      )}
    </div>
  );
}
