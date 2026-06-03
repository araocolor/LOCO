"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Power } from "lucide-react";
import Avatar from "@/components/ui/Avatar";

export interface MemberGameProfile {
  userId: string;
  nickname: string;
  profileImageUrl: string | null;
  role: "owner" | "admin" | "member";
}

interface MemberBreakoutGameProps {
  members: MemberGameProfile[];
  onExitGame: () => void;
}

interface GameBounds {
  width: number;
  height: number;
}

interface Brick {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  alive: boolean;
}

interface BallState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
}

interface GameState {
  ball: BallState;
  paddleX: number;
  bricks: Brick[];
  rescuedOrder: string[];
  hitAt: Record<string, number>;
  pendingReleaseAt: Record<string, number>;
  releasedAt: Record<string, number>;
  relaunchAt: number | null;
  time: number;
  startedAt: number | null;
  endedAt: number | null;
  launched: boolean;
  status: "running" | "completed";
  completionReason: "rescue" | "bricks" | null;
  finalScore: number | null;
}

interface MemberLayout {
  member: MemberGameProfile;
  x: number;
  y: number;
  width: number;
  height: number;
}

const BRICK_COLUMNS = 10;
const BRICK_ROWS = 5;
const BRICK_GAP = 6;
const BOARD_SIDE_PADDING = 18;
const BRICK_TOP = 148;
const PADDLE_Y_GAP = 98;
const PADDLE_WIDTH_RATIO = 0.34;
const START_BUTTON_HEIGHT = 44;
const BALL_RADIUS = 7;
const MEMBER_AVATAR_SIZE = 30;
const BASE_SPEED = 188;
const MAX_EXTRA_SPEED = 340;
const MEMBER_HIT_DELAY_MS = 280;
const RESCUE_FALL_MS = 820;
const RELAUNCH_DELAY_MS = 720;
const BRICK_SCORE = 100;
const RESCUE_SCORE = 250;
const BRICK_COLORS = [
  "#ff7a59",
  "#ffb347",
  "#ffe066",
  "#77dd77",
  "#66d9e8",
  "#74c0fc",
  "#a78bfa",
  "#f783ac",
];
const BRICK_GAPS = new Set([
  "1-0",
  "1-9",
  "2-4",
  "2-5",
  "3-1",
  "3-8",
  "4-0",
  "4-9",
]);

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2;
}

function buildBricks(bounds: GameBounds) {
  const usableWidth = bounds.width - BOARD_SIDE_PADDING * 2;
  const brickWidth = (usableWidth - BRICK_GAP * (BRICK_COLUMNS - 1)) / BRICK_COLUMNS;
  const brickHeight = 18;

  return Array.from({ length: BRICK_ROWS * BRICK_COLUMNS }, (_, index) => {
    const row = Math.floor(index / BRICK_COLUMNS);
    const col = index % BRICK_COLUMNS;
    const id = `${row}-${col}`;
    return {
      id,
      x: BOARD_SIDE_PADDING + col * (brickWidth + BRICK_GAP),
      y: BRICK_TOP + row * (brickHeight + BRICK_GAP),
      width: brickWidth,
      height: brickHeight,
      color: BRICK_COLORS[(row + col) % BRICK_COLORS.length],
      alive: !BRICK_GAPS.has(id),
    } satisfies Brick;
  });
}

function getPaddleWidth(bounds: GameBounds) {
  return clamp(bounds.width * PADDLE_WIDTH_RATIO, 132, 176);
}

function getPaddleY(bounds: GameBounds) {
  return bounds.height - PADDLE_Y_GAP;
}

function buildMemberLayouts(bounds: GameBounds, members: MemberGameProfile[]) {
  if (members.length === 0) return [];

  const cols = Math.min(5, Math.max(1, members.length));
  const rows = Math.ceil(members.length / cols);
  const top = -12;
  const bottom = BRICK_TOP - 18;
  const areaHeight = Math.max(MEMBER_AVATAR_SIZE, bottom - top);
  const gapX = 12;
  const gapY = 10;
  const cellWidth = MEMBER_AVATAR_SIZE;
  const cellHeight = MEMBER_AVATAR_SIZE;
  const totalWidth = cols * cellWidth + gapX * (cols - 1);
  const totalHeight = rows * cellHeight + gapY * (rows - 1);
  const startX = (bounds.width - totalWidth) / 2;
  const startY = top + Math.max(0, (areaHeight - totalHeight) / 2);

  return members.map((member, index) => {
    const row = Math.floor(index / cols);
    const col = index % cols;
    return {
      member,
      x: startX + col * (cellWidth + gapX),
      y: startY + row * (cellHeight + gapY),
      width: MEMBER_AVATAR_SIZE,
      height: MEMBER_AVATAR_SIZE,
    } satisfies MemberLayout;
  });
}

