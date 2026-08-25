import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "../prisma";
import type { User as AppUser } from "@/app/generated/prisma/client";

export type SessionUser = Pick<
  AppUser,
  "id" | "email" | "name" | "role" | "isActive"
>;

/**
 * Ambil user yang sedang login (Supabase Auth) + data role dari Prisma.
 * di-cache per-request agar tidak query berulang kali dalam satu render.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient();

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) return null;

  const appUser = await prisma.user.findUnique({
    where: { id: authUser.id },
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