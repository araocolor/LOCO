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

  // 토큰 갱신만 담당 (만료된 쿠키를 새로고침). 로그인 차단은 각 레이아웃에서 처리.
  // 인증 서버가 느리면 짧은 제한 시간 후 그냥 통과시켜 504(미들웨어 타임아웃)를 방지한다.
  try {
    await Promise.race([
      supabase.auth.getUser(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("auth timeout")), 3000)
      ),
    ]);
  } catch {
    // 인증 서버 지연/실패 시 토큰 갱신을 건너뛰고 요청을 통과시킨다.
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