function getRescueSlot(bounds: GameBounds, rescuedIndex: number) {
  const cols = 6;
  const chipSize = MEMBER_AVATAR_SIZE;
  const gap = 8;
  const row = Math.floor(rescuedIndex / cols);
  const col = rescuedIndex % cols;
  const totalWidth = cols * chipSize + (cols - 1) * gap;
  const startX = (bounds.width - totalWidth) / 2;
  const startY = bounds.height - 54 + row * 38;

  return {
    x: startX + col * (chipSize + gap),
    y: startY,
    size: chipSize,
  };
}

function createInitialGame(bounds: GameBounds): GameState {
  const now = performance.now();
  const paddleX = bounds.width / 2;
  return {
    ball: {
      x: paddleX,
      y: getPaddleY(bounds) - BALL_RADIUS - START_BUTTON_HEIGHT / 2 - 6,
      vx: 0,
      vy: 0,
      radius: BALL_RADIUS,
    },
    paddleX,
    bricks: buildBricks(bounds),
    rescuedOrder: [],
    hitAt: {},
    pendingReleaseAt: {},
    releasedAt: {},
    relaunchAt: null,
    time: now,
    startedAt: null,
    endedAt: null,
    launched: false,
    status: "running",
    completionReason: null,
    finalScore: null,
  };
}

