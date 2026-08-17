// components/kartu-siswa/download-pdf-button.tsx
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
      const [{ buildStudentCardsPdf }, { fetchImageAsDataUrl }, { getStudentAvatarUrl }, { SCHOOL_LOGO_URL }] =
        await Promise.all([
          import("@/lib/pdf/student-card-pdf"),
          import("@/lib/pdf/image-to-data-url"),
          import("@/lib/kartu-siswa/avatar"),
          import("@/lib/kartu-siswa/constants"),
        ]);

      // Logo cukup diambil satu kali, dipakai ulang untuk semua kartu.
      const logoDataUrl = await fetchImageAsDataUrl(SCHOOL_LOGO_URL);

      // Avatar per murid — format PNG karena jsPDF butuh raster, bukan SVG.
      const enrichedCards = await Promise.all(
        cards.map(async (card) => ({
          ...card,
          avatarDataUrl:
            (await fetchImageAsDataUrl(getStudentAvatarUrl(card.nis, "png"))) ??
            undefined,
        }))
      );

      const doc = buildStudentCardsPdf(
        enrichedCards,
        schoolName,
        logoDataUrl ?? undefined
      );
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
      {isGenerating ? (
        <Spinner className="mr-2" />
      ) : (
        <Download className="mr-2 h-4 w-4" />
      )}
      {isGenerating ? "Menyiapkan PDF..." : label}
    </Button>
  );
}