// components/absensi/scanner-fisik/scanner-station-card.tsx
"use client";

import { Bluetooth } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScanLiveCard } from "@/components/absensi/scan-live-card";
import { ScanQueuePanel } from "@/components/absensi/scan-queue-panel";
import type { ScannerStation } from "@/components/absensi/scanner-fisik/use-scanner-stations";

// Satu kartu = satu scanner meja fisik yang terdaftar di scanner-bridge
// (Section 39: pakai ulang ScanLiveCard & ScanQueuePanel yang sudah ada di
// dialog Scan Absensi -- tidak ada komponen tampilan duplikat, hanya
// sumber datanya yang dipartisi per scanner lewat useScannerStations).
// Beda dari ScannerFisikCard (legacy, dipakai components/absensi/
// scanner-fisik-client.tsx yang lama): di sini props-nya satu object
// `station` (bentuk dari useScannerStations), bukan scannerId/scannerName/
// items terpisah.
export function ScannerStationCard({ station }: { station: ScannerStation }) {
  const { info, items } = station;
  const successCount = items.filter((i) => i.status === "success").length;

  return (
    <Card className="p-4" data-scanner-id={info.id}>
      <CardHeader className="px-0 pb-1">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Bluetooth className="size-4 text-[#22949E]" />
            {info.name}
          </CardTitle>
          <Badge variant="outline" className="border-[#22949E]/30 bg-[#EAF7F8] text-[#22949E]">
            Siap
          </Badge>
        </div>
      </CardHeader>

      <div className="space-y-3">
        <ScanLiveCard item={items[0]} />

        <p className="text-right text-xs text-muted-foreground">
          {successCount} berhasil di scanner ini sesi ini
        </p>

        {items.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border py-4 text-center text-xs text-muted-foreground">
            Belum ada scan dari scanner ini.
          </p>
        ) : (
          <ScanQueuePanel items={items} />
        )}
      </div>
    </Card>
  );
}