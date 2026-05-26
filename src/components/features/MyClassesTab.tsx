"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import type { ClassWithHost } from "@/components/class/ClassCard";

interface MyClassesTabProps {
  classes: ClassWithHost[];
  loading: boolean;
  regionalClasses: ClassWithHost[];
  regionalLoading: boolean;
  regionalLabel: string | null;
  onRetry: () => void;
}

function ClassGrid({ classes }: { classes: ClassWithHost[] }) {
  const router = useRouter();

  return (
    <div className="grid grid-cols-3 gap-[1px] bg-gray-200">
      {classes.map((classData) => (
        <button
          key={classData.id}
          type="button"
          onClick={() => router.push(`/classes/${classData.id}`)}
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
          {classData.status === "recruiting" && (
            <div className="absolute top-1.5 right-1.5 w-3 h-3 rounded-full bg-green-500" />
          )}
        </button>
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
        <ClassGrid classes={classes} />
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
        <ClassGrid classes={regionalClasses} />
      )}
    </div>
  );
}
