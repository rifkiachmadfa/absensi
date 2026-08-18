// components/absensi/scan-dialog.tsx
"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
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
import { ScanResult } from "@/components/absensi/scan-result";
import { STATUS_LABEL } from "@/lib/constants/attendance";
import type { AttendanceCheckInResponse } from "@/lib/types/attendance";

type Student = { id: string; name: string; nisn: string; className: string };

// Feedback pesan sementara (berhasil / sudah absen / QR tidak valid / siswa
// nonaktif) ditampilkan berapa lama di dalam dialog sebelum scanner kembali
// aktif secara otomatis (Section 29: guru tidak perlu menekan tombol apapun
// untuk lanjut ke siswa berikutnya).
const FEEDBACK_DISPLAY_MS = 2000;

function jamJakarta(iso: string) {
  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(new Date(iso));
}

// Toast singkat di pojok layar (di luar dialog) supaya guru tetap tahu hasil
// scan meski dialog akan segera tertutup / sedang mengarahkan kamera ke siswa
// berikutnya. Kartu ScanResult di dalam dialog tetap ada untuk detail lengkap.
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
  toast.error("QR Code tidak dikenali oleh sistem");
}

export function ScanDialog({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false);

  // "scanning"  -> kamera/pencarian aktif, siap menerima QR/pilihan siswa
  // "feedback"  -> menampilkan hasil check-in (berhasil/sudah absen/tidak
  //                valid/nonaktif) sesaat, lalu kembali ke "scanning" sendiri
  const [phase, setPhase] = useState<"scanning" | "feedback">("scanning");
  const [feedback, setFeedback] = useState<AttendanceCheckInResponse | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const [query, setQuery] = useState("");
  const [students, setStudents] = useState<Student[]>([]);

  const showFeedback = useCallback(
    (result: AttendanceCheckInResponse) => {
      notify(result);
      setFeedback(result);
      setPhase("feedback");
      if (result.type === "SUCCESS") onSuccess();
      setTimeout(() => {
        setFeedback(null);
        setPhase("scanning");
      }, FEEDBACK_DISPLAY_MS);
    },
    [onSuccess]
  );

  // QR terbaca -> identifikasi + simpan absensi dalam satu request
  // (AttendanceService.checkIn, status otomatis dari AttendanceSchedule).
  const submitScan = useCallback(
    async (qrToken: string) => {
      setIsProcessing(true);
      try {
        const res = await fetch("/api/absensi/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ qrToken }),
        });
        const data: AttendanceCheckInResponse = await res.json();
        showFeedback(data);
      } catch {
        showFeedback({ type: "STUDENT_NOT_FOUND" });
      } finally {
        setIsProcessing(false);
      }
    },
    [showFeedback]
  );

  const searchStudents = useCallback(async (q: string) => {
    setQuery(q);
    if (q.trim().length < 2) return setStudents([]);
    const res = await fetch(`/api/absensi/search?q=${encodeURIComponent(q)}`);
    const data: { students: Student[] } = await res.json();
    setStudents(data.students ?? []);
  }, []);

  // Siswa dipilih dari hasil pencarian manual -> identifikasi + simpan
  // absensi, service & status yang sama persis dengan QR Scan (Section 9).
  const absenkanManual = useCallback(
    async (studentId: string) => {
      setIsProcessing(true);
      try {
        const res = await fetch("/api/absensi/manual", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ studentId }),
        });
        const data: AttendanceCheckInResponse = await res.json();
        setStudents([]);
        setQuery("");
        showFeedback(data);
      } catch {
        showFeedback({ type: "STUDENT_NOT_FOUND" });
      } finally {
        setIsProcessing(false);
      }
    },
    [showFeedback]
  );

  const resetDialogState = useCallback(() => {
    setPhase("scanning");
    setFeedback(null);
    setStudents([]);
    setQuery("");
  }, []);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) resetDialogState();
      }}
    >
      <DialogTrigger
        render={
          <Button size="lg" />
        }
      >
        Scan Absensi
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Absensi Siswa</DialogTitle>
        </DialogHeader>

        {phase === "feedback" && feedback && <ScanResult result={feedback} />}

        {phase === "scanning" && (
          <Tabs defaultValue="scan">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="scan">Scan QR</TabsTrigger>
              <TabsTrigger value="manual">Manual</TabsTrigger>
            </TabsList>

            <TabsContent value="scan">
              {open && <QrScanner onDetected={submitScan} isProcessing={isProcessing} />}
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
                    <Button size="sm" disabled={isProcessing} onClick={() => absenkanManual(s.id)}>
                      {isProcessing && <Spinner />}
                      Absenkan
                    </Button>
                  </div>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}