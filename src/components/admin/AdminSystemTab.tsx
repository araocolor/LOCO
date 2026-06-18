"use client";

import { useState } from "react";
import { Trophy } from "lucide-react";

// 시스템 탭: 게임방 점수 리셋(주간 정산) 버튼.
// 누르면 각 방 1등에게 별 +1 + 알림을 지급하고, 새 주가 시작되며 랭킹이 리셋된다.
export default function AdminSystemTab() {
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleReset() {
    if (running) return;
    const ok = window.confirm("게임방 점수를 리셋하고 각 방 1등에게 별을 지급할까요?");
    if (!ok) return;

    setRunning(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/game-reward", { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        setMessage(`실패: ${json.error ?? "알 수 없는 오류"}`);
        return;
      }
      setMessage(`${json.rewarded ?? 0}명에게 별을 지급했습니다.`);
    } catch {
      setMessage("요청에 실패했습니다.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="card bg-white rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Trophy size={18} className="text-[#1D9BF0]" />
        <p className="text-[15px] font-bold text-[#333]">게임방 점수 리셋</p>
      </div>
      <p className="text-sm text-gray-400">
        각 채팅방 1등에게 별 +1을 지급하고 알림을 보냅니다. 여러 방 1등이어도 한 사람당 별은 1개만 받습니다.
      </p>
      <button
        type="button"
        onClick={handleReset}
        disabled={running}
        className="w-full rounded-full bg-[#1D9BF0] px-4 py-2.5 text-sm font-bold text-white active:bg-[#1a8cd8] disabled:opacity-50"
      >
        {running ? "처리 중..." : "지금 리셋 및 별 지급"}
      </button>
      {message && <p className="text-sm text-gray-600">{message}</p>}
    </section>
  );
}
