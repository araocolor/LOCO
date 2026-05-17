import { Bookmark, Check } from "lucide-react";

export function CheckModal() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
      <div className="bg-yellow-400 rounded-full w-20 h-20 flex items-center justify-center animate-fade-in-out">
        <Check size={36} className="text-black" strokeWidth={3} />
      </div>
    </div>
  );
}

export function SubscriptionBadge() {
  return (
    <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center bg-white rounded-full">
      <Bookmark size={17} strokeWidth={2.5} className="text-red-500" />
    </span>
  );
}
