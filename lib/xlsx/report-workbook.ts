// lib/xlsx/report-workbook.ts
import "server-only";
import ExcelJS from "exceljs";
import type {
  ClassAttendanceMatrix,
  ReportPayload,
  ReportPeriod,
  StatusCounts,
  StudentReportDetail,
} from "@/lib/services/report-service";
import { STATUS_LABEL } from "@/lib/constants/attendance";

const HEADER_FILL: ExcelJS.FillPattern = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF22949E" }, // Yadika Teal (brand primary) -- UI_RULES §3
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

// Subjudul periode yang dipakai bersama oleh semua workbook laporan.
function describePeriod(period: ReportPeriod): string {
  if (period.mode === "daily") return `Laporan Harian — ${period.label}`;
  const kind = period.mode === "weekly" ? "Mingguan" : "Bulanan";
  return `Laporan ${kind} — ${period.label} (${period.schoolDays} hari sekolah)`;
}

// ============================================================
// Sheet matriks kehadiran kelas: baris = siswa, kolom = tanggal (hari sekolah),
// diakhiri total per status + total masuk + persentase kehadiran. Kolom total
// berupa RUMUS Excel (COUNTIF) dengan nilai awal terisi, sehingga bila
// wali kelas mengoreksi satu sel status, totalnya ikut berubah.
// ============================================================

const STATUS_CODE: Record<string, string> = {
  HADIR: "H",
  TERLAMBAT: "T",
  SAKIT: "S",
  IZIN: "I",
  DISPENSASI: "D",
  ALPHA: "A",
  BELUM_ABSEN: "-",
};

// Warna status mengikuti UI_RULES §5 (success / warning / danger / info).
const STATUS_CELL_STYLE: Record<string, { fill: string; font: string }> = {
  H: { fill: "FFF0FDF4", font: "FF16A34A" },
  T: { fill: "FFFFFBEB", font: "FFD97706" },
  S: { fill: "FFEAF7F8", font: "FF17586F" },
  I: { fill: "FFEAF7F8", font: "FF17586F" },
  D: { fill: "FFEAF7F8", font: "FF17586F" },
  A: { fill: "FFFEF2F2", font: "FFDC2626" },
  "-": { fill: "FFF1F5F5", font: "FF71858C" },
};

// Urutan kolom total per status. HADIR & TERLAMBAT WAJIB berada di dua posisi
// pertama karena kolom "Total Masuk" menjumlahkan keduanya.
const SUMMARY_COLUMNS: { header: string; code: string; pick: (c: StatusCounts) => number }[] = [
  { header: "Hadir", code: "H", pick: (c) => c.hadir },
  { header: "Terlambat", code: "T", pick: (c) => c.terlambat },
  { header: "Sakit", code: "S", pick: (c) => c.sakit },
  { header: "Izin", code: "I", pick: (c) => c.izin },
  { header: "Dispensasi", code: "D", pick: (c) => c.dispensasi },
  { header: "Alpha", code: "A", pick: (c) => c.alpha },
];

const FIXED_COLUMNS = 3; // No, Nama, NIS

// Sel berisi rumus + nilai hasil awal (supaya terbaca di viewer yang tidak
// menghitung ulang). `date1904` wajib di typings exceljs 3.4; false = default Excel.
function formulaCell(formula: string, result: number): ExcelJS.CellFormulaValue {
  return { formula, result, date1904: false };
}

// "2026-02-01" -> "1/2/26"
function formatShortDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  return `${Number(day)}/${Number(month)}/${year.slice(2)}`;
}

