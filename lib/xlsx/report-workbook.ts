// lib/xlsx/report-workbook.ts
import "server-only";
import ExcelJS from "exceljs";
import type { ReportPayload } from "@/lib/services/report-service";

const HEADER_FILL: ExcelJS.FillPattern = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF2563EB" }, // primary blue -- UI_RULES §3
};

const HEADER_FONT: Partial<ExcelJS.Font> = {
  bold: true,
  color: { argb: "FFFFFFFF" },
};

const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: "FFE2E8F0" } },
  left: { style: "thin", color: { argb: "FFE2E8F0" } },
  bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
  right: { style: "thin", color: { argb: "FFE2E8F0" } },
};

function styleHeaderRow(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = THIN_BORDER;
  });
  row.height = 22;
}

function styleDataRow(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.border = THIN_BORDER;
    if (!cell.alignment) cell.alignment = { vertical: "middle" };
  });
}

function addTitleBlock(
  sheet: ExcelJS.Worksheet,
  title: string,
  subtitle: string,
  columnCount: number
) {
  sheet.mergeCells(1, 1, 1, columnCount);
  const titleCell = sheet.getCell(1, 1);
  titleCell.value = title;
  titleCell.font = { bold: true, size: 14, color: { argb: "FF0F172A" } };
  titleCell.alignment = { vertical: "middle" };
  sheet.getRow(1).height = 26;

  sheet.mergeCells(2, 1, 2, columnCount);
  const subtitleCell = sheet.getCell(2, 1);
  subtitleCell.value = subtitle;
  subtitleCell.font = { italic: true, size: 10, color: { argb: "FF64748B" } };
  sheet.getRow(2).height = 18;

  sheet.addRow([]); // baris kosong pemisah antara judul dan header tabel
}

export function buildReportWorkbook(report: ReportPayload, schoolName: string): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = schoolName;
  workbook.created = new Date();

  const periodSubtitle =
    report.period.mode === "daily"
      ? `Laporan Harian — ${report.period.label}`
      : `Laporan Bulanan — ${report.period.label} (${report.period.schoolDays} hari sekolah)`;

  // ============================================================
  // Sheet 1: Ringkasan
  // ============================================================
  const ringkasan = workbook.addWorksheet("Ringkasan", {
    views: [{ state: "frozen", ySplit: 4 }],
  });
  ringkasan.columns = [{ width: 28 }, { width: 18 }];
  addTitleBlock(ringkasan, schoolName, periodSubtitle, 2);

  styleHeaderRow(ringkasan.addRow(["Indikator", "Jumlah"]));

  const overallRows: [string, number | string][] = [
    ["Total Siswa", report.overall.totalSiswa],
    ["Hadir", report.overall.hadir],
    ["Terlambat", report.overall.terlambat],
    ["Sakit", report.overall.sakit],
    ["Izin", report.overall.izin],
    ["Dispensasi", report.overall.dispensasi],
    ["Alpha", report.overall.alpha],
    ["Belum Diisi", report.overall.belumAbsen],
    ["Persentase Kehadiran", `${report.overall.persentaseKehadiran}%`],
  ];
  for (const [label, value] of overallRows) {
    styleDataRow(ringkasan.addRow([label, value]));
  }

  // ============================================================
  // Sheet 2: Per Kelas
  // ============================================================
  const kelasHeaders = [
    "Kelas",
    "Total Siswa",
    "Hadir",
    "Terlambat",
    "Sakit",
    "Izin",
    "Dispensasi",
    "Alpha",
    "Belum Diisi",
    "% Kehadiran",
  ];
  const perKelas = workbook.addWorksheet("Per Kelas", {
    views: [{ state: "frozen", ySplit: 4 }],
  });
  perKelas.columns = [
    { width: 20 },
    { width: 12 },
    { width: 10 },
    { width: 12 },
    { width: 10 },
    { width: 10 },
    { width: 12 },
    { width: 10 },
    { width: 12 },
    { width: 14 },
  ];
  addTitleBlock(perKelas, schoolName, periodSubtitle, kelasHeaders.length);
  styleHeaderRow(perKelas.addRow(kelasHeaders));
  perKelas.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: kelasHeaders.length } };

  for (const kelas of report.perClass) {
    const row = perKelas.addRow([
      kelas.className,
      kelas.totalSiswa,
      kelas.hadir,
      kelas.terlambat,
      kelas.sakit,
      kelas.izin,
      kelas.dispensasi,
      kelas.alpha,
      kelas.belumAbsen,
      kelas.persentaseKehadiran / 100,
    ]);
    styleDataRow(row);
    row.getCell(10).numFmt = "0%";
  }

  // ============================================================
  // Sheet 3: Per Siswa
  // ============================================================
  const siswaHeaders = [
    "Nama",
    "NIS",
    "NISN",
    "Kelas",
    "Hadir",
    "Terlambat",
    "Sakit",
    "Izin",
    "Dispensasi",
    "Alpha",
    "Belum Diisi",
    "% Kehadiran",
  ];
  const perSiswa = workbook.addWorksheet("Per Siswa", {
    views: [{ state: "frozen", ySplit: 4 }],
  });
  perSiswa.columns = [
    { width: 28 },
    { width: 14 },
    { width: 16 },
    { width: 16 },
    { width: 10 },
    { width: 12 },
    { width: 10 },
    { width: 10 },
    { width: 12 },
    { width: 10 },
    { width: 12 },
    { width: 14 },
  ];
  addTitleBlock(perSiswa, schoolName, periodSubtitle, siswaHeaders.length);
  styleHeaderRow(perSiswa.addRow(siswaHeaders));
  perSiswa.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: siswaHeaders.length } };

  for (const siswa of report.perStudent) {
    const row = perSiswa.addRow([
      siswa.name,
      siswa.nis,
      siswa.nisn,
      siswa.className,
      siswa.hadir,
      siswa.terlambat,
      siswa.sakit,
      siswa.izin,
      siswa.dispensasi,
      siswa.alpha,
      siswa.belumAbsen,
      siswa.persentaseKehadiran / 100,
    ]);
    styleDataRow(row);
    row.getCell(12).numFmt = "0%";
  }

  return workbook;
}