import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { kommoGate } from "@/lib/kommo/gate";

function safeNext(raw: string | null): URL | null {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/login")) return null;
  try {
    const url = new URL(raw, "http://local");
    if (url.origin !== "http://local" || url.pathname.startsWith("/login")) return null;
    return url;
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.next();

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;
  const isLogin = path.startsWith("/login");
  const gate = kommoGate(path, request.method, Boolean(data.user));

  if (gate === "login") {
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/login";
    redirect.search = `?next=${encodeURIComponent(`${path}${request.nextUrl.search}`)}`;
    return NextResponse.redirect(redirect);
  }

  if (gate === "unauthorized") {
    return NextResponse.json(
      { error: "Entre para usar esta parte do comercial." },
      { status: 401, headers: { "Cache-Control": "private, no-store" } },
    );
  }

  if (data.user && isLogin) {
    const target = safeNext(request.nextUrl.searchParams.get("next"));
    const redirect = request.nextUrl.clone();
    redirect.pathname = target?.pathname || "/";
    redirect.search = target?.search || "";
    return NextResponse.redirect(redirect);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
