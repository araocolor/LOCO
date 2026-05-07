"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import SearchHeader from "@/components/layout/SearchHeader";

interface Follower {
  id: string;
  nickname: string;
  profile_image_url: string | null;
}

export default function SearchPage() {
  const router = useRouter();
  const [followers, setFollowers] = useState<Follower[]>([]);
  const [isSpinning, setIsSpinning] = useState(false);
  const [refreshDisabled, setRefreshDisabled] = useState(false);

  useEffect(() => {
    fetch("/api/friends/followers")
      .then((r) => r.json())
      .then((json) => { if (json.data) setFollowers(json.data); })
      .catch(() => {});
  }, []);

  async function handleRefresh() {
    if (refreshDisabled) return;
    setRefreshDisabled(true);
    setIsSpinning(true);
    setTimeout(() => setRefreshDisabled(false), 60000);
    setTimeout(() => setIsSpinning(false), 2000);
    try {
      const res = await fetch("/api/friends/followers");
      const json = await res.json();
      if (!json.data) return;
      const incoming = json.data as Follower[];
      setFollowers((prev) => {
        const existingIds = new Set(prev.map((f) => f.id));
        const newOnes = incoming.filter((f) => !existingIds.has(f.id));
        if (newOnes.length === 0) return prev;
        return [...newOnes, ...prev];
      });
    } catch {}
  }

  return (
    <>
      <SearchHeader />
      <div className="px-4 pt-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-gray-500">친구목록 {followers.length}</p>
          <button onClick={handleRefresh} disabled={refreshDisabled && !isSpinning} className={`p-1 ${refreshDisabled && !isSpinning ? "text-gray-400 cursor-not-allowed" : "text-gray-800 hover:text-gray-900"}`}>
            <RefreshCw size={18} className={isSpinning ? "animate-spin" : ""} style={{ animationDuration: "0.8s" }} />
          </button>
        </div>
        {followers.length === 0 ? (
          <p className="text-sm text-gray-400">친구가 없으시네요 ㅠㅠ</p>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-2">
            {followers.map((f) => (
              <button
                key={f.id}
                onClick={() => router.push(`/users/${f.id}/view`)}
                className="flex flex-col items-center gap-1 flex-shrink-0"
              >
                {f.profile_image_url ? (
                  <Image
                    src={f.profile_image_url}
                    alt={f.nickname}
                    width={45}
                    height={45}
                    className="rounded-full object-cover"
                  />
                ) : (
                  <div className="w-[45px] h-[45px] rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-sm font-medium">
                    {f.nickname[0]}
                  </div>
                )}
                <span className="text-gray-700" style={{ fontSize: "15px" }}>{f.nickname}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
