// lib/pdf/student-card-pdf.ts
import { jsPDF } from "jspdf";
import type { StudentIdCardData } from "@/components/kartu-siswa/student-id-card";
import { getMajorTheme } from "@/lib/kartu-siswa/major-theme";

// Ukuran kartu ID standar (CR80, ~85.6mm x 54mm).
// Setiap kartu = 1 halaman PDF berukuran PERSIS sebesar kartu itu sendiri.
export const CARD_WIDTH_MM = 85.6;
export const CARD_HEIGHT_MM = 54;

export type StudentIdCardPdfData = StudentIdCardData & {
  /** Avatar DiceBear dalam bentuk data URL PNG (hasil konversi di client). */
  avatarDataUrl?: string;
};

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const bigint = parseInt(clean, 16);
  return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
}

export function buildStudentCardsPdf(
  cards: StudentIdCardPdfData[],
  schoolName: string,
  logoDataUrl?: string
): jsPDF {
  const doc = new jsPDF({
    unit: "mm",
    format: [CARD_WIDTH_MM, CARD_HEIGHT_MM],
    orientation: "landscape",
  });

  cards.forEach((card, index) => {
    if (index > 0) {
      doc.addPage([CARD_WIDTH_MM, CARD_HEIGHT_MM], "landscape");
    }
    drawCard(doc, card, schoolName, logoDataUrl);
  });

  return doc;
}

function drawCard(
  doc: jsPDF,
  card: StudentIdCardPdfData,
  schoolName: string,
  logoDataUrl?: string
) {
  const theme = getMajorTheme(card.major);
  const [bandR, bandG, bandB] = hexToRgb(theme.gradientTo);
  // jsPDF tidak mendukung gradient asli, jadi header band memakai warna
  // solid (sisi paling terang dari gradient tema) sebagai pendekatan.
  const bandTextIsDark = theme.bandText.toUpperCase() !== "#FFFFFF";

  // Background
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, CARD_WIDTH_MM, CARD_HEIGHT_MM, "F");

  // Header band
  const bandHeight = 17;
  doc.setFillColor(bandR, bandG, bandB);
  doc.rect(0, 0, CARD_WIDTH_MM, bandHeight, "F");

  // Logo sekolah
  const logoSize = 8;
  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, "PNG", 3, 3, logoSize, logoSize, undefined, "FAST");
    } catch {
      // Abaikan bila logo gagal dimuat — kartu tetap valid tanpa logo.
    }
  }

  // Nama sekolah + label
  const textX = logoDataUrl ? 3 + logoSize + 2 : 3;
  if (bandTextIsDark) {
    doc.setTextColor(58, 46, 0);
  } else {
    doc.setTextColor(255, 255, 255);
  }
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text(schoolName.toUpperCase(), textX, 7, {
    maxWidth: CARD_WIDTH_MM - textX - 16,
  });
  doc.setFontSize(5.5);
  doc.setFont("helvetica", "normal");
  doc.text("KARTU TANDA MURID", textX, 10.5);

  // Badge jurusan (pojok kanan atas)
  const badgeLabel = (card.major?.trim() || theme.label).toUpperCase();
  doc.setFontSize(6);
  doc.setFont("helvetica", "bold");
  const badgeWidth = doc.getTextWidth(badgeLabel) + 4;
  doc.setDrawColor(bandTextIsDark ? 58 : 255, bandTextIsDark ? 46 : 255, bandTextIsDark ? 0 : 255);
  doc.setLineWidth(0.2);
  doc.roundedRect(CARD_WIDTH_MM - badgeWidth - 3, 3, badgeWidth, 5, 2.5, 2.5, "S");
  doc.text(badgeLabel, CARD_WIDTH_MM - badgeWidth - 1, 6.5);

  // Avatar (persegi membulat — jsPDF tidak clip lingkaran secara native)
  const avatarSize = 16;
  const avatarX = 3;
  const avatarY = bandHeight - 4;
  doc.setFillColor(241, 245, 245);
  doc.roundedRect(avatarX - 0.5, avatarY - 0.5, avatarSize + 1, avatarSize + 1, 2, 2, "F");
  if (card.avatarDataUrl) {
    try {
      doc.addImage(
        card.avatarDataUrl,
        "PNG",
        avatarX,
        avatarY,
        avatarSize,
        avatarSize,
        undefined,
        "FAST"
      );
    } catch {
      // Abaikan bila avatar gagal dimuat.
    }
  }

  // Info identitas
  const infoX = avatarX + avatarSize + 3;
  doc.setTextColor(23, 49, 58);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text(card.name, infoX, avatarY + 5, {
    maxWidth: CARD_WIDTH_MM - infoX - 3,
  });

  doc.setTextColor(72, 97, 106);
  doc.setFontSize(6);
  doc.setFont("helvetica", "normal");
  doc.text(`NIS ${card.nis} \u2022 NISN ${card.nisn ?? "-"}`, infoX, avatarY + 9);

  // Badge kelas
  const [badgeBgR, badgeBgG, badgeBgB] = hexToRgb(theme.badgeBg);
  const [badgeTxtR, badgeTxtG, badgeTxtB] = hexToRgb(theme.badgeText);
  doc.setFontSize(6.5);
  doc.setFont("helvetica", "bold");
  const classWidth = doc.getTextWidth(card.className) + 4;
  doc.setFillColor(badgeBgR, badgeBgG, badgeBgB);
  doc.roundedRect(infoX, avatarY + 11.5, classWidth, 4.5, 2.25, 2.25, "F");
  doc.setTextColor(badgeTxtR, badgeTxtG, badgeTxtB);
  doc.text(card.className, infoX + 2, avatarY + 14.5);

  // QR code / barcode
  const qrSize = 15;
  const qrX = CARD_WIDTH_MM - qrSize - 3;
  const qrY = CARD_HEIGHT_MM - qrSize - 3;
  doc.setDrawColor(220, 231, 233);
  doc.setLineWidth(0.2);
  doc.roundedRect(qrX - 0.8, qrY - 0.8, qrSize + 1.6, qrSize + 1.6, 1.5, 1.5, "S");
  if (card.qrCodeDataUrl) {
    doc.addImage(card.qrCodeDataUrl, "PNG", qrX, qrY, qrSize, qrSize);
  }

  // Footer caption
  doc.setFontSize(4.6);
  doc.setTextColor(113, 133, 140);
  doc.text(
    "Kartu ini adalah identitas resmi absensi murid",
    3,
    CARD_HEIGHT_MM - 3,
    { maxWidth: CARD_WIDTH_MM - qrSize - 8 }
  );
}