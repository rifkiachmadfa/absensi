// components/kartu-siswa/download-pdf-button.tsx
"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { StudentIdCardData } from "@/components/kartu-siswa/student-id-card";
import { Spinner } from "@/components/ui/spinner";

/** Membersihkan nama file dari karakter yang tidak aman untuk sistem file. */
function sanitizeFileNamePart(value: string): string {
  const cleaned = value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-_]/g, "");
  return cleaned || "murid";
}

/** Memicu unduhan sebuah Blob di browser tanpa dependency tambahan. */
function triggerBlobDownload(blob: Blob, downloadName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = downloadName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function DownloadPdfButton({
  cards,
  schoolName,
  fileName,
  label,
}: {
  cards: StudentIdCardData[];
  schoolName: string;
  fileName: string;
  label?: string;
}) {
  const [isGenerating, setIsGenerating] = useState(false);
  // Lebih dari satu kartu (cetak per kelas / seluruh murid) diunduh sebagai
  // file PDF terpisah per murid, dibungkus dalam satu ZIP. Satu kartu
  // (cetak per murid) tetap diunduh sebagai satu file PDF seperti biasa.
  const isMultiple = cards.length > 1;

  async function handleDownload() {
    setIsGenerating(true);
    try {
      const [
        { buildStudentCardPdf },
        { fetchImageAsDataUrl },
        { getStudentAvatarUrl },
        { SCHOOL_LOGO_URL },
      ] = await Promise.all([
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

      if (!isMultiple) {
        const doc = buildStudentCardPdf(
          enrichedCards[0],
          schoolName,
          logoDataUrl ?? undefined
        );
        doc.save(fileName);
        return;
      }

      // Banyak kartu: setiap murid menjadi satu file PDF sendiri, lalu
      // seluruh file itu dibungkus dalam satu ZIP agar tetap satu unduhan.
      const { default: JSZip } = await import("jszip");
      const zip = new JSZip();
      const usedNames = new Set<string>();

      enrichedCards.forEach((card) => {
        const doc = buildStudentCardPdf(
          card,
          schoolName,
          logoDataUrl ?? undefined
        );
        const blob = doc.output("blob");

        const baseName = `kartu-murid-${sanitizeFileNamePart(
          card.nis || card.name
        )}`;
        let candidateName = `${baseName}.pdf`;
        let suffix = 2;
        while (usedNames.has(candidateName)) {
          candidateName = `${baseName}-${suffix}.pdf`;
          suffix += 1;
        }
        usedNames.add(candidateName);

        zip.file(candidateName, blob);
      });

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const zipFileName = `${fileName.replace(/\.pdf$/i, "")}.zip`;
      triggerBlobDownload(zipBlob, zipFileName);
    } finally {
      setIsGenerating(false);
    }
  }

  const defaultLabel = isMultiple
    ? "Download ZIP (per kartu)"
    : "Download PDF";

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
      {isGenerating
        ? isMultiple
          ? "Menyiapkan ZIP..."
          : "Menyiapkan PDF..."
        : label ?? defaultLabel}
    </Button>
  );
}