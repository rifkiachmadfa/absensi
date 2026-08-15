import { jsPDF } from "jspdf";
import type { StudentIdCardData } from "@/components/kartu-siswa/student-id-card";

// Ukuran kartu ID standar (CR80, ~85.6mm x 54mm).
// Setiap kartu = 1 halaman PDF berukuran PERSIS sebesar kartu itu sendiri,
// jadi tidak ada spasi/margin kosong sama sekali di file PDF.
export const CARD_WIDTH_MM = 85.6;
export const CARD_HEIGHT_MM = 54;

export function buildStudentCardsPdf(
  cards: StudentIdCardData[],
  schoolName: string
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
    drawCard(doc, card, schoolName);
  });

  return doc;
}

function drawCard(doc: jsPDF, card: StudentIdCardData, schoolName: string) {
  // Background putih penuh 1 halaman (tanpa margin)
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, CARD_WIDTH_MM, CARD_HEIGHT_MM, "F");

  // Header
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0);
  doc.text(schoolName.toUpperCase(), 3, 5, {
    maxWidth: CARD_WIDTH_MM - 6,
  });
  doc.setFontSize(6);
  doc.setFont("helvetica", "normal");
  doc.text("KARTU TANDA SISWA", 3, 8);

  doc.setDrawColor(220);
  doc.line(2, 10, CARD_WIDTH_MM - 2, 10);

  // QR code
  const qrSize = 22;
  const qrX = 3;
  const qrY = 13;
  if (card.qrCodeDataUrl) {
    doc.addImage(card.qrCodeDataUrl, "PNG", qrX, qrY, qrSize, qrSize);
  }

  // Info siswa
  const textX = qrX + qrSize + 4;
  let textY = qrY + 4;
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text(card.name, textX, textY, {
    maxWidth: CARD_WIDTH_MM - textX - 3,
  });
  textY += 5;

  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text(`NIS: ${card.nis}`, textX, textY);
  textY += 4;
  doc.text(`NISN: ${card.nisn ?? "-"}`, textX, textY);
  textY += 4;
  doc.text(`Kelas: ${card.className}`, textX, textY);

  // Footer
  doc.setFontSize(5);
  doc.setTextColor(120);
  doc.text(
    "Kartu ini adalah identitas resmi absensi siswa",
    CARD_WIDTH_MM / 2,
    CARD_HEIGHT_MM - 2,
    { align: "center" }
  );
  doc.setTextColor(0);
}