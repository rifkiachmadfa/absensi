// components/absensi/scan-dialog-pulang.tsx
"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { Bluetooth, Camera, ScanBarcode, XCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { QrScanner } from "@/components/absensi/qr-scanner";
import { ScanQueuePanel } from "@/components/absensi/scan-queue-panel";
import { ScanLiveCard } from "@/components/absensi/scan-live-card";
import { useScanQueue, type ScanQueueStatus } from "@/components/absensi/use-scan-queue";
import { useScannerBridge } from "@/components/absensi/use-scanner-bridge";
import { playScanBeep } from "@/lib/audio/beep";
import { identifiedMeta } from "@/lib/attendance/classify-result";
import { cn } from "@/lib/utils";
import type {
  AttendanceCheckOutResponse,
  AttendanceIdentifyPulangResponse,
} from "@/lib/types/attendance";

// Sama persis pola & tampilannya dengan scan-dialog.tsx (masuk) -- lihat
// catatan lengkap di sana (kamera tetap hidup, hasil diproses di background,
// panel Riwayat + toast "menyusul", toggle mode Kamera/Scanner Fisik).
// Endpoint & tipe respons saja yang berbeda; logic tetap satu pintu lewat
// AttendanceService.checkOut() (Section 9).

type ScanMode = "camera" | "bridge";

type Student = { id: string; name: string; nisn: string; className: string };

function jamJakarta(iso: string) {
  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(new Date(iso));
}

function notify(result: AttendanceCheckOutResponse) {
  if (result.type === "SUCCESS") {
    toast.success(`${result.student.name} berhasil absen pulang`, {
      description: `${result.student.className} · ${jamJakarta(result.time)}`,
    });
    return;
  }
  if (result.type === "ALREADY_CHECKED_OUT") {
    toast.warning(`${result.student.name} sudah absen pulang`, {
      description: `Tercatat pada ${jamJakarta(result.time)}`,
    });
    return;
  }
  if (result.type === "NOT_CHECKED_IN") {
    toast.error(`${result.student.name} belum absen masuk hari ini`);
    return;
  }
  if (result.type === "STUDENT_INACTIVE") {
    toast.error(`${result.student.name} berstatus nonaktif`);
    return;
  }
  if (result.type === "SCHOOL_CLOSED") {
    toast.error("Hari ini libur, absensi tidak aktif.");
    return;
  }
  toast.error("QR Code tidak dikenali oleh sistem");
}

function classifyResult(result: AttendanceCheckOutResponse): {
  status: ScanQueueStatus;
  label: string;
  detail?: string;
  meta?: Record<string, string>;
} {
  if (result.type === "SUCCESS") {
    return {
      status: "success",
      label: result.student.name,
      detail: `Pulang · ${jamJakarta(result.time)}`,
      meta: { className: result.student.className },
    };
  }
  if (result.type === "ALREADY_CHECKED_OUT") {
    return {
      status: "warning",
      label: result.student.name,
      detail: `Sudah absen pulang · ${jamJakarta(result.time)}`,
      meta: { className: result.student.className },
    };
  }
  if (result.type === "NOT_CHECKED_IN") {
    return {
      status: "error",
      label: result.student.name,
      detail: "Belum absen masuk",
      meta: { className: result.student.className },
    };
  }
  if (result.type === "STUDENT_INACTIVE") {
    return { status: "error", label: result.student.name, detail: "Siswa nonaktif" };
  }
  if (result.type === "SCHOOL_CLOSED") {
    return { status: "error", label: "Hari ini libur" };
  }
  return { status: "error", label: "QR tidak dikenali", detail: "Kartu siswa tidak dikenali oleh sistem" };
}

