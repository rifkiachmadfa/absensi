// components/absensi/scan-dialog.tsx
"use client";

import { useState, useCallback } from "react";
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
import { AttendanceActionCard } from "@/components/absensi/attendance-action-card";
import type {
  AttendanceCheckInResponse,
  AttendanceIdentifyResponse,
  PendingStudent,
} from "@/lib/types/attendance";

type Student = { id: string; name: string; nisn: string; className: string };

// Feedback pesan sementara (sudah absen / QR tidak valid / siswa nonaktif /
// berhasil tersimpan) ditampilkan berapa lama sebelum kembali ke scanner.
const FEEDBACK_DISPLAY_MS = 3000;

export function ScanDialog({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false);

  // "scanning"  -> kamera/pencarian aktif, belum ada siswa teridentifikasi
  // "confirm"   -> siswa sudah teridentifikasi, kamera disembunyikan,
  //                menunggu petugas memilih status secara manual
  // "feedback"  -> menampilkan hasil (berhasil/sudah absen/tidak valid) sesaat
  const [phase, setPhase] = useState<"scanning" | "confirm" | "feedback">("scanning");

  const [pendingStudent, setPendingStudent] = useState<PendingStudent | null>(null);
  // Feedback pesan sesaat (ALREADY_CHECKED_IN / STUDENT_INACTIVE / STUDENT_NOT_FOUND
  // dari identify, atau SUCCESS dari confirm) -- bentuknya sama persis di kedua
  // response type kecuali varian SUCCESS milik identify (yang tidak pernah
  // ditampilkan di sini, karena SUCCESS identify diarahkan ke fase "confirm").
  const [feedback, setFeedback] = useState<AttendanceCheckInResponse | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const [query, setQuery] = useState("");
  const [students, setStudents] = useState<Student[]>([]);

  const returnToScanningAfterDelay = useCallback(() => {
    setTimeout(() => {
      setFeedback(null);
      setPhase("scanning");
    }, FEEDBACK_DISPLAY_MS);
  }, []);

  // Langkah 1a: QR terbaca -> identifikasi saja, BELUM menyimpan absensi.
  const submitScan = useCallback(
    async (qrToken: string) => {
      setIsProcessing(true);
      try {
        const res = await fetch("/api/absensi/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ qrToken }),
        });
        const data: AttendanceIdentifyResponse = await res.json();

        if (data.type === "SUCCESS") {
          setPendingStudent({ ...data.student, suggestedStatus: data.suggestedStatus, method: "QR" });
          setPhase("confirm");
        } else {
          setFeedback(data);
          setPhase("feedback");
          returnToScanningAfterDelay();
        }
      } catch {
        setFeedback({ type: "STUDENT_NOT_FOUND" });
        setPhase("feedback");
        returnToScanningAfterDelay();
      } finally {
        setIsProcessing(false);
      }
    },
    [returnToScanningAfterDelay]
  );

  const searchStudents = useCallback(async (q: string) => {
    setQuery(q);
    if (q.trim().length < 2) return setStudents([]);
    const res = await fetch(`/api/absensi/search?q=${encodeURIComponent(q)}`);
    const data: { students: Student[] } = await res.json();
    setStudents(data.students ?? []);
  }, []);

  // Langkah 1b: siswa dipilih dari hasil pencarian manual -> identifikasi saja.
  const identifyManual = useCallback(async (studentId: string) => {
    setIsProcessing(true);
    try {
      const res = await fetch("/api/absensi/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId }),
      });
      const data: AttendanceIdentifyResponse = await res.json();
      setStudents([]);
      setQuery("");

      if (data.type === "SUCCESS") {
        setPendingStudent({ ...data.student, suggestedStatus: data.suggestedStatus, method: "MANUAL" });
        setPhase("confirm");
      } else {
        setFeedback(data);
        setPhase("feedback");
        returnToScanningAfterDelay();
      }
    } catch {
      setFeedback({ type: "STUDENT_NOT_FOUND" });
      setPhase("feedback");
      returnToScanningAfterDelay();
    } finally {
      setIsProcessing(false);
    }
  }, [returnToScanningAfterDelay]);

  // Langkah 2: petugas memilih status secara manual -> baru absensi disimpan.
  const confirmAttendance = useCallback(
    async (status: string) => {
      if (!pendingStudent) return;
      setIsProcessing(true);
      try {
        const res = await fetch("/api/absensi/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            studentId: pendingStudent.id,
            status,
            method: pendingStudent.method,
          }),
        });
        const data: AttendanceCheckInResponse = await res.json();
        setFeedback(data);
        setPendingStudent(null);
        setPhase("feedback");
        if (data.type === "SUCCESS") onSuccess();
      } catch {
        setFeedback({ type: "STUDENT_NOT_FOUND" });
        setPendingStudent(null);
        setPhase("feedback");
      } finally {
        setIsProcessing(false);
        returnToScanningAfterDelay();
      }
    },
    [pendingStudent, onSuccess, returnToScanningAfterDelay]
  );

  const cancelConfirm = useCallback(() => {
    setPendingStudent(null);
    setPhase("scanning");
  }, []);

  const resetDialogState = useCallback(() => {
    setPhase("scanning");
    setPendingStudent(null);
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

        {phase === "confirm" && pendingStudent && (
          <AttendanceActionCard
            student={pendingStudent}
            isSubmitting={isProcessing}
            onConfirm={confirmAttendance}
            onCancel={cancelConfirm}
          />
        )}

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
                    <Button size="sm" disabled={isProcessing} onClick={() => identifyManual(s.id)}>
                      {isProcessing && <Spinner />}
                      Pilih
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