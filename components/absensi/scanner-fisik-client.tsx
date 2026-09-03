// components/absensi/scanner-fisik/scanner-fisik-client.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, BluetoothOff, LogIn, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScannerStationCard } from "@/components/absensi/scanner-fisik/scanner-station-card";
import {
  useScannerStations,
  type AbsensiStationMode,
} from "@/components/absensi/scanner-fisik/use-scanner-stations";

// Halaman khusus untuk banyak scanner meja fisik sekaligus (Section 8.1 &
// scanner-bridge Phase 9/10) -- setiap scanner yang terhubung ke
// scanner-bridge lokal mendapat kartu SENDIRI dengan riwayat scan yang
// TERPISAH dari scanner lain, supaya guru/petugas piket bisa langsung tahu
// scanner mana yang memproses siswa mana. Tab "Masuk"/"Pulang" hanya
// mengubah endpoint tujuan (Section 9: AttendanceService yang sama untuk
// keduanya) -- koneksi ke scanner-bridge TIDAK diputus saat berpindah tab.
export function ScannerFisikClient() {
  const [mode, setMode] = useState<AbsensiStationMode>("masuk");
  const { bridgeStatus, stations } = useScannerStations(mode);

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" render={<Link href="/absensi" />}>
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold text-foreground sm:text-2xl">Scanner Fisik</h1>
            <p className="text-sm text-muted-foreground">
              Absensi lewat scanner meja fisik, satu kartu &amp; riwayat per scanner.
            </p>
          </div>
        </div>

        <Tabs value={mode} onValueChange={(v) => setMode(v as AbsensiStationMode)}>
          <TabsList>
            <TabsTrigger value="masuk" className="gap-1.5">
              <LogIn className="size-3.5" />
              Absen Masuk
            </TabsTrigger>
            <TabsTrigger value="pulang" className="gap-1.5">
              <LogOut className="size-3.5" />
              Absen Pulang
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {bridgeStatus === "connecting" && stations.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-muted/40 py-16 text-sm text-muted-foreground">
          <Spinner className="size-5" />
          Menghubungkan ke scanner-bridge...
        </div>
      )}

      {bridgeStatus === "disconnected" && stations.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-muted/40 px-4 py-16 text-center">
          <BluetoothOff className="size-6 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">Tidak ada scanner meja terdeteksi</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            Pastikan aplikasi scanner-bridge sedang berjalan di PC ini
            (<code className="rounded bg-muted px-1 py-0.5">scanner-bridge.exe --serve</code>) dan
            scanner sudah terpasang.
          </p>
        </div>
      )}

      {stations.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {stations.map((station) => (
            <ScannerStationCard key={station.info.id} station={station} />
          ))}
        </div>
      )}
    </div>
  );
}