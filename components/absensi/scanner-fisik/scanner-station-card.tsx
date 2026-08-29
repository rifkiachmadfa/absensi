// components/absensi/scanner-fisik/scanner-station-card.tsx
"use client";

import { Bluetooth } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScanLiveCard } from "@/components/absensi/scan-live-card";
import { ScanQueuePanel } from "@/components/absensi/scan-queue-panel";
import type { ScannerStation } from "@/components/absensi/scanner-fisik/use-scanner-stations";

// Satu kartu = satu scanner meja fisik, dengan identitas & riwayat scan-nya
// SENDIRI -- tidak tercampur dengan scanner lain. `ScanLiveCard` &
// `ScanQueuePanel` dipakai ulang apa adanya dari dialog Scan Absensi
// (Section 39: jangan membuat komponen tampilan duplikat); yang baru hanya
// cara datanya di-partisi per scanner (lihat use-scanner-stations.ts).
export function ScannerStationCard({ station }: { station: ScannerStation }) {
  const successCount = station.items.filter((i) => i.status === "success").length;

  return (
    <Card className="p-4">
      <CardHeader className="px-0 pb-1">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Bluetooth className="size-4 text-[#22949E]" />
            {station.info.name}
          </CardTitle>
          <Badge variant="outline" className="border-[#22949E]/30 bg-[#EAF7F8] text-[#22949E]">
            Siap
          </Badge>
        </div>
      </CardHeader>

      <div className="space-y-3">
        <ScanLiveCard item={station.items[0]} />

        <p className="text-right text-xs text-muted-foreground">
          {successCount} berhasil di scanner ini sesi ini
        </p>

        {station.items.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border py-4 text-center text-xs text-muted-foreground">
            Belum ada scan dari scanner ini.
          </p>
        ) : (
          <ScanQueuePanel items={station.items} />
        )}
      </div>
    </Card>
  );
}