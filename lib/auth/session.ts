import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { AUTH_USER_ID_HEADER } from "@/lib/supabase/middleware";
import { prisma } from "../prisma";
import type { User as AppUser } from "@/app/generated/prisma/client";

export type SessionUser = Pick<
  AppUser,
  "id" | "email" | "name" | "role" | "isActive"
>;

/**
 * Ambil user yang sedang login + data role dari Prisma.
 * Di-cache per-request agar tidak query berulang kali dalam satu render.
 *
 * PENTING soal auth.getUser() (network call ke Supabase Auth, BUKAN baca
 * cookie lokal -- itu memang desain library-nya demi keamanan):
 * middleware.ts SUDAH memanggilnya sekali untuk setiap request yang lewat
 * matcher-nya (lihat lib/supabase/middleware.ts) dan menitipkan hasilnya
 * lewat header AUTH_USER_ID_HEADER. Karena request itu mustahil sampai ke
 * sini tanpa lolos middleware lebih dulu, memanggil auth.getUser() LAGI di
 * sini untuk request yang sama hanya menduplikasi round trip jaringan yang
 * sudah dilakukan middleware, tanpa validasi tambahan apa pun.
 *
 * Header ini tidak bisa dipalsukan client: middleware SELALU
 * meng-overwrite-nya (requestHeaders.set(...), bukan menambahkan) sebelum
 * meneruskan request, jadi apa pun yang client kirim sendiri di header ini
 * tidak pernah sampai ke sini.
 *
 * Fallback ke auth.getUser() tetap disediakan untuk pemanggilan di luar
 * request yang lewat middleware (mis. script/cron/test) -- di situ header
 * ini tidak ada sama sekali.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const headerList = await headers();
  const headerUserId = headerList.get(AUTH_USER_ID_HEADER);

  let authUserId: string | null;

  if (headerUserId !== null) {
    // Request ini sudah lewat middleware -- percaya hasil validasinya,
    // string kosong berarti middleware sudah memastikan belum login.
    authUserId = headerUserId || null;
  } else {
    // Tidak lewat middleware (mis. dipanggil dari script/cron) -- baru di
    // sini fallback ke network call langsung ke Supabase Auth.
    const supabase = await createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    authUserId = authUser?.id ?? null;
  }

  if (!authUserId) return null;

  const appUser = await prisma.user.findUnique({
    where: { id: authUserId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
    },
  });

  if (!appUser || !appUser.isActive) return null;

  return appUser;
});

/**
 * Wajib dipanggil di Server Component/Action yang butuh user login.
 *
 * PENTING soal redirect target -- JANGAN ganti balik ke redirect("/login")
 * di sini walau kelihatannya lebih sederhana:
 *
 * middleware.ts sudah memastikan siapa pun yang sampai ke Server
 * Component ini PASTI punya sesi Supabase Auth yang valid (kalau tidak,
 * middleware sudah redirect ke /login duluan sebelum halaman ini pernah
 * dirender). Jadi kalau getCurrentUser() di atas tetap balikin null di
 * titik ini, artinya bukan "belum login" -- tapi sesi "yatim": login
 * Supabase Auth-nya valid, tapi baris di tabel User (Prisma) untuk akun
 * itu tidak ada/nonaktif (akun baru dibuat langsung dari Supabase
 * dashboard tanpa lewat scripts/create-superadmin.ts, akun
 * dinonaktifkan, atau baris User terhapus).
 *
 * Kalau redirect biasa ke "/login" dipakai untuk kasus ini, akan terjadi
 * infinite redirect loop (307 terus-menerus / "too many redirects" di
 * browser):
 *   /dashboard -> layout: tidak ada di tabel User -> redirect ke /login
 *   /login     -> middleware: sesi Supabase MASIH valid -> redirect ke /dashboard
 *   (ulang tanpa henti)
 * Ini terjadi karena redirect() dari Server Component TIDAK BOLEH
 * menghapus cookie sesi (Next.js hanya izinkan mutasi cookie di Server
 * Action / Route Handler) -- jadi sesi yatim itu tidak pernah benar-benar
 * ke-sign-out, dan middleware terus menganggapnya "sudah login".
 *
 * Karena itu redirect ke Route Handler /api/auth/session-repair, yang
 * benar-benar sign-out (hapus cookie) sebelum redirect ke /login --
 * memutus loop-nya secara permanen.
 */
export async function requireAuth(): Promise<SessionUser> {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/api/auth/session-repair");
  }

  return user;
}