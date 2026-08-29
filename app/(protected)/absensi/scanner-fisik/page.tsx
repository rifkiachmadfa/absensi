import { requireAuth } from "@/lib/auth/session";
import { ScannerFisikClient } from "@/components/absensi/scanner-fisik/scanner-fisik-client";

export default async function ScannerFisikPage() {
  // Sama seperti /absensi: semua role login boleh melakukan absensi lewat
  // scanner fisik ini (Section 4 -- guru & wali kelas juga bisa piket).
  await requireAuth();

  return <ScannerFisikClient />;
}