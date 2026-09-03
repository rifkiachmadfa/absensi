import { requireAuth } from "@/lib/auth/session";
import { LogLiveClient } from "@/components/absensi/log-live/log-live-client";

export default async function LogLivePage() {
  // Sama seperti /absensi & /absensi/scanner-fisik: semua role login boleh
  // melihat Log Live (Section 4 -- guru & wali kelas juga piket absensi).
  await requireAuth();

  return <LogLiveClient />;
}