export function ScanDialogPulang({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [students, setStudents] = useState<Student[]>([]);
  const [scanMode, setScanMode] = useState<ScanMode>("camera");

  const { queue, enqueue, isInFlight, reset } = useScanQueue<AttendanceCheckOutResponse>({
    classify: classifyResult,
    onResult: (result) => {
      notify(result);
      if (result.type === "SUCCESS") onSuccess();
    },
  });

  // DUA fase per scan, sama persis polanya dengan scan-dialog.tsx (masuk):
  // fase 1 memanggil /api/absensi/scan-pulang/identify (read-only, cepat)
  // supaya Nama/Kelas tampil segera, fase 2 memanggil /api/absensi/scan-pulang
  // (checkOut(), yang benar-benar menyimpan checkOutAt) seperti biasa dan
  // TETAP satu-satunya penentu hasil akhir.
  //
  // Kedua fase di-*fire* BERSAMAAN (bukan await berurutan) -- lihat catatan
  // lengkap di scan-dialog.tsx (masuk). Fase 1 TIDAK PERNAH menunda mulainya
  // fase 2; ia hanya "menyusul" mengisi Nama/Kelas lewat markIdentified()
  // begitu responsnya datang.
  const handleDetected = useCallback(
    (qrToken: string) => {
      if (isInFlight(qrToken)) return;
      playScanBeep(); // konfirmasi suara: kartu terbaca & MULAI diproses
      enqueue(qrToken, "Memindai kartu...", async (markIdentified) => {
        // Sengaja TIDAK di-await -- berjalan paralel dengan fase 2 di bawah.
        fetch("/api/absensi/scan-pulang/identify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ qrToken }),
        })
          .then((res) => res.json())
          .then((identified: AttendanceIdentifyPulangResponse) => {
            const meta = identifiedMeta(identified);
            if (meta) markIdentified(meta);
          })
          .catch(() => {
            // Diam -- fase 2 di bawah tetap jalan & menentukan hasil akhir.
          });

        try {
          const res = await fetch("/api/absensi/scan-pulang", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ qrToken }),
          });
          return (await res.json()) as AttendanceCheckOutResponse;
        } catch {
          return { type: "STUDENT_NOT_FOUND" } as AttendanceCheckOutResponse;
        }
      });
    },
    [enqueue, isInFlight]
  );

  // Sumber scan KEDUA (opsional): scanner meja fisik lewat scanner-bridge
  // lokal (Phase 9/10), aktif hanya selagi dialog ini terbuka. Sama persis
  // dengan scan-dialog.tsx (masuk) -- hasilnya diteruskan ke handleDetected
  // yang sama dipakai kamera, berujung ke AttendanceService.checkOut() yang
  // sama, tanpa logic atau endpoint terpisah untuk scanner meja.
  const { status: bridgeStatus, scanners } = useScannerBridge({
    enabled: open,
    onScan: handleDetected,
  });
  const scannerCount = scanners.length;

  const searchStudents = useCallback(async (q: string) => {
    setQuery(q);
    if (q.trim().length < 2) return setStudents([]);
    const res = await fetch(`/api/absensi/search?q=${encodeURIComponent(q)}`);
    const data: { students: Student[] } = await res.json();
    setStudents(data.students ?? []);
  }, []);

  // Sama seperti scan-dialog.tsx: Nama/Kelas sudah diketahui dari hasil
  // pencarian, jadi markIdentified() segera tanpa fase identify terpisah.
  const absenkanManual = useCallback(
    (student: Student) => {
      if (isInFlight(student.id)) return;
      playScanBeep();
      enqueue(student.id, student.name, async (markIdentified) => {
        markIdentified({ label: student.name, meta: { className: student.className } });
        try {
          const res = await fetch("/api/absensi/manual-pulang", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ studentId: student.id }),
          });
          return (await res.json()) as AttendanceCheckOutResponse;
        } catch {
          return { type: "STUDENT_NOT_FOUND" } as AttendanceCheckOutResponse;
        }
      });
    },
    [enqueue, isInFlight]
  );

  const resetDialogState = useCallback(() => {
    setStudents([]);
    setQuery("");
    setScanMode("camera");
    reset();
  }, [reset]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) resetDialogState();
      }}
    >
      <DialogTrigger render={<Button size="lg" variant="outline" />}>Scan Pulang</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Absensi Pulang</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="scan">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="scan">Scan QR</TabsTrigger>
            <TabsTrigger value="manual">Manual</TabsTrigger>
          </TabsList>

          <TabsContent value="scan">
            {/* Sama seperti scan-dialog.tsx (masuk): toggle murni tampilan,
               kedua metode berujung ke handleDetected yang sama. */}
            <div className="mb-3 inline-flex w-full items-center gap-1 rounded-lg bg-muted p-1">
              <button
                type="button"
                onClick={() => setScanMode("camera")}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  scanMode === "camera"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Camera className="size-4" />
                Kamera
              </button>
              <button
                type="button"
                onClick={() => setScanMode("bridge")}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  scanMode === "bridge"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <ScanBarcode className="size-4" />
                Scanner Fisik
              </button>
            </div>

            {scanMode === "camera" ? (
              <>
                {open && <QrScanner onDetected={handleDetected} isProcessing={false} />}

                {/* Sama seperti scan-dialog.tsx: hanya tampil kalau scanner
                   meja benar-benar tersambung, disembunyikan total untuk guru
                   yang cuma memakai kamera HP. */}
                {bridgeStatus === "connected" && scannerCount > 0 && (
                  <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                    <Bluetooth className="size-3.5 text-[#22949E]" />
                    {scannerCount} scanner meja terhubung
                  </p>
                )}
              </>
            ) : (
              <div className="space-y-3">
                {/* Kamera tidak di-render sama sekali di mode ini -- lihat
                   catatan lengkap di scan-dialog.tsx. */}
                <ScanLiveCard item={queue[0]} />

                <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                  {bridgeStatus === "connected" ? (
                    <>
                      <Bluetooth className="size-3.5 text-[#22949E]" />
                      {scannerCount > 0
                        ? `${scannerCount} scanner meja terhubung`
                        : "Terhubung ke bridge, menunggu scanner..."}
                    </>
                  ) : bridgeStatus === "connecting" ? (
                    <>
                      <Spinner className="size-3.5" />
                      Menghubungkan ke scanner bridge...
                    </>
                  ) : (
                    <>
                      <XCircle className="size-3.5 text-destructive" />
                      Scanner bridge tidak terhubung. Pastikan aplikasi bridge berjalan di PC ini.
                    </>
                  )}
                </p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="manual">
            <Input
              placeholder="Cari nama / NISN / NIS..."
              value={query}
              onChange={(e) => searchStudents(e.target.value)}
            />
            <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">
              {students.map((s) => (
                <div key={s.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="font-medium">{s.name}</p>
                    <p className="text-sm text-muted-foreground">{s.className}</p>
                  </div>
                  <Button size="sm" disabled={isInFlight(s.id)} onClick={() => absenkanManual(s)}>
                    Pulangkan
                  </Button>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        <ScanQueuePanel items={queue} />
      </DialogContent>
    </Dialog>
  );
}