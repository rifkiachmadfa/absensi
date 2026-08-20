// components/absensi/scan-dialog-pulang.tsx
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
import type { AttendanceCheckOutResponse } from "@/lib/types/attendance";

// Sama persis pola & tampilannya dengan scan-dialog.tsx (masuk), hanya
// endpoint yang dipanggil berbeda (scan-pulang / manual-pulang) -- logic
// tetap satu pintu lewat AttendanceService.checkOut() (Section 9).
const FEEDBACK_DISPLAY_MS = 2000;

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
  toast.error("QR Code tidak dikenali oleh sistem");
}

export function ScanDialogPulang({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<"scanning" | "feedback">("scanning");
  const [feedback, setFeedback] = useState<AttendanceCheckOutResponse | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const [query, setQuery] = useState("");
  const [students, setStudents] = useState<Student[]>([]);

  const showFeedback = useCallback(
    (result: AttendanceCheckOutResponse) => {
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

  const submitScan = useCallback(
    async (qrToken: string) => {
      setIsProcessing(true);
      try {
        const res = await fetch("/api/absensi/scan-pulang", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ qrToken }),
        });
        const data: AttendanceCheckOutResponse = await res.json();
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

  const absenkanManual = useCallback(
    async (studentId: string) => {
      setIsProcessing(true);
      try {
        const res = await fetch("/api/absensi/manual-pulang", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ studentId }),
        });
        const data: AttendanceCheckOutResponse = await res.json();
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
      <DialogTrigger render={<Button size="lg" variant="outline" />}>
        Scan Pulang
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Absensi Pulang</DialogTitle>
        </DialogHeader>

        {phase === "feedback" && feedback && <ScanResult result={feedback} mode="pulang" />}

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
                      Pulangkan
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