function addClassMatrixSheet(
  workbook: ExcelJS.Workbook,
  matrix: ClassAttendanceMatrix,
  schoolName: string
) {
  const dateCount = matrix.dates.length;
  const firstDateCol = FIXED_COLUMNS + 1;
  const lastDateCol = FIXED_COLUMNS + Math.max(dateCount, 1);
  const summaryStartCol = lastDateCol + 1;
  // Kolom ringkasan: 6 status + Belum Diisi + Total Masuk + % Kehadiran
  const totalMasukCol = summaryStartCol + SUMMARY_COLUMNS.length + 1;
  const percentCol = totalMasukCol + 1;
  const columnCount = percentCol;

  const sheet = workbook.addWorksheet("Rekap Kelas", {
    views: [{ state: "frozen", xSplit: 2, ySplit: 5 }],
    pageSetup: {
      orientation: "landscape",
      paperSize: 9, // A4
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      printTitlesRow: "4:5",
    },
  });

  const letter = (col: number) => sheet.getColumn(col).letter;

  sheet.getColumn(1).width = 5;
  sheet.getColumn(2).width = 30;
  sheet.getColumn(3).width = 12;
  for (let c = firstDateCol; c <= lastDateCol; c++) sheet.getColumn(c).width = 9;
  for (let c = summaryStartCol; c <= totalMasukCol; c++) sheet.getColumn(c).width = 11;
  sheet.getColumn(percentCol).width = 13;

  addTitleBlock(
    sheet,
    schoolName,
    `Rekap Kehadiran Kelas ${matrix.className} — ${describePeriod(matrix.period)}`,
    columnCount
  );

  // ---- Header 2 baris: baris 4 = tanggal / judul kolom, baris 5 = nama hari ----
  const headerTop = sheet.getRow(4);
  const headerBottom = sheet.getRow(5);

  const fixedHeaders = ["No", "Nama Siswa", "NIS"];
  fixedHeaders.forEach((text, i) => {
    headerTop.getCell(i + 1).value = text;
    sheet.mergeCells(4, i + 1, 5, i + 1);
  });

  if (dateCount === 0) {
    headerTop.getCell(firstDateCol).value = "Tanggal";
    headerBottom.getCell(firstDateCol).value = "-";
  } else {
    matrix.dates.forEach((d, i) => {
      headerTop.getCell(firstDateCol + i).value = formatShortDate(d.date);
      headerBottom.getCell(firstDateCol + i).value = d.weekday.slice(0, 3);
    });
  }

  const summaryHeaders = [
    ...SUMMARY_COLUMNS.map((c) => c.header),
    "Belum Diisi",
    "Total Masuk",
    "% Kehadiran",
  ];
  summaryHeaders.forEach((text, i) => {
    const col = summaryStartCol + i;
    headerTop.getCell(col).value = text;
    sheet.mergeCells(4, col, 5, col);
  });

  styleHeaderRow(headerTop);
  styleHeaderRow(headerBottom);
  headerBottom.eachCell((cell) => {
    cell.font = { ...HEADER_FONT, size: 9 };
  });
  headerTop.height = 22;
  headerBottom.height = 16;

  // ---- Baris data ----
  const dateRangeFor = (row: number) =>
    `${letter(firstDateCol)}${row}:${letter(lastDateCol)}${row}`;

  if (matrix.students.length === 0) {
    sheet.mergeCells(6, 1, 6, columnCount);
    const empty = sheet.getCell(6, 1);
    empty.value = "Tidak ada siswa aktif di kelas ini.";
    empty.font = { italic: true, color: { argb: "FF71858C" } };
    empty.alignment = { horizontal: "center" };
  }

  matrix.students.forEach((siswa, index) => {
    const rowNumber = 6 + index;
    const row = sheet.getRow(rowNumber);

    row.getCell(1).value = index + 1;
    row.getCell(2).value = siswa.name;
    row.getCell(3).value = siswa.nis;
    row.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
    row.getCell(3).alignment = { horizontal: "center", vertical: "middle" };

    siswa.statuses.forEach((status, i) => {
      const code = STATUS_CODE[status] ?? "-";
      const cell = row.getCell(firstDateCol + i);
      const style = STATUS_CELL_STYLE[code];
      cell.value = code;
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.font = { bold: true, color: { argb: style.font } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: style.fill } };
    });

    const range = dateRangeFor(rowNumber);
    SUMMARY_COLUMNS.forEach((col, i) => {
      row.getCell(summaryStartCol + i).value = formulaCell(
        `COUNTIF(${range},"${col.code}")`,
        col.pick(siswa.counts)
      );
    });

    const firstSummary = letter(summaryStartCol);
    const lastStatusSummary = letter(summaryStartCol + SUMMARY_COLUMNS.length - 1);
    const belumCol = summaryStartCol + SUMMARY_COLUMNS.length;
    row.getCell(belumCol).value = formulaCell(
      `${dateCount}-SUM(${firstSummary}${rowNumber}:${lastStatusSummary}${rowNumber})`,
      siswa.counts.belumAbsen
    );

    const totalMasuk = siswa.counts.hadir + siswa.counts.terlambat;
    row.getCell(totalMasukCol).value = formulaCell(
      `${letter(summaryStartCol)}${rowNumber}+${letter(summaryStartCol + 1)}${rowNumber}`,
      totalMasuk
    );
    row.getCell(percentCol).value = formulaCell(
      dateCount > 0 ? `${letter(totalMasukCol)}${rowNumber}/${dateCount}` : "0",
      dateCount > 0 ? totalMasuk / dateCount : 0
    );
    row.getCell(percentCol).numFmt = "0%";

    for (let c = summaryStartCol; c <= percentCol; c++) {
      row.getCell(c).alignment = { horizontal: "center", vertical: "middle" };
    }
    row.getCell(totalMasukCol).font = { bold: true };
    row.getCell(percentCol).font = { bold: true };

    styleDataRow(row);
  });

  // ---- Keterangan kode status ----
  const legendRow = 6 + Math.max(matrix.students.length, 1) + 1;
  sheet.mergeCells(legendRow, 1, legendRow, columnCount);
  const legend = sheet.getCell(legendRow, 1);
  legend.value =
    "Keterangan: H = Hadir, T = Terlambat, S = Sakit, I = Izin, D = Dispensasi, A = Alpha, - = Belum diisi. " +
    "Persentase kehadiran = (Hadir + Terlambat) / jumlah hari sekolah pada periode.";
  legend.font = { italic: true, size: 9, color: { argb: "FF48616A" } };
  legend.alignment = { wrapText: true, vertical: "top" };
  sheet.getRow(legendRow).height = 28;
}

