import "server-only";
import { redirect } from "next/navigation";
import { requireAuth, type SessionUser } from "./session";
import type { UserRole } from "@/app/generated/prisma/enums";

/**
 * Wajib dipanggil di Server Component/Action yang butuh role tertentu.
 * Contoh: await requireRole(["SUPERADMIN", "ADMIN"])
 */
export async function requireRole(
  allowedRoles: UserRole[]
): Promise<SessionUser> {
  const user = await requireAuth();

  if (!allowedRoles.includes(user.role)) {
    redirect("/unauthorized");
  }

  return user;
}

/**
 * Versi lebih fleksibel dari requireRole: menerima fungsi cek dari
 * lib/auth/permissions.ts, termasuk yang butuh konteks (mis. kelas).
 * Contoh: await requirePermission((u) => canCreateStudent(u, homeroomTeacherId))
 */
export async function requirePermission(
  check: (user: SessionUser) => boolean
): Promise<SessionUser> {
  const user = await requireAuth();

  if (!check(user)) {
    redirect("/unauthorized");
  }

  return user;
}