// 웜업(프리로드) 관리자
// 흩어진 캐시 프리로드를 한 곳에서 우선순위대로 통제한다.
// 첫 화면을 막지 않도록 브라우저 유휴 시간에 순서대로 실행한다.

export type WarmupTask = {
  // 같은 이름은 한 번만 실행된다(중복 웜업 방지).
  name: string;
  // 우선순위: 숫자가 작을수록 먼저. (1: 메인, 2: 메시지, 3: 서치 ...)
  priority: number;
  // 실패해도 전체 흐름을 막지 않는다. 내부에서 에러를 삼킨다.
  run: () => Promise<void> | void;
};

const registry = new Map<string, WarmupTask>();
const done = new Set<string>();
let started = false;
let running = false;
let abortController: AbortController | null = null;

export function getWarmupSignal(): AbortSignal | undefined {
  return abortController?.signal ?? undefined;
}

// requestIdleCallback 폴백: 웹뷰/Safari 미지원 환경 대비.
// 표준 동작을 흉내 낸다. 프레임마다 그리기에 남는 여유 시간을 보고,
// 여유가 있으면 실행하고 없으면 다음 프레임으로 미룬다.
function onIdle(cb: () => void) {
  const ric = (globalThis as { requestIdleCallback?: (cb: () => void) => void }).requestIdleCallback;
  if (typeof ric === "function") {
    ric(cb);
    return;
  }

  const raf = (globalThis as { requestAnimationFrame?: (cb: (t: number) => void) => void }).requestAnimationFrame;
  if (typeof raf !== "function") {
    setTimeout(cb, 1);
    return;
  }

  // 한 프레임(약 16ms) 중 그리기에 쓰고 남는 여유가 생길 때까지 다음 프레임으로 미룬다.
  const FRAME_BUDGET = 16;
  const IDLE_MARGIN = 8;
  function tick(frameStart: number) {
    const elapsed = performance.now() - frameStart;
    if (FRAME_BUDGET - elapsed >= IDLE_MARGIN) {
      cb();
    } else {
      raf!((t) => tick(t));
    }
  }
  raf((t) => tick(t));
}

// 웜업 작업을 등록한다(아직 실행하지 않음).
export function registerWarmup(task: WarmupTask) {
  if (!registry.has(task.name)) registry.set(task.name, task);
}

async function drain() {
  if (running) return;
  running = true;

  const pending = [...registry.values()]
    .filter((t) => !done.has(t.name))
    .sort((a, b) => a.priority - b.priority);

  for (const task of pending) {
    done.add(task.name);
    try {
      await task.run();
    } catch {
      // 웜업 실패는 무시한다. 화면은 실제 진입 시 다시 시도한다.
    }
    // 한 작업 끝날 때마다 유휴 시점을 양보해 첫 화면을 막지 않는다.
    await new Promise<void>((resolve) => onIdle(resolve));
  }

  running = false;
}

// 로그인 확정 후 1회 호출. 등록된 웜업을 유휴 시간에 순서대로 실행한다.
export function startWarmup() {
  if (started) return;
  started = true;
  abortController = new AbortController();
  onIdle(() => {
    void drain();
  });
}

// 로그아웃 등으로 상태를 비울 때 사용(다음 로그인에서 다시 웜업).
export function resetWarmup() {
  if (abortController) {
    abortController.abort();
    abortController = null;
  }
  started = false;
  running = false;
  done.clear();
}
