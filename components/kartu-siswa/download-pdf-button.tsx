"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { StudentIdCardData } from "@/components/kartu-siswa/student-id-card";
import { Spinner } from "@/components/ui/spinner";
export function DownloadPdfButton({
  cards,
  schoolName,
  fileName,
  label = "Download PDF",
}: {
  cards: StudentIdCardData[];
  schoolName: string;
  fileName: string;
  label?: string;
}) {
  const [isGenerating, setIsGenerating] = useState(false);

  async function handleDownload() {
    setIsGenerating(true);
    try {
      const { buildStudentCardsPdf } = await import(
        "@/lib/pdf/student-card-pdf"
      );
      const doc = buildStudentCardsPdf(cards, schoolName);
      doc.save(fileName);
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <Button
      type="button"
      onClick={handleDownload}
      disabled={isGenerating || cards.length === 0}
    >
      {isGenerating ? <Spinner className="mr-2" /> : <Download className="mr-2 h-4 w-4" />}
      {isGenerating ? "Menyiapkan PDF..." : label}
    </Button>
  );
}