export default function MemberBreakoutGame({ members, onExitGame }: MemberBreakoutGameProps) {
  const frameRef = useRef<number | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const [bounds, setBounds] = useState<GameBounds>({ width: 0, height: 0 });
  const [game, setGame] = useState<GameState | null>(null);
  const hasGame = Boolean(game);
  const isRunning = game?.status === "running";

  const memberLayouts = useMemo(() => buildMemberLayouts(bounds, members), [bounds, members]);
  const confettiPieces = useMemo(
    () =>
      Array.from({ length: 28 }, (_, index) => ({
        id: index,
        color: BRICK_COLORS[index % BRICK_COLORS.length],
        angle: -78 + index * 5.8,
        distance: 92 + (index % 6) * 18,
        delay: (index % 7) * 0.03,
        rotate: -160 + index * 14,
        size: 6 + (index % 4) * 2,
      })).map((piece) => ({
        ...piece,
        dx: Math.cos((piece.angle * Math.PI) / 180) * piece.distance,
        dy: Math.sin((piece.angle * Math.PI) / 180) * piece.distance,
      })),
    []
  );
  const totalBreakableBricks = useMemo(
    () => buildBricks(bounds).filter((brick) => brick.alive).length,
    [bounds]
  );

  useEffect(() => {
    if (!boardRef.current) return;
    const node = boardRef.current;

    const updateBounds = () => {
      const next = {
        width: node.clientWidth,
        height: node.clientHeight,
      };
      setBounds((current) =>
        current.width === next.width && current.height === next.height ? current : next
      );
    };

    updateBounds();
    const observer = new ResizeObserver(() => updateBounds());
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!bounds.width || !bounds.height) return;
    const resetFrame = requestAnimationFrame(() => {
      setGame(createInitialGame(bounds));
    });
    return () => cancelAnimationFrame(resetFrame);
  }, [bounds, members.length]);

  useEffect(() => {
    if (!hasGame || !isRunning || !bounds.width || !bounds.height) return;

    let previous = performance.now();

    const step = (time: number) => {
      const dt = Math.min(32, time - previous) / 1000;
      previous = time;

      setGame((current) => {
        if (!current) return current;
        if (current.status !== "running") return current;

        const paddleWidth = getPaddleWidth(bounds);
        const paddleHalf = paddleWidth / 2;
        const paddleY = getPaddleY(bounds);
        const liveBrickCount = current.bricks.filter((brick) => brick.alive).length;
        const brokenRatio = totalBreakableBricks > 0 ? (totalBreakableBricks - liveBrickCount) / totalBreakableBricks : 0;
        const rescuedRatio = members.length > 0 ? current.rescuedOrder.length / members.length : 0;
        const speedTarget = BASE_SPEED + (brokenRatio * 0.82 + rescuedRatio * 0.18) * MAX_EXTRA_SPEED;

        let nextBall = { ...current.ball };
        let nextBricks = current.bricks;
        let nextHitAt = current.hitAt;
        let nextPendingReleaseAt = current.pendingReleaseAt;
        let nextReleasedAt = current.releasedAt;
        let nextRescuedOrder = current.rescuedOrder;
        let relaunchAt = current.relaunchAt;
        let launched = current.launched;
        const paddleHeight = START_BUTTON_HEIGHT;

        const readyRescues = Object.entries(nextPendingReleaseAt).filter(([, releaseAt]) => releaseAt <= time);
        if (readyRescues.length > 0) {
          nextPendingReleaseAt = { ...nextPendingReleaseAt };
          nextReleasedAt = { ...nextReleasedAt };
          nextHitAt = { ...nextHitAt };
          nextRescuedOrder = [...nextRescuedOrder];

          readyRescues.forEach(([memberId, releaseAt]) => {
            delete nextPendingReleaseAt[memberId];
            delete nextHitAt[memberId];
            nextReleasedAt[memberId] = releaseAt;
            if (!nextRescuedOrder.includes(memberId)) {
              nextRescuedOrder.push(memberId);
            }
          });
        }

        if (relaunchAt && time >= relaunchAt) {
          const launchOffset = clamp((current.paddleX - bounds.width / 2) / (bounds.width / 2), -0.65, 0.65);
          nextBall = {
            ...nextBall,
            x: current.paddleX,
            y: paddleY - nextBall.radius - START_BUTTON_HEIGHT / 2 - 6,
            vx: launchOffset * 52,
            vy: -BASE_SPEED,
          };
          relaunchAt = null;
          launched = true;
        }

        if (!launched && !relaunchAt) {
          nextBall.x = current.paddleX;
          nextBall.y = paddleY - nextBall.radius - paddleHeight / 2 - 6;
        } else if (!relaunchAt) {
          const magnitude = Math.hypot(nextBall.vx, nextBall.vy) || 1;
          nextBall.vx = (nextBall.vx / magnitude) * speedTarget;
          nextBall.vy = (nextBall.vy / magnitude) * speedTarget;

          const prevY = nextBall.y;
          nextBall.x += nextBall.vx * dt;
          nextBall.y += nextBall.vy * dt;

          if (nextBall.x - nextBall.radius <= BOARD_SIDE_PADDING) {
            nextBall.x = BOARD_SIDE_PADDING + nextBall.radius;
            nextBall.vx = Math.abs(nextBall.vx);
          } else if (nextBall.x + nextBall.radius >= bounds.width - BOARD_SIDE_PADDING) {
            nextBall.x = bounds.width - BOARD_SIDE_PADDING - nextBall.radius;
            nextBall.vx = -Math.abs(nextBall.vx);
          }

          if (nextBall.y - nextBall.radius <= 56) {
            nextBall.y = 56 + nextBall.radius;
            nextBall.vy = Math.abs(nextBall.vy);
          }

          if (
            nextBall.vy > 0 &&
            nextBall.y + nextBall.radius >= paddleY &&
            prevY + nextBall.radius <= paddleY &&
            nextBall.x >= current.paddleX - paddleHalf - 8 &&
            nextBall.x <= current.paddleX + paddleHalf + 8
          ) {
            const offset = clamp((nextBall.x - current.paddleX) / paddleHalf, -1, 1);
            nextBall.x = clamp(nextBall.x, current.paddleX - paddleHalf, current.paddleX + paddleHalf);
            nextBall.y = paddleY - nextBall.radius - 1;
            nextBall.vx = offset * speedTarget * 0.92;
            nextBall.vy = -Math.sqrt(Math.max(speedTarget ** 2 - nextBall.vx ** 2, speedTarget * 0.55));
          }

          const hitBrickIndex = current.bricks.findIndex(
            (brick) =>
              brick.alive &&
              nextBall.x + nextBall.radius >= brick.x &&
              nextBall.x - nextBall.radius <= brick.x + brick.width &&
              nextBall.y + nextBall.radius >= brick.y &&
              nextBall.y - nextBall.radius <= brick.y + brick.height
          );

          if (hitBrickIndex >= 0) {
            nextBricks = current.bricks.map((brick, index) =>
              index === hitBrickIndex ? { ...brick, alive: false } : brick
            );
            const brick = current.bricks[hitBrickIndex];
            const hitFromTop = prevY <= brick.y - nextBall.radius;
            const hitFromBottom = prevY >= brick.y + brick.height + nextBall.radius;
            if (hitFromTop || hitFromBottom) {
              nextBall.vy *= -1;
            } else {
              nextBall.vx *= -1;
            }
          }

          const hitMember = memberLayouts.find((layout) => {
            if (nextReleasedAt[layout.member.userId] || nextPendingReleaseAt[layout.member.userId]) return false;
            return (
              nextBall.x + nextBall.radius >= layout.x &&
              nextBall.x - nextBall.radius <= layout.x + layout.width &&
              nextBall.y + nextBall.radius >= layout.y &&
              nextBall.y - nextBall.radius <= layout.y + layout.height
            );
          });

          if (hitMember) {
            nextHitAt = { ...nextHitAt, [hitMember.member.userId]: time };
            nextPendingReleaseAt = {
              ...nextPendingReleaseAt,
              [hitMember.member.userId]: time + MEMBER_HIT_DELAY_MS,
            };
            nextBall.vy = -Math.abs(nextBall.vy);
          }

          if (nextBall.y - nextBall.radius > bounds.height) {
            nextBall = {
              ...nextBall,
              x: current.paddleX,
              y: paddleY - nextBall.radius - START_BUTTON_HEIGHT / 2 - 6,
              vx: 0,
              vy: 0,
            };
            relaunchAt = time + RELAUNCH_DELAY_MS;
          }
        } else {
          nextBall.x = current.paddleX;
          nextBall.y = paddleY - nextBall.radius - START_BUTTON_HEIGHT / 2 - 6;
        }

        const remainingBricks = nextBricks.filter((brick) => brick.alive).length;
        const rescuedAllMembers = members.length > 0 && nextRescuedOrder.length >= members.length;
        if (remainingBricks === 0 || rescuedAllMembers) {
          const finalScore =
            totalBreakableBricks * BRICK_SCORE + nextRescuedOrder.length * RESCUE_SCORE;
          return {
            ...current,
            ball: {
              ...nextBall,
              vx: 0,
              vy: 0,
            },
            bricks: nextBricks,
            rescuedOrder: nextRescuedOrder,
            hitAt: nextHitAt,
            pendingReleaseAt: nextPendingReleaseAt,
            releasedAt: nextReleasedAt,
            relaunchAt: null,
            time,
            endedAt: time,
            launched,
            status: "completed",
            completionReason: rescuedAllMembers ? "rescue" : "bricks",
            finalScore,
          };
        }

        return {
          ...current,
          ball: nextBall,
          bricks: nextBricks,
          rescuedOrder: nextRescuedOrder,
          hitAt: nextHitAt,
          pendingReleaseAt: nextPendingReleaseAt,
          releasedAt: nextReleasedAt,
          relaunchAt,
          time,
          launched,
        };
      });

      frameRef.current = window.requestAnimationFrame(step);
    };

    frameRef.current = window.requestAnimationFrame(step);
    return () => {
      if (frameRef.current) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [bounds, hasGame, isRunning, memberLayouts, members.length, totalBreakableBricks]);

  const elapsedSeconds = useMemo(() => {
    if (!game) return 0;
    if (!game.startedAt) return 0;
    const end = game.endedAt ?? game.time;
    return Math.max(0, (end - game.startedAt) / 1000);
  }, [game]);
  const elapsedWholeSeconds = Math.floor(elapsedSeconds);

  function restartGame() {
    if (!bounds.width || !bounds.height) return;
    setGame(createInitialGame(bounds));
  }

  function launchGame() {
    if (!bounds.width || !bounds.height) return;
    const now = performance.now();
    setGame((current) => {
      if (!current || current.launched || current.status !== "running") return current;
      const paddleY = getPaddleY(bounds);
      return {
        ...current,
        launched: true,
        startedAt: now,
        time: now,
        ball: {
          ...current.ball,
          x: current.paddleX,
          y: paddleY - current.ball.radius - START_BUTTON_HEIGHT / 2 - 6,
          vx: 24,
          vy: -BASE_SPEED,
        },
      };
    });
  }

  function movePaddle(clientX: number) {
    if (!boardRef.current || !bounds.width) return;
    const rect = boardRef.current.getBoundingClientRect();
    const localX = clientX - rect.left;
    const half = getPaddleWidth(bounds) / 2;
    const nextX = clamp(localX, BOARD_SIDE_PADDING + half, bounds.width - BOARD_SIDE_PADDING - half);
    setGame((current) => (current ? { ...current, paddleX: nextX } : current));
  }

  return (
    <div className="relative h-full min-h-full overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.48),_transparent_34%),linear-gradient(180deg,_#1f3357_0%,_#284976_48%,_#1b2640_100%)]">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(transparent_0%,transparent_96%,rgba(255,255,255,0.08)_100%),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:100%_100%,24px_24px,24px_24px]" />
      <div className="relative z-10 flex items-center justify-between px-5 pb-2 pt-5 text-white">
        <div>
          <p className="text-[11px] font-black tracking-[0.32em] text-white/70">XLATIN GAME</p>
          <h3 className="mt-1 text-[22px] font-black tracking-[-0.03em]">채팅방회원 구출하기</h3>
        </div>
        <div className="rounded-full border border-white/15 bg-white/10 px-3 py-2 text-right backdrop-blur">
          <p className="text-[11px] font-bold text-white/60">미션완료</p>
          <p className="text-sm font-bold text-white">{elapsedWholeSeconds}초</p>
        </div>
      </div>

      <div
        ref={boardRef}
        className="relative h-[calc(100vh-188px)] min-h-[calc(100vh-188px)] touch-none overflow-hidden px-0 pb-0"
        onPointerDown={(event) => movePaddle(event.clientX)}
        onPointerMove={(event) => movePaddle(event.clientX)}
        style={{ touchAction: "none" }}
      >
        {game?.bricks.map((brick) => (
          <div
            key={brick.id}
            className={`absolute rounded-[6px] border border-white/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_6px_14px_rgba(15,23,42,0.28)] transition-[opacity,transform] duration-300 ${
              brick.alive ? "opacity-100" : "scale-75 opacity-0"
            }`}
            style={{
              left: brick.x,
              top: brick.y,
              width: brick.width,
              height: brick.height,
              backgroundColor: brick.color,
            }}
          />
        ))}

        {memberLayouts.map((layout) => {
          const hitAt = game?.hitAt[layout.member.userId] ?? null;
          const pendingReleaseAt = game?.pendingReleaseAt[layout.member.userId] ?? null;
          const releasedAt = game?.releasedAt[layout.member.userId] ?? null;
          const rescuedIndex = game?.rescuedOrder.indexOf(layout.member.userId) ?? -1;
          const fallProgress = releasedAt ? clamp((game?.time ?? 0 - releasedAt) / RESCUE_FALL_MS, 0, 1) : 0;
          const rescueSlot = rescuedIndex >= 0 ? getRescueSlot(bounds, rescuedIndex) : null;
          const shouldRenderFallingAvatar = Boolean(releasedAt && rescueSlot && fallProgress < 1);
          const isHit = Boolean(hitAt && pendingReleaseAt && !releasedAt);
          const ownerRing = layout.member.role === "owner" ? "border-2 border-white shadow-[0_0_0_2px_#facc15]" : "";

          return (
            <div key={layout.member.userId}>
              <div
                className={`absolute transition-opacity duration-300 ${
                  releasedAt ? "opacity-0" : "opacity-100"
                }`}
                style={{
                  left: layout.x,
                  top: layout.y,
                  width: layout.width,
                  height: layout.height,
                }}
              >
                <div className={isHit ? "member-hit-shake" : ""}>
                  <Avatar
                    src={layout.member.profileImageUrl}
                    nickname={layout.member.nickname}
                    size={MEMBER_AVATAR_SIZE}
                    className={ownerRing}
                  />
                </div>
              </div>

              {shouldRenderFallingAvatar && rescueSlot && (
                <div
                  className="pointer-events-none absolute z-20"
                  style={{
                    left: layout.x + (rescueSlot.x - layout.x) * easeInOutCubic(fallProgress),
                    top: layout.y + (rescueSlot.y - layout.y) * easeInOutCubic(fallProgress),
                    transform: `rotate(${fallProgress * 14}deg)`,
                  }}
                >
                  <Avatar
                    src={layout.member.profileImageUrl}
                    nickname={layout.member.nickname}
                    size={MEMBER_AVATAR_SIZE}
                    className={ownerRing}
                  />
                </div>
              )}
            </div>
          );
        })}

        {game && (
          <div
            className="pointer-events-none absolute z-30 rounded-full bg-[#fff4a8] shadow-[0_0_18px_rgba(255,244,168,0.8)]"
            style={{
              left: game.ball.x - game.ball.radius,
              top: game.ball.y - game.ball.radius,
              width: game.ball.radius * 2,
              height: game.ball.radius * 2,
            }}
          />
        )}

        {game && (
          <button
            type="button"
            onClick={game.launched ? undefined : launchGame}
            className={`absolute z-20 -translate-x-1/2 border border-yellow-100 bg-yellow-300 px-5 shadow-[0_12px_24px_rgba(250,204,21,0.35)] will-change-transform ${
              game.launched
                ? "rounded-full"
                : "flex items-center justify-center rounded-full"
            }`}
            style={{
              left: game.paddleX,
              top: getPaddleY(bounds),
              width: getPaddleWidth(bounds),
              height: START_BUTTON_HEIGHT,
            }}
          >
            <span className="text-[13px] font-black text-gray-900">
              {game.launched ? "게임중" : "게임시작"}
            </span>
          </button>
        )}

        <button
          type="button"
          onClick={onExitGame}
          aria-label="게임 종료"
          className="absolute bottom-4 left-4 z-20 flex h-11 w-11 items-center justify-center rounded-full border border-white/18 bg-[#0f172a]/72 text-white shadow-[0_12px_24px_rgba(15,23,42,0.32)] transition hover:bg-[#162033]"
        >
          <Power size={18} strokeWidth={2.4} />
        </button>

        {game?.status === "completed" && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#0b1220]/68 backdrop-blur-[3px]">
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              {confettiPieces.map((piece) => (
                <span
                  key={piece.id}
                  className="confetti-piece absolute left-1/2 top-1/2"
                  style={{
                    width: piece.size,
                    height: piece.size * 1.8,
                    backgroundColor: piece.color,
                    ["--confetti-x" as string]: `${piece.dx}px`,
                    ["--confetti-y" as string]: `${piece.dy}px`,
                    ["--confetti-rotate" as string]: `${piece.rotate}deg`,
                    animationDelay: `${piece.delay}s`,
                  }}
                />
              ))}
            </div>
            <div className="mx-6 w-full max-w-[320px] rounded-[28px] border border-white/12 bg-[#0f172a]/72 px-6 py-7 text-center text-white shadow-[0_18px_60px_rgba(15,23,42,0.35)]">
              <p className="text-[11px] font-black uppercase tracking-[0.34em] text-yellow-200/90">Game Clear</p>
              <h4 className="mt-3 text-[28px] font-black tracking-[-0.04em]">
                {game.finalScore ?? 0}점
              </h4>
              <p className="mt-2 text-sm font-semibold text-white/78">
                {game.completionReason === "rescue"
                  ? `${elapsedSeconds.toFixed(1)}초 만에 회원구출을 성공했어요 !`
                  : `${elapsedSeconds.toFixed(1)}초 만에 벽돌을 모두 깼어요`}
              </p>
              <div className="mt-6 flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={onExitGame}
                  className="inline-flex h-11 items-center justify-center rounded-full border border-white/18 bg-white/10 px-6 text-sm font-black text-white transition hover:bg-white/16"
                >
                  끝내기
                </button>
                <button
                  type="button"
                  onClick={restartGame}
                  className="inline-flex h-11 items-center justify-center rounded-full bg-yellow-300 px-6 text-sm font-black text-gray-900 shadow-[0_12px_24px_rgba(250,204,21,0.3)] transition hover:bg-yellow-200"
                >
                  게임시작
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      <style jsx>{`
        .member-hit-shake {
          animation: member-hit-shake 0.26s ease-in-out;
        }

        .confetti-piece {
          border-radius: 999px;
          opacity: 0;
          transform: translate(-50%, -50%) rotate(0deg);
          animation: confetti-burst 0.95s ease-out forwards;
        }

        @keyframes member-hit-shake {
          0% { transform: translate3d(0, 0, 0) rotate(0deg); }
          20% { transform: translate3d(-4px, 0, 0) rotate(-8deg); }
          40% { transform: translate3d(4px, 0, 0) rotate(7deg); }
          60% { transform: translate3d(-3px, 0, 0) rotate(-5deg); }
          80% { transform: translate3d(3px, 0, 0) rotate(4deg); }
          100% { transform: translate3d(0, 0, 0) rotate(0deg); }
        }

        @keyframes confetti-burst {
          0% {
            opacity: 0;
            transform: translate(-50%, -50%) rotate(0deg) scale(0.8);
          }
          12% {
            opacity: 1;
          }
          100% {
            opacity: 0;
            transform:
              translate(
                calc(-50% + var(--confetti-x)),
                calc(-50% + var(--confetti-y))
              )
              rotate(var(--confetti-rotate))
              scale(1.05);
          }
        }
      `}</style>
    </div>
  );
}
