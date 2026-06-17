"use client";

import CustomerServiceContent, { type CustomerServiceTab } from "./CustomerServiceContent";

export type { CustomerServiceTab };

interface Props {
  open: boolean;
  onClose: () => void;
  initialTab?: CustomerServiceTab;
}

export default function CustomerServiceDrawer({ open, onClose, initialTab = "notice" }: Props) {
  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-[250] bg-black/30" />
      <div className="fixed inset-0 z-[251] flex justify-center">
        <div
          className="relative w-full max-w-[500px] bg-white flex flex-col page-slide-in-from-right"
          style={{ paddingTop: "env(safe-area-inset-top)" }}
        >
          <CustomerServiceContent active={open} initialTab={initialTab} onClose={onClose} />
        </div>
      </div>
    </>
  );
}
