// lib/pdf/student-card-pdf.ts
import { jsPDF } from "jspdf";
import type { StudentIdCardData } from "@/components/kartu-siswa/student-id-card";
import { getMajorTheme } from "@/lib/kartu-siswa/major-theme";

// Ukuran kartu ID standar CR80 (85.6mm x 54mm), dicetak PORTRAIT agar pas
// digantung di lanyard: 54mm (lebar) x 85.6mm (tinggi).
// Setiap kartu = 1 halaman PDF berukuran PERSIS sebesar kartu itu sendiri.
export const CARD_WIDTH_MM = 54;
export const CARD_HEIGHT_MM = 85.6;

const MARGIN_X = 4.5;

export type StudentIdCardPdfData = StudentIdCardData & {
  /** Avatar DiceBear dalam bentuk data URL PNG (hasil konversi di client). */
  avatarDataUrl?: string;
};

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const bigint = parseInt(clean, 16);
  return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
}

/**
 * Bungkus teks ke beberapa baris (maksimal `maxLines`). Jika teks masih
 * terlalu panjang untuk baris terakhir, potong dan tambahkan "…" — ini
 * mencegah teks tumpang tindih dengan elemen di bawahnya dalam skenario
 * apa pun (nama sekolah/siswa sangat panjang, dsb).
 */
function wrapLines(
  doc: jsPDF,
  text: string,
  maxWidth: number,
  maxLines: number
): string[] {
  const raw = doc.splitTextToSize(text, maxWidth) as string[];
  if (raw.length <= maxLines) return raw;
  const lines = raw.slice(0, maxLines);
  let last = lines[maxLines - 1].trimEnd();
  while (doc.getTextWidth(last + "\u2026") > maxWidth && last.length > 1) {
    last = last.slice(0, -1).trimEnd();
  }
  lines[maxLines - 1] = last + "\u2026";
  return lines;
}

function drawLinesLeft(
  doc: jsPDF,
  lines: string[],
  x: number,
  startY: number,
  lineHeight: number
): number {
  lines.forEach((line, i) => doc.text(line, x, startY + i * lineHeight));
  return startY + (lines.length - 1) * lineHeight;
}

function drawLinesCenter(
  doc: jsPDF,
  lines: string[],
  centerX: number,
  startY: number,
  lineHeight: number
): number {
  lines.forEach((line, i) =>
    doc.text(line, centerX, startY + i * lineHeight, { align: "center" })
  );
  return startY + (lines.length - 1) * lineHeight;
}

