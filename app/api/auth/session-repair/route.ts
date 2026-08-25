// app/api/auth/session-repair/route.ts
//
// Dipanggil HANYA oleh lib/auth/session.ts (requireAuth) ketika ditemukan
// sesi "yatim": login Supabase Auth valid, tapi tidak ada baris aktif di
// tabel User (Prisma) untuk akun tersebut -- lihat komentar panjang di
// requireAuth() untuk kronologi bug 307 infinite redirect loop yang
// route ini perbaiki.
//
// PENTING soal cara bikin response di sini -- JANGAN pakai
// lib/supabase/server.ts (createClient) lalu NextResponse.redirect()
// terpisah walau kelihatan lebih ringkas:
//
// lib/supabase/server.ts membaca/menulis cookie lewat cookies() dari
// next/headers. Di Route Handler, next/headers cookies().set() memang
// DIIZINKAN, tapi mutasinya hanya otomatis ter-serialize ke response kalau
// Next.js yang membangun response secara implisit. Begitu kita bikin dan
// return objek Response/NextResponse SENDIRI (wajib untuk redirect),
// mutasi cookie dari next/headers itu TIDAK ikut terbawa -- akibatnya
// supabase.auth.signOut() "berhasil" tanpa error, tapi cookie sesi di
// browser TIDAK benar-benar terhapus. Middleware di request berikutnya
// masih melihat user sebagai login, dan /login?notice=session-expired
// jadi terasa "looping" terus walau requireAuth() sudah benar mengirim ke
// sini.
//
// Solusinya: bangun `response` (NextResponse.redirect) LEBIH DULU --
// persis pola yang sudah dipakai lib/supabase/middleware.ts -- lalu
// pasang setiap cookie yang mau di-clear langsung ke response.cookies
// itu, baru di-return. Ini menjamin Set-Cookie header-nya benar-benar
// terkirim ke browser bersamaan dengan redirect-nya.
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function GET(request: NextRequest) {
  const response = NextResponse.redirect(
    new URL("/login?notice=session-expired", request.url)
  );

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  await supabase.auth.signOut();

  return response;
}