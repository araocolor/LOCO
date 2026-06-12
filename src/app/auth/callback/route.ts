import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

function getSafeNextPath(next: string | null) {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/";
  if (!/^\/[A-Za-z0-9/_\-?=&.%]*$/.test(next)) return "/";
  return next;
}

function appRedirect(deepLink: string, webFallback: string) {
  const safeDeep = JSON.stringify(deepLink).replace(/</g, "\\u003c");
  const safeWeb = JSON.stringify(webFallback).replace(/</g, "\\u003c");
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>
<script>window.location.href=${safeDeep};setTimeout(function(){window.location.href=${safeWeb}},2000);</script>
</body></html>`;
  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = getSafeNextPath(searchParams.get("next"));
  const isApp = searchParams.get("app") === "1";

  if (code) {
    if (isApp) {
      const appParams = new URLSearchParams({ code, next });
      return appRedirect(`xlatin://auth-callback?${appParams}`, `${origin}${next}`);
    }

    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("nickname, region, favorite_genre, gender")
          .eq("id", user.id)
          .maybeSingle();

        const hasGenres =
          Array.isArray(profile?.favorite_genre) &&
          profile.favorite_genre.length > 0;

        if (!profile?.nickname || !profile?.region || !profile?.gender || !hasGenres) {
          return NextResponse.redirect(`${origin}/onboarding`);
        }
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  if (isApp) return appRedirect("xlatin://login?error=auth", `${origin}/login?error=auth`);
  return NextResponse.redirect(`${origin}/login?error=auth`);
}
