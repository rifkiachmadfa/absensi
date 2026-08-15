"use client";

import { useState, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { QrScanner } from "@/components/absensi/qr-scanner";
import { ScanResult } from "@/components/absensi/scan-result";
import type { AttendanceCheckInResponse } from "@/lib/types/attendance";

type Student = { id: string; name: string; nisn: string; className: string };

export default function AbsensiPage() {
  const [result, setResult] = useState<AttendanceCheckInResponse | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [query, setQuery] = useState("");
  const [students, setStudents] = useState<Student[]>([]);

  const submitScan = useCallback(async (qrToken: string) => {
    setIsProcessing(true);
    try {
      const res = await fetch("/api/absensi/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qrToken }),
      });
      const data: AttendanceCheckInResponse = await res.json();
      setResult(data);
    } catch {
      setResult({ type: "STUDENT_NOT_FOUND" });
    } finally {
      setIsProcessing(false);
      setTimeout(() => setResult(null), 4000);
    }
  }, []);

  const searchStudents = useCallback(async (q: string) => {
    setQuery(q);
    if (q.trim().length < 2) return setStudents([]);
    const res = await fetch(`/api/absensi/search?q=${encodeURIComponent(q)}`);
    const data: { students: Student[] } = await res.json();
    setStudents(data.students ?? []);
  }, []);

  const submitManual = useCallback(async (studentId: string) => {
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
    } finally {
      setIsProcessing(false);
    }
  }, []);

  return (
    <div className="mx-auto max-w-md px-4 py-6">
      <h1 className="mb-4 text-center text-xl font-bold">Absensi Siswa</h1>

      {result && <div className="mb-4"><ScanResult result={result} /></div>}

      <Tabs defaultValue="scan">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="scan">Scan QR</TabsTrigger>
          <TabsTrigger value="manual">Manual</TabsTrigger>
        </TabsList>

        <TabsContent value="scan">
          <QrScanner onDetected={submitScan} isProcessing={isProcessing} />
        </TabsContent>

        <TabsContent value="manual">
          <Input
            placeholder="Cari nama / NISN / NIS..."
            value={query}
            onChange={(e) => searchStudents(e.target.value)}
          />
          <div className="mt-3 space-y-2">
            {students.map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="font-medium">{s.name}</p>
                  <p className="text-sm text-muted-foreground">{s.className}</p>
                </div>
                <Button size="sm" disabled={isProcessing} onClick={() => submitManual(s.id)}>
                  Absenkan
                </Button>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}