// components/absensi/scan-dialog.tsx
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
import { STATUS_LABEL } from "@/lib/constants/attendance";
import { cn } from "@/lib/utils";
import type { AttendanceCheckInResponse } from "@/lib/types/attendance";

// Dua sumber input kartu (Section 8.1 & scanner-bridge lokal) tetap
// berujung ke handleDetected yang SAMA -- toggle ini murni UI, memilih mana
// yang perlu DILIHAT guru: preview kamera (mode "camera") atau kartu
// live-processing yang tidak butuh kamera sama sekali (mode "bridge").
// Scanner-bridge WebSocket (useScannerBridge) tetap didengarkan di kedua
// mode selama dialog terbuka -- yang berubah hanya apakah kamera HP
// dinyalakan atau tidak (mematikan preview kamera saat scanner fisik
// dipakai supaya tidak menguras baterai/menyalakan kamera yang sudah tidak
// diperlukan).
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

// Toast di pojok layar untuk tiap hasil scan yang "menyusul" dari background
// -- guru tetap tahu hasilnya meski sudah lanjut mengarahkan kamera ke
// siswa berikutnya (Section 29: guru tidak perlu menekan tombol apapun
// untuk lanjut ke siswa berikutnya).
function notify(result: AttendanceCheckInResponse) {
  if (result.type === "SUCCESS") {
    toast.success(`${result.student.name} berhasil absen`, {
      description: `${STATUS_LABEL[result.status] ?? result.status} · ${result.student.className} · ${jamJakarta(result.time)}`,
    });
    return;
  }
  if (result.type === "ALREADY_CHECKED_IN") {
    toast.warning(`${result.student.name} sudah absen`, {
      description: `Tercatat pada ${jamJakarta(result.time)}`,
    });
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

// Memformat response FINAL dari server menjadi label + warna badge untuk
// ScanQueuePanel. Tidak menebak apa pun -- AttendanceService.checkIn() di
// server sudah menyelesaikan identifikasi, cek duplikat, dan penentuan
// status dalam satu transaksi sebelum hasil ini sampai ke client.
function classifyResult(result: AttendanceCheckInResponse): {
  status: ScanQueueStatus;
  label: string;
  detail?: string;
  meta?: Record<string, string>;
} {
  if (result.type === "SUCCESS") {
    return {
      status: "success",
      label: result.student.name,
      detail: `${STATUS_LABEL[result.status] ?? result.status} · ${jamJakarta(result.time)}`,
      meta: { className: result.student.className },
    };
  }
  if (result.type === "ALREADY_CHECKED_IN") {
    return {
      status: "warning",
      label: result.student.name,
      detail: `Sudah absen · ${jamJakarta(result.time)}`,
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

export function ScanDialog({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [students, setStudents] = useState<Student[]>([]);
  const [scanMode, setScanMode] = useState<ScanMode>("camera");

  const { queue, enqueue, isInFlight, reset } = useScanQueue<AttendanceCheckInResponse>({
    classify: classifyResult,
    onResult: (result) => {
      notify(result);
      if (result.type === "SUCCESS") onSuccess();
    },
  });

  // QR terbaca -> langsung dikirim ke server TANPA menunggu (await) respons
  // sebelum kamera boleh membaca kartu berikutnya. Kamera (QrScanner) tetap
  // hidup terus-menerus -- tidak lagi di-unmount selagi menunggu hasil.
  // Identifikasi siswa + cek duplikat + penentuan status + penyimpanan
  // tetap SATU transaksi di server (Section 3.1 & 3.2), hanya saja UI tidak
  // lagi diam menunggu; hasilnya "menyusul" lewat toast + panel Riwayat.
  const handleDetected = useCallback(
    (qrToken: string) => {
      if (isInFlight(qrToken)) return; // request utk kartu ini masih berjalan
      playScanBeep(); // konfirmasi suara: kartu terbaca & MULAI diproses
      enqueue(qrToken, "Memindai kartu...", async () => {
        try {
          const res = await fetch("/api/absensi/scan", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ qrToken }),
          });
          return (await res.json()) as AttendanceCheckInResponse;
        } catch {
          return { type: "STUDENT_NOT_FOUND" } as AttendanceCheckInResponse;
        }
      });
    },
    [enqueue, isInFlight]
  );

  // Sumber scan KEDUA (opsional): scanner meja fisik lewat scanner-bridge
  // lokal (Phase 9/10), aktif hanya selagi dialog ini terbuka. Hasilnya
  // diteruskan ke handleDetected yang SAMA PERSIS dipakai kamera -- tidak
  // ada logic absensi terpisah, tidak ada endpoint terpisah. Kalau tidak
  // ada scanner-bridge yang berjalan di PC ini (mayoritas guru hanya
  // memakai kamera HP), hook ini gagal konek secara diam-diam tanpa
  // mengganggu apa pun.
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

  // Sama seperti QR: dikirim di background, guru bisa langsung mencari /
  // memilih siswa lain tanpa menunggu request sebelumnya selesai.
  const absenkanManual = useCallback(
    (student: Student) => {
      if (isInFlight(student.id)) return;
      playScanBeep();
      enqueue(student.id, student.name, async () => {
        try {
          const res = await fetch("/api/absensi/manual", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ studentId: student.id }),
          });
          return (await res.json()) as AttendanceCheckInResponse;
        } catch {
          return { type: "STUDENT_NOT_FOUND" } as AttendanceCheckInResponse;
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
      <DialogTrigger render={<Button size="lg" />}>Scan Absensi</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Absensi Siswa</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="scan">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="scan">Scan QR</TabsTrigger>
            <TabsTrigger value="manual">Manual</TabsTrigger>
          </TabsList>

          <TabsContent value="scan">
            {/* Pilihan metode input kartu: Kamera HP (default, Section 8.1)
               atau Scanner Fisik (scanner-bridge lokal). Murni pilihan
               TAMPILAN -- kedua metode berujung ke handleDetected yang sama
               persis, jadi tidak ada logic absensi ganda. */}
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
                {/* Kamera tetap dipertahankan hidup selama dialog terbuka --
                   tidak lagi di-unmount menunggu hasil scan sebelumnya,
                   supaya guru bisa langsung mengarahkan ke kartu berikutnya. */}
                {open && <QrScanner onDetected={handleDetected} isProcessing={false} />}

                {/* Indikator hanya muncul kalau scanner meja BENAR-BENAR
                   tersambung -- disembunyikan total untuk guru yang cuma
                   memakai kamera HP, supaya tidak ada kesan "tidak terhubung"
                   yang membingungkan padahal memang tidak dipakai. */}
                {bridgeStatus === "connected" && scannerCount > 0 && (
                  <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                    <Bluetooth className="size-3.5 text-[#22949E]" />
                    {scannerCount} scanner meja terhubung
                  </p>
                )}
              </>
            ) : (
              <div className="space-y-3">
                {/* Kamera TIDAK di-render sama sekali di mode ini (bukan
                   cuma disembunyikan lewat CSS) -- QrScanner di-unmount
                   sehingga stream kamera HP benar-benar dimatikan karena
                   sudah tidak diperlukan. */}
                <ScanLiveCard item={queue[0]} />

                {/* Karena tidak ada preview kamera untuk dilihat, status
                   koneksi scanner-bridge ditampilkan penuh di sini (bukan
                   hanya saat "connected" seperti di mode Kamera) supaya
                   guru tahu kalau ternyata aplikasi bridge belum berjalan. */}
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
                    Absenkan
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