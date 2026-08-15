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
 * Redirect ke /login jika belum login atau akun nonaktif.
 */
export async function requireAuth(): Promise<SessionUser> {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}