import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // 1번: 쿠키에 인증 세션이 없으면 즉시 로그인으로 (네트워크 호출 없음)
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    const { pathname } = request.nextUrl;
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }

  // 2번: 토큰 검증은 제한 시간(2.5초)을 두고, 초과·실패 시 로그인으로 (Fail-Close)
  const TIMEOUT_MS = 2500;
  const verify = supabase.auth.getUser().then(({ data }) => data.user);
  const timeout = new Promise<"timeout">((resolve) =>
    setTimeout(() => resolve("timeout"), TIMEOUT_MS)
  );
  const user = await Promise.race([verify, timeout]);

  // 검증 미완료(시간 초과)·사용자 없음 모두 로그인으로 안전하게 차단
  if (user === "timeout" || !user) {
    const { pathname } = request.nextUrl;
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    "/",
    "/classes/:path*",
    "/messages/:path*",
    "/mypage/:path*",
    "/notifications/:path*",
    "/onboarding/:path*",
  ],
};
