// components/absensi/scanner-bridge-panel.tsx
"use client";

import { Bluetooth, BluetoothOff } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import type { ScannerBridgeScannerInfo, ScannerBridgeStatus } from "@/lib/scanner-bridge/scanner-bridge-client";
import type { ScannerBridgeLastScan } from "@/components/absensi/use-scanner-bridge";

function jamJakarta(ms: number) {
  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(new Date(ms));
}

// Panel khusus mode "Scanner Fisik" -- sengaja dipisah dari mode "Kamera"
// (lihat scan-dialog.tsx) supaya kamera HP TIDAK diminta izinnya sama sekali
// kalau guru/petugas memang cuma memakai scanner meja Bluetooth di PC.
// Panel ini murni tampilan status koneksi + feedback; tidak pernah memanggil
// endpoint absensi apa pun sendiri -- itu tetap tanggung jawab handleDetected
// di komponen induk (sama seperti kamera), berujung ke AttendanceService yang
// sama (Section 26 spesifikasi utama).
export function ScannerBridgePanel({
  status,
  scanners,
  lastScan,
}: {
  status: ScannerBridgeStatus;
  scanners: ScannerBridgeScannerInfo[];
  lastScan: ScannerBridgeLastScan | null;
}) {
  if (status === "connecting") {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-muted/40 py-10 text-sm text-muted-foreground">
        <Spinner className="size-5" />
        Menghubungkan ke scanner-bridge...
      </div>
    );
  }

  if (status === "disconnected" || scanners.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-muted/40 px-4 py-10 text-center">
        <BluetoothOff className="size-6 text-muted-foreground" />
        <p className="text-sm font-medium text-foreground">Scanner meja tidak terdeteksi</p>
        <p className="text-xs text-muted-foreground">
          Pastikan aplikasi scanner-bridge sedang berjalan di PC ini
          (<code className="rounded bg-muted px-1 py-0.5">scanner-bridge.exe --serve</code>).
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {scanners.map((s) => (
          <div
            key={s.id}
            className="flex items-center justify-between rounded-lg border border-border bg-[#EAF7F8] px-3 py-2"
          >
            <span className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Bluetooth className="size-4 text-[#22949E]" />
              {s.name}
            </span>
            <span className="rounded-full bg-[#22949E] px-2 py-0.5 text-xs font-medium text-white">
              Siap
            </span>
          </div>
        ))}
      </div>

      <div className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-border py-6 text-center">
        <span className="relative flex size-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#22949E] opacity-75" />
          <span className="relative inline-flex size-2.5 rounded-full bg-[#22949E]" />
        </span>
        <p className="mt-1.5 text-sm text-muted-foreground">Menunggu scan dari scanner meja...</p>
      </div>

      {lastScan && (
        <p className="text-center text-xs text-muted-foreground">
          Scan terakhir dari <span className="font-medium text-foreground">{lastScan.scannerName}</span> ·{" "}
          {jamJakarta(lastScan.time)}
        </p>
      )}
    </div>
  );
}