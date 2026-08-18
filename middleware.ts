import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Route dengan PREFIX yang tidak butuh login (jangan masukkan "/" di sini --
// startsWith("/") akan match SEMUA path dan mematikan proteksi seluruh app).
//
// "/api/cron" WAJIB ada di sini: dipanggil oleh Vercel Cron (server-to-server,
// lihat vercel.json), bukan browser dengan session -- jadi tidak pernah punya
// cookie login. Kalau tidak dikecualikan, middleware ini akan redirect ke
// /login SEBELUM request sampai ke handler-nya, sehingga pengecekan
// CRON_SECRET di app/api/cron/auto-alpha/route.ts tidak pernah tereksekusi
// dan job auto-ALPHA tidak akan pernah jalan. Proteksinya tetap ada, cuma
// bentuknya CRON_SECRET (dicek di dalam route handler), bukan session login.
const PUBLIC_ROUTE_PREFIXES = ["/login", "/cek-kehadiran", "/api/publik", "/api/cron"];

// Route yang harus EXACT MATCH "/" (root publik: dashboard info untuk orang
// tua/umum). Tidak pakai startsWith supaya tidak ikut membuka /siswa, /kelas, dll.
const PUBLIC_EXACT_ROUTES = ["/"];

export async function middleware(request: NextRequest) {
  const { response, user } = await updateSession(request);

  const pathname = request.nextUrl.pathname;
  const isPublicRoute =
    PUBLIC_EXACT_ROUTES.includes(pathname) ||
    PUBLIC_ROUTE_PREFIXES.some((route) => pathname.startsWith(route));

  // Belum login & akses halaman terproteksi -> redirect ke /login
  if (!user && !isPublicRoute) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Sudah login & akses /login -> redirect ke dashboard
  if (user && pathname.startsWith("/login")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Jalankan middleware di semua route KECUALI:
     * - static files, _next, favicon, gambar
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};