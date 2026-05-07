import HeaderBackCircleButton from "@/components/layout/HeaderBackCircleButton";

interface ClassHeaderProps {
  backExitAnimationClass?: string;
  backExitDelayMs?: number;
}

export default function ClassHeader({
  backExitAnimationClass,
  backExitDelayMs,
}: ClassHeaderProps) {
  return (
    <header className="sticky top-0 z-50 bg-white border-b border-[#e5e7eb] h-14 px-4 relative flex items-center">
      <div className="w-10 flex items-center justify-start">
        <HeaderBackCircleButton
          exitAnimationClass={backExitAnimationClass}
          exitDelayMs={backExitDelayMs}
        />
      </div>
      <div className="absolute left-1/2 -translate-x-1/2 font-bold text-xl text-[#FEE500] leading-none">
        LOCO
      </div>
      <div className="ml-auto w-10" />
    </header>
  );
}
