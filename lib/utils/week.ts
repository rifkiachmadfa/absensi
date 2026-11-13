// Helper minggu ISO 8601 (format yang dipakai <input type="week">, mis. "2026-W33").
// Pure function tanpa dependensi server, aman dipakai di server maupun client.
//
// Semua `Date` di sini adalah "date-only" (midnight UTC yang merepresentasikan
// tanggal kalender Asia/Jakarta) -- konsisten dengan getTodayDateOnly() di
// attendance-service.ts, jadi hari dibaca lewat getUTCDay(), bukan getDay().

const WEEK_PATTERN = /^(\d{4})-W(\d{2})$/;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

// Date -> "YYYY-Www". Tahun ISO ditentukan oleh hari Kamis pada minggu tsb,
// sehingga 1 Januari bisa masuk minggu 52/53 tahun sebelumnya.
export function toIsoWeek(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayOfWeek = d.getUTCDay() || 7; // Senin = 1 ... Minggu = 7
  d.setUTCDate(d.getUTCDate() + 4 - dayOfWeek); // geser ke Kamis minggu ini
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - yearStart) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${pad2(week)}`;
}

// "YYYY-Www" -> tanggal SENIN minggu tsb. Mengembalikan null jika format salah
// atau minggu tidak ada pada tahun itu (mis. "2026-W53": 2026 hanya 53 minggu
// pada beberapa tahun saja).
export function parseIsoWeek(value: string | null | undefined): Date | null {
  const match = value ? WEEK_PATTERN.exec(value) : null;
  if (!match) return null;
  const year = Number(match[1]);
  const week = Number(match[2]);
  if (week < 1 || week > 53) return null;

  // 4 Januari selalu berada di minggu 1 ISO.
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4DayOfWeek = jan4.getUTCDay() || 7;
  const monday = new Date(Date.UTC(year, 0, 4 - (jan4DayOfWeek - 1) + (week - 1) * 7));

  // Tolak minggu yang "meluber" ke tahun berikutnya (mis. W53 yang tidak ada).
  return toIsoWeek(monday) === value ? monday : null;
}

// Nomor minggu ISO (1-53) dari tanggal.
export function isoWeekNumber(date: Date): number {
  return Number(toIsoWeek(date).slice(-2));
}
