import { requireAuth } from "@/lib/auth/session";
import { AbsensiClient } from "@/components/absensi/absensi-client";

export default async function AbsensiPage() {
  const user = await requireAuth();
  const canEditStatus = ["ADMIN", "SUPERADMIN", "WALI_KELAS"].includes(user.role);

  return <AbsensiClient canEditStatus={canEditStatus} />;
}