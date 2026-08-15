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