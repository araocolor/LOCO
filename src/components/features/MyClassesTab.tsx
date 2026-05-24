"use client";

import ClassCard, { ClassWithHost } from "@/components/class/ClassCard";

interface MyClassesTabProps {
  classes: ClassWithHost[];
  loading: boolean;
  onRetry: () => void;
}

export default function MyClassesTab({ classes, loading, onRetry }: MyClassesTabProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-32 text-gray-400">
        로딩 중...
      </div>
    );
  }

  if (classes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-32 text-gray-400">
        <p className="text-sm">개설한 클래스가 없습니다</p>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto bg-white">
      {classes.map((classData) => (
        <ClassCard key={classData.id} classData={classData} />
      ))}
    </div>
  );
}
