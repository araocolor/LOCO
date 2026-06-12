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
  // 인증 서버를 기다려 차단하지 않으므로 모바일에서 504/튕김이 발생하지 않음.
  await supabase.auth.getUser();

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
