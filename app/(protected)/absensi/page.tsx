import { requireAuth } from "@/lib/auth/session";
import { AbsensiClient } from "@/components/absensi/absensi-client";

export default async function AbsensiPage() {
  // Semua role login boleh mengubah status kehadiran siswa mana pun.
  await requireAuth();

  return <AbsensiClient canEditStatus={true} />;
}