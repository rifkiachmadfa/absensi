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
import { QrScanner } from "@/components/absensi/qr-scanner";
import { ScanResult } from "@/components/absensi/scan-result";
import type { AttendanceCheckInResponse } from "@/lib/types/attendance";
import { Spinner } from "@/components/ui/spinner"

type Student = { id: string; name: string; nisn: string; className: string };

export function ScanDialog({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<AttendanceCheckInResponse | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [query, setQuery] = useState("");
  const [students, setStudents] = useState<Student[]>([]);

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
        setResult(data);
        if (data.type === "SUCCESS") onSuccess();
      } catch {
        setResult({ type: "STUDENT_NOT_FOUND" });
      } finally {
        setIsProcessing(false);
        setTimeout(() => setResult(null), 4000);
      }
    },
    [onSuccess]
  );

  const searchStudents = useCallback(async (q: string) => {
    setQuery(q);
    if (q.trim().length < 2) return setStudents([]);
    const res = await fetch(`/api/absensi/search?q=${encodeURIComponent(q)}`);
    const data: { students: Student[] } = await res.json();
    setStudents(data.students ?? []);
  }, []);

  const submitManual = useCallback(
    async (studentId: string) => {
      setIsProcessing(true);
      try {
        const res = await fetch("/api/absensi/manual", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ studentId }),
        });
        const data: AttendanceCheckInResponse = await res.json();
        setResult(data);
        setStudents([]);
        setQuery("");
        if (data.type === "SUCCESS") onSuccess();
      } finally {
        setIsProcessing(false);
      }
    },
    [onSuccess]
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setResult(null);
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

        {result && <ScanResult result={result} />}

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
<Button size="sm" disabled={isProcessing} onClick={() => submitManual(s.id)}>
                    {isProcessing && <Spinner />}
                    Absenkan
                  </Button>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}