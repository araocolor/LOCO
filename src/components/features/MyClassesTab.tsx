"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import type { ClassWithHost } from "@/components/class/ClassCard";
import ClassMoreMenu from "@/components/class/ClassMoreMenu";

interface MyClassesTabProps {
  classes: ClassWithHost[];
  loading: boolean;
  regionalClasses: ClassWithHost[];
  regionalLoading: boolean;
  regionalLabel: string | null;
  onRetry: () => void;
  onClassSelect?: (classId: string) => void;
}

const GRID_FILL_COLORS = ["#E84040", "#B8D44A", "#F5A623", "#5BB8E8"] as const;

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
          <div className="absolute top-0 left-0 z-10" onClick={(e) => e.stopPropagation()}>
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
          {classData.status === "recruiting" && (
            <div className="absolute top-1.5 right-1.5 w-3 h-3 rounded-full bg-green-500" />
          )}
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

function RegionalHeaderGrid({ label }: { label: string | null }) {
  const router = useRouter();
  const displayLabel = label ? `${label}클래스` : "지역클래스";

  return (
    <div className="grid grid-cols-3 gap-[1px] bg-gray-200">
      <div className="aspect-square bg-white flex items-end justify-start px-4 pb-3">
        <span className="text-[17px] font-bold text-gray-900 leading-tight">
          {displayLabel}
        </span>
      </div>
      <div className="aspect-square bg-gray-100" />
      <button
        type="button"
        onClick={() => router.push("/classes/new")}
        className="aspect-square bg-[#fee500] flex flex-col items-center justify-center gap-2 text-gray-900"
      >
        <Plus size={24} strokeWidth={2.2} />
        <span className="text-sm font-bold">클래스만들기</span>
      </button>
    </div>
  );
}

export default function MyClassesTab({
  classes,
  loading,
  regionalClasses,
  regionalLoading,
  regionalLabel,
  onClassSelect,
}: MyClassesTabProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-32 text-gray-400">
        로딩 중...
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto bg-white pb-6">
      {classes.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-24 text-gray-400">
          <p className="text-sm">개설한 클래스가 없습니다</p>
        </div>
      ) : (
        <ClassGrid classes={classes} onClassSelect={onClassSelect} />
      )}

      <RegionalHeaderGrid label={regionalLabel} />
      {regionalLoading ? (
        <div className="flex items-center justify-center h-24 text-gray-400">
          로딩 중...
        </div>
      ) : regionalClasses.length === 0 ? (
        <div className="flex items-center justify-center h-24 text-gray-400">
          <p className="text-sm">지역 클래스가 없습니다</p>
        </div>
      ) : (
        <ClassGrid classes={regionalClasses} onClassSelect={onClassSelect} />
      )}
    </div>
  );
}
