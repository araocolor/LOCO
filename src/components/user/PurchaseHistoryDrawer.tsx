"use client";

import { useState, useEffect } from "react";
import { X, Star } from "lucide-react";
import { PiCoinsFill } from "react-icons/pi";
import Image from "next/image";

export interface PurchaseItem {
  id: string;
  name: string;
  imageUrl: string | null;
  unitPrice: number;
  quantity: number;
  totalPrice: number;
  purchasedAt: string;
  category: "credit" | "badge";
}

export type PurchaseTab = "credit" | "badge";

interface Props {
  open: boolean;
  onClose: () => void;
  items: PurchaseItem[];
  initialTab?: PurchaseTab;
}

function formatPrice(price: number) {
  return price.toLocaleString("ko-KR") + "원";
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}.${m}.${day}`;
}

export default function PurchaseHistoryDrawer({ open, onClose, items, initialTab = "credit" }: Props) {
  const [activeTab, setActiveTab] = useState<PurchaseTab>(initialTab);

  useEffect(() => {
    if (open) setActiveTab(initialTab);
  }, [open, initialTab]);

  if (!open) return null;

  const filteredItems = items.filter((item) => item.category === activeTab);

  return (
    <>
      <div className="fixed inset-0 z-[250] bg-black/30" />
      <div className="fixed inset-0 z-[251] flex justify-center">
        <div className="relative w-full max-w-[500px] bg-white flex flex-col page-slide-in-from-right">
          <header className="sticky top-0 z-10 bg-white border-b border-[#e5e7eb]">
            <div className="relative h-14 px-4 flex items-center">
              <div className="font-black text-[22px] text-[#4d4d4d] leading-none">
                구매목록
              </div>
              <button
                type="button"
                onClick={onClose}
                className="ml-auto flex h-9 w-9 items-center justify-center rounded-full hover:bg-gray-100"
                aria-label="닫기"
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex pl-4 pr-4 gap-2 pb-2">
              <button
                type="button"
                onClick={() => setActiveTab("credit")}
                className={`px-3.5 py-1.5 rounded-full text-[15px] font-semibold transition-colors ${
                  activeTab === "credit" ? "bg-black text-white" : "bg-gray-100 text-gray-400"
                }`}
              >
                크레딧
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("badge")}
                className={`px-3.5 py-1.5 rounded-full text-[15px] font-semibold transition-colors ${
                  activeTab === "badge" ? "bg-black text-white" : "bg-gray-100 text-gray-400"
                }`}
              >
                별선물
              </button>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto scrollbar-hide overscroll-contain">
            {filteredItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                <span className="text-[15px]">구매내역이 없습니다</span>
              </div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {filteredItems.map((item) => (
                  <li key={item.id} className="flex gap-3 px-4 py-4">
                    <div className="w-[72px] h-[72px] rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
                      {item.imageUrl ? (
                        <Image
                          src={item.imageUrl}
                          alt={item.name}
                          width={72}
                          height={72}
                          className="w-full h-full object-cover"
                          unoptimized
                        />
                      ) : item.category === "credit" ? (
                        <div className="w-full h-full flex items-center justify-center bg-amber-50">
                          <PiCoinsFill size={36} className="text-yellow-500" />
                        </div>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-indigo-50">
                          <Star size={36} className="text-yellow-400 fill-yellow-400" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
                      <span className="text-[15px] font-semibold text-gray-900 truncate">
                        {item.name}
                      </span>
                      <span className="text-[13px] text-gray-500">
                        {formatPrice(item.unitPrice)} × {item.quantity}개
                      </span>
                      <div className="flex items-center justify-between">
                        <span className="text-[15px] font-bold text-gray-900">
                          {formatPrice(item.totalPrice)}
                        </span>
                        <span className="text-[12px] text-gray-400">
                          {formatDate(item.purchasedAt)}
                        </span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </main>
        </div>
      </div>
    </>
  );
}
