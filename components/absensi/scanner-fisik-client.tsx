// components/absensi/scanner-fisik-client.tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Bluetooth, BluetoothOff, LogIn, LogOut, ScanBarcode } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { ScannerFisikCard } from "@/components/absensi/scanner-fisik-card";
import { useScannerBridge } from "@/components/absensi/use-scanner-bridge";
import { useScannerQueues } from "@/components/absensi/use-scanner-queues";
import { playScanBeep } from "@/lib/audio/beep";
import { cn } from "@/lib/utils";
import type {
  AttendanceCheckInResponse,
  AttendanceCheckOutResponse,
} from "@/lib/types/attendance";

// Halaman khusus untuk scanner meja fisik (scanner-bridge lokal, Phase 9/10
// -- lihat lib/scanner-bridge/scanner-bridge-client.ts), TERPISAH dari
// dialog "Scan Absensi"/"Scan Pulang" di /absensi (yang fokus ke kamera HP).
// Satu kartu ditampilkan PER unit scanner yang dilaporkan bridge lewat
// pesan "hello" -- jumlahnya mengikuti apa adanya (2 scanner -> 2 kartu, 4
// scanner -> 4 kartu), dan tiap kartu punya antrian/log hasil scan-nya
// SENDIRI (useScannerQueues, key = scannerId) supaya scan di satu unit
// tidak pernah muncul di log unit lain.
//
// Sama seperti dialog kamera: halaman ini TIDAK melakukan identifikasi
// siswa, cek duplikat, atau penentuan status apa pun sendiri. Setiap scan
// diteruskan ke endpoint yang SAMA PERSIS dipakai kamera HP
// (/api/absensi/scan untuk masuk, /api/absensi/scan-pulang untuk pulang),
// diproses satu transaksi oleh AttendanceService (Section 26 spesifikasi
// utama). Toggle Masuk/Pulang di sini murni memilih endpoint tsb -- berlaku
// untuk SEMUA kartu/scanner sekaligus (satu sesi meja absensi biasanya
// memang satu arah dulu, baru ganti arah).

type Direction = "masuk" | "pulang";

// Dibungkus dengan `direction` supaya classify() tahu persis respons ini
// datang dari request masuk atau pulang, TANPA menebak dari bentuk field
// (AttendanceCheckInResponse & AttendanceCheckOutResponse sama-sama punya
// varian "SUCCESS" yang bentuknya mirip). `direction` diambil dari ref
// pada SAAT scan dikirim (bukan dibaca ulang dari state saat classify
// dipanggil), supaya kalau guru sempat toggle Masuk/Pulang selagi request
// sebelumnya masih berjalan, hasilnya tetap diklasifikasikan sesuai arah
// yang benar-benar dikirim.
type DirectedResult =
  | { direction: "masuk"; data: AttendanceCheckInResponse }
  | { direction: "pulang"; data: AttendanceCheckOutResponse };

function jamJakarta(iso: string) {
  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(new Date(iso));
}

function notify(result: DirectedResult) {
  const { direction, data } = result;

  if (data.type === "SUCCESS") {
    if (direction === "masuk") {
      toast.success(`${data.student.name} berhasil absen`, {
        description: `${data.status} · ${data.student.className} · ${jamJakarta(data.time)}`,
      });
    } else {
      toast.success(`${data.student.name} berhasil absen pulang`, {
        description: `${data.student.className} · ${jamJakarta(data.time)}`,
      });
    }
    return;
  }
  if (data.type === "ALREADY_CHECKED_IN") {
    toast.warning(`${data.student.name} sudah absen`, {
      description: `Tercatat pada ${jamJakarta(data.time)}`,
    });
    return;
  }
  if (data.type === "ALREADY_CHECKED_OUT") {
    toast.warning(`${data.student.name} sudah absen pulang`, {
      description: `Tercatat pada ${jamJakarta(data.time)}`,
    });
    return;
  }
  if (data.type === "NOT_CHECKED_IN") {
    toast.error(`${data.student.name} belum absen masuk hari ini`);
    return;
  }
  if (data.type === "STUDENT_INACTIVE") {
    toast.error(`${data.student.name} berstatus nonaktif`);
    return;
  }
  if (data.type === "SCHOOL_CLOSED") {
    toast.error("Hari ini libur, absensi tidak aktif.");
    return;
  }
  toast.error("QR Code tidak dikenali oleh sistem");
}

function classifyResult(result: DirectedResult) {
  const { direction, data } = result;

  if (data.type === "SUCCESS") {
    return {
      status: "success" as const,
      label: data.student.name,
      detail:
        direction === "masuk"
          ? `${data.status} · ${jamJakarta(data.time)}`
          : `Pulang · ${jamJakarta(data.time)}`,
      meta: { className: data.student.className },
    };
  }
  if (data.type === "ALREADY_CHECKED_IN") {
    return {
      status: "warning" as const,
      label: data.student.name,
      detail: `Sudah absen · ${jamJakarta(data.time)}`,
      meta: { className: data.student.className },
    };
  }
  if (data.type === "ALREADY_CHECKED_OUT") {
    return {
      status: "warning" as const,
      label: data.student.name,
      detail: `Sudah absen pulang · ${jamJakarta(data.time)}`,
      meta: { className: data.student.className },
    };
  }
  if (data.type === "NOT_CHECKED_IN") {
    return {
      status: "error" as const,
      label: data.student.name,
      detail: "Belum absen masuk",
      meta: { className: data.student.className },
    };
  }
  if (data.type === "STUDENT_INACTIVE") {
    return { status: "error" as const, label: data.student.name, detail: "Siswa nonaktif" };
  }
  if (data.type === "SCHOOL_CLOSED") {
    return { status: "error" as const, label: "Hari ini libur" };
  }
  return {
    status: "error" as const,
    label: "QR tidak dikenali",
    detail: "Kartu siswa tidak dikenali oleh sistem",
  };
}

