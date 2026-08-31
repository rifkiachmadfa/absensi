import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Nama header internal yang dipakai middleware ini untuk "menitipkan" hasil
// auth.getUser() (yang sudah tervalidasi lewat 1 network round trip ke
// Supabase Auth di sini) ke Server Component/Route Handler di belakangnya --
// lihat getCurrentUser() di lib/auth/session.ts. Tujuannya supaya
// auth.getUser() TIDAK dipanggil ulang (network round trip kedua) untuk
// request yang sama.
//
// AMAN dari spoofing: requestHeaders.set() di bawah SELALU meng-overwrite
// header ini dari NextRequest yang masuk sebelum diteruskan ke handler --
// jadi walau client mengirim header ini secara manual, nilainya tetap
// ditimpa oleh apa yang middleware tentukan sendiri (kosong kalau belum
// login, id user kalau sudah). Client tidak pernah bisa membuat handler di
// belakang melihat header ini sebagai nilai yang mereka kirim sendiri.
export const AUTH_USER_ID_HEADER = "x-auth-user-id";

export async function updateSession(request: NextRequest) {
  // Header request diteruskan lewat NextResponse.next({ request: { headers } })
  // di bawah -- BUKAN response.headers, yang hanya sampai ke browser, bukan
  // ke Route Handler/Server Component berikutnya dalam pipeline yang sama.
  const requestHeaders = new Headers(request.headers);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },

        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Selalu di-set (bukan cuma saat ada user) supaya nilai lama/tercemar
  // (mis. header ini "kebawa" dari request client) tidak pernah lolos ke
  // handler saat sesi sebenarnya tidak valid.
  requestHeaders.set(AUTH_USER_ID_HEADER, user?.id ?? "");

  return {
    response,
    user,
  };
}