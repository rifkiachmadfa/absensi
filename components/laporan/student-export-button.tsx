"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

export function StudentExportButton({
  studentId,
  mode,
  date,
  month,
}: {
  studentId: string;
  mode: "daily" | "monthly";
  date: string;
  month: string;
}) {
  const [isGenerating, setIsGenerating] = useState(false);

  async function handleExport() {
    setIsGenerating(true);
    try {
      const params = new URLSearchParams({ mode });
      if (mode === "daily") params.set("date", date);
      else params.set("month", month);

      const res = await fetch(`/api/laporan/siswa/${studentId}/export?${params.toString()}`);
      if (!res.ok) throw new Error("Export gagal");

      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="?([^"]+)"?/);
      const fileName = match?.[1] ?? "laporan-siswa.xlsx";

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export laporan siswa error:", err);
      alert("Gagal mengekspor laporan. Silakan coba lagi.");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <Button type="button" variant="outline" onClick={handleExport} disabled={isGenerating}>
      {isGenerating ? <Spinner className="mr-2" /> : <Download className="mr-2 h-4 w-4" />}
      {isGenerating ? "Menyiapkan Excel..." : "Export ke Excel"}
    </Button>
  );
}