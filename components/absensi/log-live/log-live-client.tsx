// components/absensi/log-live/log-live-client.tsx
"use client";

import Link from "next/link";
import { ArrowLeft, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LiveLogPanel } from "@/components/absensi/live-log/live-log-panel";

// Halaman penuh untuk "Log Live Absensi", pola yang sama dengan
// /absensi/scanner-fisik (Section 8.1) -- sebelumnya panel ini nempel di
// dalam dialog Scan Absensi/Scan Pulang, sekarang dipindah jadi halaman
// sendiri supaya bisa dibuka & dibiarkan terbuka terpisah dari proses
// scan itu sendiri (mis. di layar kedua meja piket). Tidak ada logic
// baru di sini -- murni pakai ulang LiveLogPanel + useLiveScanLog yang
// sudah ada (Section 39: tidak membuat duplicate service/komponen).
export function LogLiveClient() {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" render={<Link href="/absensi" />}>
          <ArrowLeft className="size-4" />
        </Button>
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-foreground sm:text-2xl">
            <Radio className="size-5 text-[#22949E]" />
            Log Live Absensi
          </h1>
          <p className="text-sm text-muted-foreground">
            Aktivitas scan dari semua perangkat &amp; scanner, langsung diperbarui.
          </p>
        </div>
      </div>

      {/* Halaman ini selalu "terbuka" (bukan dialog), jadi subscribe ke
         broadcast berjalan selama halaman ini di-mount -- lihat catatan
         `enabled: open` di LiveLogPanel/useLiveScanLog untuk pola yang
         sama di dalam dialog. */}
      <LiveLogPanel open={true} />
    </div>
  );
}