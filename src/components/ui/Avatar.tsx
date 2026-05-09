"use client";

import Image from "next/image";

interface AvatarProps {
  src: string | null;
  nickname: string;
  size: number;
  className?: string;
}

function getDiceBearUrl(nickname: string) {
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(nickname)}`;
}

export default function Avatar({ src, nickname, size, className = "" }: AvatarProps) {
  if (!src) {
    return (
      <img
        src={getDiceBearUrl(nickname)}
        alt={nickname}
        width={size}
        height={size}
        className={`rounded-full flex-shrink-0 ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <Image
      src={src}
      alt={nickname}
      width={size}
      height={size}
      className={`rounded-full object-cover flex-shrink-0 ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
