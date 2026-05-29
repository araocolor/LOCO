"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import ClassCard, { type ClassWithHost } from "@/components/class/ClassCard";
import ClassMoreMenu from "@/components/class/ClassMoreMenu";

const GRID_FILL_COLORS = ["#E84040", "#B8D44A", "#F5A623", "#5BB8E8"] as const;

interface FriendClassesSectionProps {
  classes: ClassWithHost[];
  loading: boolean;
  onClassSelect?: (classId: string) => void;
  viewMode?: "grid" | "card";
}

function ClassCardList({ classes }: { classes: ClassWithHost[] }) {
  return (
    <div className="space-y-0">
      {classes.map((c, idx) => (
        <ClassCard key={`${c.id}-${idx}`} classData={c} priorityImage={idx < 2} />
      ))}
    </div>
  );
}

function ClassGrid({ classes, onClassSelect }: { classes: ClassWithHost[]; onClassSelect?: (classId: string) => void }) {
  const router = useRouter();
  const [gridFillSeed] = useState(() => Math.floor(Math.random() * GRID_FILL_COLORS.length));
  const fillerCells = useMemo(() => {
    const remain = classes.length % 3;
    const count = remain === 0 ? 0 : 3 - remain;
    return Array.from({ length: count }, (_, idx) => {
      const color = GRID_FILL_COLORS[(gridFillSeed + classes.length + idx) % GRID_FILL_COLORS.length];
      return { key: `filler-${classes.length}-${idx}`, color };
    });
  }, [classes.length, gridFillSeed]);

  return (
    <div className="grid grid-cols-3 gap-[1px] bg-gray-200">
      {classes.map((classData) => (
        <div
          key={classData.id}
          onClick={() => onClassSelect ? onClassSelect(classData.id) : router.push(`/classes/${classData.id}`)}
          className="aspect-square bg-gray-100 relative overflow-hidden cursor-pointer"
        >
          {classData.images?.[0]?.card_url ? (
            <Image
              src={classData.images[0].card_url}
              alt={classData.title}
              fill
              sizes="(max-width: 640px) 33vw, 213px"
              className="object-cover"
              unoptimized
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-100">
              <span className="text-gray-300 text-xs">없음</span>
            </div>
          )}
          {classData.status !== "recruiting" && (
            <div className="absolute top-1.5 left-1.5 w-3 h-3 rounded-full bg-black" />
          )}
          <div className="absolute top-0 right-0 z-10" onClick={(e) => e.stopPropagation()}>
            <ClassMoreMenu
              classId={classData.id}
              hostId={classData.host_id}
              hostNickname={classData.host?.nickname}
              hostImageUrl={classData.host?.profile_image_url}
              status={classData.status}
              buttonClassName="flex items-center justify-center w-8 h-8 text-white drop-shadow-md"
              onDetailView={() => onClassSelect ? onClassSelect(classData.id) : router.push(`/classes/${classData.id}`)}
            />
          </div>
        </div>
      ))}
      {fillerCells.map((cell) => (
        <div
          key={cell.key}
          aria-hidden="true"
          className="aspect-square"
          style={{ backgroundColor: cell.color }}
        />
      ))}
    </div>
  );
}

export default function FriendClassesSection({
  classes,
  loading,
  onClassSelect,
  viewMode = "grid",
}: FriendClassesSectionProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-32 text-gray-400">
        로딩 중...
      </div>
    );
  }

  if (classes.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-gray-400">
        <p className="text-sm">친구가 개설한 클래스가 없습니다</p>
      </div>
    );
  }

  return (
    <div className="bg-white pb-6">
      {viewMode === "card" ? (
        <ClassCardList classes={classes} />
      ) : (
        <ClassGrid classes={classes} onClassSelect={onClassSelect} />
      )}
    </div>
  );
}
