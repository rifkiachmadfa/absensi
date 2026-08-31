// components/absensi/scan-dialog.tsx
"use client";

import { useCallback, useState } from "react";
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
import { useScanQueue } from "@/components/absensi/use-scan-queue";
import { useScannerBridge } from "@/components/absensi/use-scanner-bridge";
import { playScanBeep } from "@/lib/audio/beep";
import {
  classifyCheckInResult,
  identifiedMeta,
  notifyCheckInResult,
} from "@/lib/attendance/classify-result";
import { cn } from "@/lib/utils";
import type { AttendanceCheckInResponse, AttendanceIdentifyResponse } from "@/lib/types/attendance";

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

export function ScanDialog({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [students, setStudents] = useState<Student[]>([]);
  const [scanMode, setScanMode] = useState<ScanMode>("camera");

  const { queue, enqueue, isInFlight, reset } = useScanQueue<AttendanceCheckInResponse>({
    classify: classifyCheckInResult,
    onResult: (result) => {
      notifyCheckInResult(result);
      if (result.type === "SUCCESS") onSuccess();
    },
  });

  // QR terbaca -> langsung dikirim ke server TANPA menunggu (await) respons
  // sebelum kamera boleh membaca kartu berikutnya. Kamera (QrScanner) tetap
  // hidup terus-menerus -- tidak lagi di-unmount selagi menunggu hasil.
  // Identifikasi siswa + cek duplikat + penentuan status + penyimpanan
  // tetap SATU transaksi di server (Section 3.1 & 3.2), hanya saja UI tidak
  // lagi diam menunggu; hasilnya "menyusul" lewat toast + panel Riwayat.
  //
  // DUA fase per scan (bukan cuma satu, lihat use-scan-queue.ts &
  // attendance-service.ts): fase 1 memanggil /api/absensi/scan/identify
  // (read-only, cepat) supaya Nama/Kelas siswa langsung tampil di panel
  // Riwayat/ScanLiveCard selagi guru lanjut mengarahkan kamera ke kartu
  // berikutnya; fase 2 memanggil /api/absensi/scan (checkIn(), yang
  // benar-benar menyimpan) seperti biasa dan TETAP satu-satunya penentu
  // hasil akhir. Kalau fase 1 gagal/timeout, fase 2 tetap jalan seperti
  // biasa -- guru cuma tidak melihat nama lebih awal untuk scan itu.
  const handleDetected = useCallback(
    (qrToken: string) => {
      if (isInFlight(qrToken)) return; // request utk kartu ini masih berjalan
      playScanBeep(); // konfirmasi suara: kartu terbaca & MULAI diproses
      enqueue(qrToken, "Memindai kartu...", async (markIdentified) => {
        try {
          const identifyRes = await fetch("/api/absensi/scan/identify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ qrToken }),
          });
          const identified = (await identifyRes.json()) as AttendanceIdentifyResponse;
          const meta = identifiedMeta(identified);
          if (meta) markIdentified(meta);
        } catch {
          // Diam -- fase 2 di bawah tetap jalan & menentukan hasil akhir.
        }

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
  // memilih siswa lain tanpa menunggu request sebelumnya selesai. Beda
  // dengan QR, di sini Nama/Kelas SUDAH diketahui dari hasil pencarian
  // (dipilih langsung oleh guru) -- tidak perlu fase identify terpisah,
  // cukup markIdentified() segera supaya ScanLiveCard konsisten dengan
  // panel Riwayat (yang memang sudah menampilkan nama sejak awal).
  const absenkanManual = useCallback(
    (student: Student) => {
      if (isInFlight(student.id)) return;
      playScanBeep();
      enqueue(student.id, student.name, async (markIdentified) => {
        markIdentified({ label: student.name, meta: { className: student.className } });
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