export function buildReportWorkbook(
  report: ReportPayload,
  schoolName: string,
  classMatrix?: ClassAttendanceMatrix
): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = schoolName;
  workbook.created = new Date();

  const periodSubtitle = describePeriod(report.period);

  // Saat filter kelas dipilih, sheet matriks (siswa x tanggal) menjadi sheet
  // pertama; sheet Ringkasan / Per Kelas / Per Siswa tetap ada setelahnya.
  if (classMatrix) {
    addClassMatrixSheet(workbook, classMatrix, schoolName);
    // Paksa Excel menghitung ulang rumus total saat file dibuka.
    workbook.calcProperties.fullCalcOnLoad = true;
  }

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

// ============================================================
// Workbook laporan per-siswa (dipakai oleh /laporan/siswa/[id] dan
// endpoint /api/laporan/siswa/[id]/export). Satu sheet ringkasan + satu
// sheet log harian, mengikuti gaya visual yang sama dengan buildReportWorkbook.
// ============================================================

export function buildStudentReportWorkbook(
  detail: StudentReportDetail,
  schoolName: string
): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = schoolName;
  workbook.created = new Date();

  const periodSubtitle = describePeriod(detail.period);
  const studentSubtitle = `${detail.student.name} — NIS ${detail.student.nis} — NISN ${detail.student.nisn} — ${detail.student.className}`;

  // ============================================================
  // Sheet 1: Ringkasan
  // ============================================================
  const ringkasan = workbook.addWorksheet("Ringkasan", {
    views: [{ state: "frozen", ySplit: 5 }],
  });
  ringkasan.columns = [{ width: 28 }, { width: 18 }];
  addTitleBlock(ringkasan, schoolName, periodSubtitle, 2);

  ringkasan.mergeCells(4, 1, 4, 2);
  const studentCell = ringkasan.getCell(4, 1);
  studentCell.value = studentSubtitle;
  studentCell.font = { size: 10, color: { argb: "FF475569" } };
  ringkasan.addRow([]);

  styleHeaderRow(ringkasan.addRow(["Indikator", "Jumlah"]));

  const summaryRows: [string, number | string][] = [
    ["Hadir", detail.summary.hadir],
    ["Terlambat", detail.summary.terlambat],
    ["Sakit", detail.summary.sakit],
    ["Izin", detail.summary.izin],
    ["Dispensasi", detail.summary.dispensasi],
    ["Alpha", detail.summary.alpha],
    ["Belum Diisi", detail.summary.belumAbsen],
    ["Total Hari Sekolah", detail.summary.totalSchoolDays],
    ["Persentase Kehadiran", `${detail.summary.persentaseKehadiran}%`],
  ];
  for (const [label, value] of summaryRows) {
    styleDataRow(ringkasan.addRow([label, value]));
  }

  // ============================================================
  // Sheet 2: Log Harian
  // ============================================================
  const logHeaders = ["Tanggal", "Hari", "Status", "Jam Masuk"];
  const log = workbook.addWorksheet("Log Harian", {
    views: [{ state: "frozen", ySplit: 4 }],
  });
  log.columns = [{ width: 16 }, { width: 12 }, { width: 14 }, { width: 14 }];
  addTitleBlock(log, schoolName, `${periodSubtitle} — ${studentSubtitle}`, logHeaders.length);
  styleHeaderRow(log.addRow(logHeaders));
  log.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: logHeaders.length } };

  for (const entry of detail.log) {
    const row = log.addRow([
      entry.date,
      entry.weekday,
      STATUS_LABEL[entry.status] ?? entry.status,
      entry.checkInAt
        ? new Intl.DateTimeFormat("id-ID", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            timeZone: "Asia/Jakarta",
          }).format(new Date(entry.checkInAt))
        : "-",
    ]);
    styleDataRow(row);
  }

  return workbook;
}