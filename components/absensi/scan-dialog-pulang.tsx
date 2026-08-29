// components/absensi/scan-dialog-pulang.tsx
"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { Bluetooth } from "lucide-react";
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
import { QrScanner } from "@/components/absensi/qr-scanner";
import { ScanQueuePanel } from "@/components/absensi/scan-queue-panel";
import { useScanQueue, type ScanQueueStatus } from "@/components/absensi/use-scan-queue";
import { useScannerBridge } from "@/components/absensi/use-scanner-bridge";
import { playScanBeep } from "@/lib/audio/beep";
import type { AttendanceCheckOutResponse } from "@/lib/types/attendance";

// Sama persis pola & tampilannya dengan scan-dialog.tsx (masuk) -- lihat
// catatan lengkap di sana (kamera tetap hidup, hasil diproses di background,
// panel Riwayat + toast "menyusul"). Endpoint & tipe respons saja yang
// berbeda; logic tetap satu pintu lewat AttendanceService.checkOut()
// (Section 9).

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
} {
  if (result.type === "SUCCESS") {
    return { status: "success", label: result.student.name, detail: `Pulang · ${jamJakarta(result.time)}` };
  }
  if (result.type === "ALREADY_CHECKED_OUT") {
    return { status: "warning", label: result.student.name, detail: "Sudah absen pulang" };
  }
  if (result.type === "NOT_CHECKED_IN") {
    return { status: "error", label: result.student.name, detail: "Belum absen masuk" };
  }
  if (result.type === "STUDENT_INACTIVE") {
    return { status: "error", label: result.student.name, detail: "Siswa nonaktif" };
  }
  if (result.type === "SCHOOL_CLOSED") {
    return { status: "error", label: "Hari ini libur" };
  }
  return { status: "error", label: "QR tidak dikenali" };
}

export function ScanDialogPulang({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [students, setStudents] = useState<Student[]>([]);

  const { queue, enqueue, isInFlight, reset } = useScanQueue<AttendanceCheckOutResponse>({
    classify: classifyResult,
    onResult: (result) => {
      notify(result);
      if (result.type === "SUCCESS") onSuccess();
    },
  });

  const handleDetected = useCallback(
    (qrToken: string) => {
      if (isInFlight(qrToken)) return;
      playScanBeep(); // konfirmasi suara: kartu terbaca & MULAI diproses
      enqueue(qrToken, "Memindai kartu...", async () => {
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
  const { status: bridgeStatus, scannerCount } = useScannerBridge({
    enabled: open,
    onScan: handleDetected,
  });

  const searchStudents = useCallback(async (q: string) => {
    setQuery(q);
    if (q.trim().length < 2) return setStudents([]);
    const res = await fetch(`/api/absensi/search?q=${encodeURIComponent(q)}`);
    const data: { students: Student[] } = await res.json();
    setStudents(data.students ?? []);
  }, []);

  const absenkanManual = useCallback(
    (student: Student) => {
      if (isInFlight(student.id)) return;
      playScanBeep();
      enqueue(student.id, student.name, async () => {
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