export function buildStudentCardsPdf(
  cards: StudentIdCardPdfData[],
  schoolName: string,
  logoDataUrl?: string
): jsPDF {
  const doc = new jsPDF({
    unit: "mm",
    format: [CARD_WIDTH_MM, CARD_HEIGHT_MM],
    orientation: "portrait",
  });

  cards.forEach((card, index) => {
    if (index > 0) {
      doc.addPage([CARD_WIDTH_MM, CARD_HEIGHT_MM], "portrait");
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
  const bandTextColor: [number, number, number] = bandTextIsDark
    ? [58, 46, 0]
    : [255, 255, 255];

  const centerX = CARD_WIDTH_MM / 2;
  const contentWidth = CARD_WIDTH_MM - MARGIN_X * 2;

  // Background
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, CARD_WIDTH_MM, CARD_HEIGHT_MM, "F");

  // ============================================================
  // HEADER BAND — tingginya dihitung dari kebutuhan kontennya
  // sendiri (logo, nama sekolah yang bisa wrap, caption, badge),
  // sehingga TIDAK PERNAH ada teks yang saling menabrak.
  // ============================================================
  const logoSize = 7;
  const logoX = 4;
  const logoY = 3.2;
  const textX = logoDataUrl ? logoX + logoSize + 2.2 : 4;

  // Badge jurusan (pojok kanan atas) dihitung lebih dulu, supaya kolom
  // nama sekolah tahu persis sisa lebar yang aman dipakai (tidak pernah
  // bertabrakan dengan badge).
  const badgeLabel = (card.major?.trim() || theme.label).toUpperCase();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6);
  const badgeWidth = doc.getTextWidth(badgeLabel) + 4;
  const badgeHeight = 4.2;
  const badgeX = CARD_WIDTH_MM - badgeWidth - 4;
  const badgeY = 3.2;

  // Nama sekolah — boleh wrap sampai 3 baris (jarang perlu lebih dari 2)
  // supaya nama sekolah tidak pernah terpotong dalam kasus wajar.
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.4);
  const nameMaxWidth = badgeX - textX - 2;
  const schoolLines = wrapLines(doc, schoolName.toUpperCase(), nameMaxWidth, 3);
  const schoolLineHeight = 2.9;
  const schoolBaseline = logoY + 2.6;
  const schoolBottom = schoolBaseline + (schoolLines.length - 1) * schoolLineHeight;

  const captionBaseline = schoolBottom + 3;
  const headerContentBottom = Math.max(
    captionBaseline + 1,
    logoY + logoSize,
    badgeY + badgeHeight
  );
  const bandHeight = headerContentBottom + 2.4;

  doc.setFillColor(bandR, bandG, bandB);
  doc.rect(0, 0, CARD_WIDTH_MM, bandHeight, "F");

  // Logo sekolah
  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, "PNG", logoX, logoY, logoSize, logoSize, undefined, "FAST");
    } catch {
      // Abaikan bila logo gagal dimuat — kartu tetap valid tanpa logo.
    }
  }

  // Nama sekolah + caption
  doc.setTextColor(...bandTextColor);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.4);
  drawLinesLeft(doc, schoolLines, textX, schoolBaseline, schoolLineHeight);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(4.4);
  doc.text("KARTU TANDA MURID", textX, captionBaseline);

  // Badge jurusan
  doc.setDrawColor(...bandTextColor);
  doc.setLineWidth(0.2);
  doc.roundedRect(badgeX, badgeY, badgeWidth, badgeHeight, 2.1, 2.1, "S");
  doc.setFontSize(6);
  doc.setFont("helvetica", "bold");
  doc.text(badgeLabel, badgeX + badgeWidth / 2, badgeY + badgeHeight - 1.3, {
    align: "center",
  });

  // ============================================================
  // AVATAR — diletakkan DI BAWAH header band (tidak overlap teks),
  // supaya aman di lebar kartu portrait yang sempit.
  // ============================================================
  const avatarSize = 12;
  const avatarGap = 2;
  const avatarY = bandHeight + avatarGap;
  const avatarX = centerX - avatarSize / 2;
  const avatarCx = centerX;
  const avatarCy = avatarY + avatarSize / 2;
  const avatarR = avatarSize / 2;

  // Background lingkaran (terlihat sebagai fallback bila avatar gagal dimuat).
  doc.setFillColor(241, 245, 245);
  doc.circle(avatarCx, avatarCy, avatarR, "F");

  if (card.avatarDataUrl) {
    try {
      // Potong gambar avatar (persegi) menjadi lingkaran: definisikan path
      // lingkaran, aktifkan sebagai clip, baru gambar image di dalamnya.
      // Tanpa ini, jsPDF akan menempelkan avatar sebagai kotak biasa.
      doc.saveGraphicsState();
      doc.circle(avatarCx, avatarCy, avatarR, null);
      doc.clip();
      doc.discardPath();
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
      doc.restoreGraphicsState();
    } catch {
      // Abaikan bila avatar gagal dimuat.
    }
  }

  // Cincin border putih tipis di atas avatar agar terlihat rapi menyatu
  // dengan latar kartu.
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.8);
  doc.circle(avatarCx, avatarCy, avatarR, "S");
  doc.setDrawColor(220, 231, 233);
  doc.setLineWidth(0.2);
  doc.circle(avatarCx, avatarCy, avatarR, "S");

  let yCursor = avatarY + avatarSize;

  // ============================================================
  // NAMA SISWA — boleh wrap sampai 2 baris, dihitung dinamis
  // supaya elemen berikutnya (NISN, badge kelas, QR) selalu
  // diposisikan SETELAH nama benar-benar selesai digambar.
  // ============================================================
  doc.setTextColor(23, 49, 58);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  const nameLines = wrapLines(doc, card.name, contentWidth, 2);
  const nameLineHeight = 3.9;
  const nameStartY = yCursor + 2.4 + 3.4;
  const nameBottom = drawLinesCenter(doc, nameLines, centerX, nameStartY, nameLineHeight);
  yCursor = nameBottom + 1.3;

  // NIS / NISN
  doc.setTextColor(72, 97, 106);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.8);
  const nisnText = `NIS ${card.nis} \u2022 NISN ${card.nisn ?? "-"}`;
  const nisnLines = wrapLines(doc, nisnText, contentWidth, 1);
  const nisnY = yCursor + 1.4 + 2.3;
  doc.text(nisnLines[0], centerX, nisnY, { align: "center" });
  yCursor = nisnY + 1;

  // Badge kelas — font mengecil otomatis bila nama kelas panjang, supaya
  // pill tidak pernah melebihi lebar kartu.
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  const classLabel = card.className;
  let classFontSize = 8;
  let classWidth = doc.getTextWidth(classLabel) + 8;
  while (classWidth > contentWidth && classFontSize > 6) {
    classFontSize -= 0.5;
    doc.setFontSize(classFontSize);
    classWidth = doc.getTextWidth(classLabel) + 8;
  }
  const pillHeight = 5.4;
  const pillY = yCursor + 1.4;
  const pillX = centerX - classWidth / 2;
  const [badgeBgR, badgeBgG, badgeBgB] = hexToRgb(theme.badgeBg);
  const [badgeTxtR, badgeTxtG, badgeTxtB] = hexToRgb(theme.badgeText);
  doc.setFillColor(badgeBgR, badgeBgG, badgeBgB);
  doc.roundedRect(pillX, pillY, classWidth, pillHeight, pillHeight / 2, pillHeight / 2, "F");
  doc.setTextColor(badgeTxtR, badgeTxtG, badgeTxtB);
  doc.text(classLabel, centerX, pillY + pillHeight / 2 + 1.5, { align: "center" });
  yCursor = pillY + pillHeight;

  // ============================================================
  // QR CODE — diperbesar secara dinamis mengisi sisa ruang yang
  // masih tersedia (dibatasi antara 16mm–32mm), jauh lebih besar
  // dari versi landscape sebelumnya (15mm), tanpa pernah menabrak
  // footer di bawahnya.
  // ============================================================
  const footerReserve = 4.6;
  const qrGap = 2.4;
  const framePadding = 1.6;
  const qrZoneTop = yCursor + qrGap;
  const availableForQr =
    CARD_HEIGHT_MM - qrZoneTop - footerReserve - framePadding * 2;
  const qrImageSize = Math.max(16, Math.min(availableForQr, 32));
  const frameSize = qrImageSize + framePadding * 2;
  const frameX = centerX - frameSize / 2;
  const frameY = qrZoneTop;
  doc.setDrawColor(220, 231, 233);
  doc.setLineWidth(0.25);
  doc.roundedRect(frameX, frameY, frameSize, frameSize, 2, 2, "S");
  if (card.qrCodeDataUrl) {
    doc.addImage(
      card.qrCodeDataUrl,
      "PNG",
      centerX - qrImageSize / 2,
      frameY + framePadding,
      qrImageSize,
      qrImageSize
    );
  }
  yCursor = frameY + frameSize;

  // Footer caption
  doc.setTextColor(113, 133, 140);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(4.3);
  const footerLines = wrapLines(
    doc,
    `Identitas resmi absensi murid ${schoolName}`,
    contentWidth,
    1
  );
  doc.text(footerLines[0], centerX, CARD_HEIGHT_MM - 2, { align: "center" });
}