export function ScannerFisikClient() {
  const [direction, setDirection] = useState<Direction>("masuk");
  const directionRef = useRef(direction);
  useEffect(() => {
    directionRef.current = direction;
  }, [direction]);

  // Daftar scanner yang PERNAH terlihat, digabung dari pesan "hello" (lewat
  // useScannerBridge) DAN dari scanner mana pun yang ternyata terbaca
  // langsung lewat event scan (jaga-jaga kalau ada unit yang baru
  // tersambung ke bridge setelah "hello" pertama terkirim). Key = scannerId
  // supaya urutan/jumlah kartu konsisten dan tidak dobel.
  const [knownScanners, setKnownScanners] = useState<Record<string, string>>({});

  const { queues, enqueue, isInFlight } = useScannerQueues<DirectedResult>({
    classify: classifyResult,
    onResult: (_scannerId, result) => notify(result),
  });

  const handleScan = useCallback(
    (token: string, scanner: { id: string; name: string }) => {
      setKnownScanners((prev) =>
        prev[scanner.id] === scanner.name ? prev : { ...prev, [scanner.id]: scanner.name }
      );

      if (isInFlight(scanner.id, token)) return;
      playScanBeep();

      const activeDirection = directionRef.current;
      enqueue(scanner.id, token, "Memindai kartu...", async () => {
        try {
          const endpoint =
            activeDirection === "masuk" ? "/api/absensi/scan" : "/api/absensi/scan-pulang";
          const res = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ qrToken: token }),
          });
          const data = await res.json();
          return activeDirection === "masuk"
            ? ({ direction: "masuk", data } as DirectedResult)
            : ({ direction: "pulang", data } as DirectedResult);
        } catch {
          return activeDirection === "masuk"
            ? ({ direction: "masuk", data: { type: "STUDENT_NOT_FOUND" } } as DirectedResult)
            : ({ direction: "pulang", data: { type: "STUDENT_NOT_FOUND" } } as DirectedResult);
        }
      });
    },
    [enqueue, isInFlight]
  );

  const { status: bridgeStatus, scanners } = useScannerBridge({
    enabled: true,
    onScan: handleScan,
  });

  // Sinkronkan daftar dari "hello" ke knownScanners juga (bukan cuma lewat
  // handleScan) -- supaya kartu tetap muncul untuk scanner yang sudah
  // dikenal bridge walau belum pernah dipakai scan sama sekali sejak
  // halaman ini dibuka.
  useEffect(() => {
    if (scanners.length === 0) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mirror pesan "hello" bridge (external system) ke state lokal; sinkron sekali per perubahan `scanners`, bukan loop.
    setKnownScanners((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const s of scanners) {
        if (next[s.id] !== s.name) {
          next[s.id] = s.name;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [scanners]);

  const scannerEntries = Object.entries(knownScanners);

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            href="/absensi"
            className="mb-1 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            Kembali ke Absensi
          </Link>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-foreground">
            <ScanBarcode className="size-6" />
            Scanner Fisik
          </h1>
        </div>

        <div className="inline-flex items-center gap-1 rounded-lg bg-muted p-1">
          <button
            type="button"
            onClick={() => setDirection("masuk")}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              direction === "masuk"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <LogIn className="size-4" />
            Masuk
          </button>
          <button
            type="button"
            onClick={() => setDirection("pulang")}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              direction === "pulang"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <LogOut className="size-4" />
            Pulang
          </button>
        </div>
      </div>

      {/* Status koneksi ke scanner-bridge lokal -- ditampilkan penuh di
         sini (bukan cuma saat "connected" seperti di dialog kamera) karena
         halaman ini SATU-SATUNYA tujuannya memang scanner meja, tidak ada
         preview kamera sebagai fallback visual. */}
      {bridgeStatus !== "connected" ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-muted/40 px-4 py-10 text-center">
          {bridgeStatus === "connecting" ? (
            <>
              <Spinner className="size-5" />
              <p className="text-sm text-muted-foreground">Menghubungkan ke scanner-bridge...</p>
            </>
          ) : (
            <>
              <BluetoothOff className="size-6 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">
                Scanner bridge tidak terhubung
              </p>
              <p className="text-xs text-muted-foreground">
                Pastikan aplikasi scanner-bridge sedang berjalan di PC ini
                (<code className="rounded bg-muted px-1 py-0.5">scanner-bridge.exe --serve</code>
                ).
              </p>
            </>
          )}
        </div>
      ) : scannerEntries.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-muted/40 px-4 py-10 text-center">
          <Bluetooth className="size-6 text-[#22949E]" />
          <p className="text-sm text-muted-foreground">
            Terhubung ke bridge, menunggu scanner terdaftar...
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {scannerEntries.map(([id, name]) => (
            <ScannerFisikCard key={id} scannerId={id} scannerName={name} items={queues[id] ?? []} />
          ))}
        </div>
      )}
    </div>
  );
}