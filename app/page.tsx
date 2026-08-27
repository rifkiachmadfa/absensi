// app/page.tsx
//
// HALAMAN PUBLIK -- bisa diakses siapa saja TANPA login (lihat middleware.ts:
// PUBLIC_EXACT_ROUTES). Tujuannya keterbukaan informasi kehadiran untuk
// orang tua/wali murid & umum.
//
// Dashboard KHUSUS ADMIN/GURU/WALI KELAS yang lama (dengan aksi) sekarang
// ada di /dashboard (app/(protected)/dashboard/page.tsx), bukan lagi di "/".
import { AttendanceService, getTodayDateOnly } from "@/lib/services/attendance-service";
import {
  getAttendanceTrend,
  getDisciplineMonthOptions,
  getLowestAttendanceStudents,
  getTopLateStudents,
  getLateRecapToday,
} from "@/lib/services/report-service";
import { AttendanceTrendChart } from "@/components/dashboard/attendance-trend-chart";
import { LowAttendanceLeaderboard } from "@/components/dashboard/low-attendance-leaderboard";
import { LateLeaderboard } from "@/components/dashboard/late-leaderboard";
import { LateRecapTodayCard } from "@/components/dashboard/late-recap-today-card";
import { PublicStatCard } from "@/components/publik/public-stat-card";
import { PublicClassStats } from "@/components/publik/public-class-stats";
import { PublicRecentAttendance } from "@/components/publik/public-recent-attendance";
import { PublicStudentSearch } from "@/components/publik/public-student-search";
import { PublicHeader } from "@/components/publik/public-header";
import {
  Users,
  CheckCircle2,
  Clock,
  Stethoscope,
  FileText,
  XCircle,
  HelpCircle,
} from "lucide-react";
import { PublicRealtimeListener } from "@/components/publik/public-realtime-listener";


// Halaman ini mengklaim "real-time" (lihat copy di hero section). Tanpa
// dynamic API (cookies/headers), Next.js akan men-static-render & meng-cache
// halaman ini. `revalidate` di sini adalah baseline ISR -- auto-refresh
// tiap 30 detik meski tidak ada revalidatePath("/") yang dipanggil dari
// action manapun. Perubahan lewat action/API tetap langsung terlihat
// karena masing-masing sudah memanggil revalidatePath("/").
//
// Agar tab yang SEDANG TERBUKA ikut update tanpa reload manual,
// <PublicRealtimeListener /> di bawah subscribe ke perubahan tabel
// Attendance via Supabase Realtime dan memanggil router.refresh() saat ada
// event masuk -- lihat components/publik/public-realtime-listener.tsx.
export const revalidate = 30;


const TIMEZONE = "Asia/Jakarta";

function formatIndonesianDate(date: Date) {
  const formatted = new Intl.DateTimeFormat("id-ID", {
    timeZone: TIMEZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
  return formatted.replace(/\b\w/g, (c) => c.toUpperCase());
}

export default async function PublicHomePage() {
  const today = getTodayDateOnly();

  // Bulan yang tersedia untuk kedua leaderboard di bawah -- sama persis
  // dengan yang dipakai leaderboard kedisiplinan di /dashboard
  // (getDisciplineMonthOptions), tanpa filter kelas karena halaman ini publik.
  const lowAttendanceLateMonths = getDisciplineMonthOptions();

  const [
    recap,
    classBreakdown,
    recentActivity,
    dailyTrend,
    monthlyTrend,
    lowAttendanceLeaderboards,
    lateLeaderboards,
    lateRecapToday,
  ] = await Promise.all([
    AttendanceService.getDailyRecap({ date: today }),
    AttendanceService.getClassBreakdown({ date: today }),
    AttendanceService.getRecentActivity({ date: today, limit: 8 }),
    // Grafik kehadiran total -- reuse persis service & komponen chart.js
    // yang sama dengan /dashboard (Section 26: satu sumber logic).
    getAttendanceTrend({ mode: "daily" }),
    getAttendanceTrend({ mode: "monthly" }),
    Promise.all(
      lowAttendanceLateMonths.map((m) =>
        getLowestAttendanceStudents({ month: m.value, limit: 5 })
      )
    ),
    Promise.all(
      lowAttendanceLateMonths.map((m) => getTopLateStudents({ month: m.value, limit: 5 }))
    ),
    getLateRecapToday(),
  ]);

  const hadirTotal = recap.counts.HADIR + recap.counts.TERLAMBAT;
  const persentaseKehadiran =
    recap.totalSiswa > 0 ? Math.round((hadirTotal / recap.totalSiswa) * 100) : 0;

  return (
    <div className="min-h-screen bg-[#F8FAFA]">
      <PublicRealtimeListener />
      <PublicHeader />

      {/* HERO -- gradient dekoratif dalam keluarga brand (UI_RULES §8: hanya
          #17586F -> #22949E yang diperbolehkan), dipakai terbatas untuk satu
          banner ini saja, bukan seluruh halaman. */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#17586F] to-[#1C7F88]">
        <div
          className="pointer-events-none absolute -right-16 -top-24 size-72 rounded-full bg-white/10 blur-2xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -left-10 bottom-0 size-56 rounded-full bg-[#FFCC31]/10 blur-2xl"
          aria-hidden
        />
        <div className="relative mx-auto max-w-6xl px-4 pb-16 pt-8 lg:px-6 lg:pb-20 lg:pt-10">
          <p className="text-[13px] font-medium text-white/70">
            {formatIndonesianDate(today)}
          </p>
          <h1 className="mt-1 max-w-xl text-[28px] font-bold tracking-tight text-white sm:text-[34px]">
            Informasi Kehadiran Siswa
          </h1>
          <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-white/80">
            Pantau kehadiran siswa SMK Yadika Tanjungsari Sumedang secara
            terbuka dan real-time, atau cari data kehadiran bulanan putra/i
            Bapak/Ibu di bawah ini.
          </p>
        </div>
      </section>

      <main className="relative mx-auto -mt-10 max-w-6xl space-y-6 px-4 pb-10 lg:-mt-12 lg:px-6">
        <PublicStudentSearch />

               <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
          <PublicStatCard
            label="Total Murid"
            value={recap.totalSiswa}
            icon={Users}
            tone="neutral"
          />
          <PublicStatCard
            label="Hadir"
            value={hadirTotal}
            icon={CheckCircle2}
            tone="success"
            sublabel={`${persentaseKehadiran}% (tepat waktu + terlambat)`}
          />
          <PublicStatCard
            label="Sakit"
            value={recap.counts.SAKIT}
            icon={Stethoscope}
            tone="info"
          />
          <PublicStatCard
            label="Izin"
            value={recap.counts.IZIN}
            icon={FileText}
            tone="primary"
          />
          <PublicStatCard
            label="Alpha"
            value={recap.counts.ALPHA}
            icon={XCircle}
            tone="danger"
          />
          <PublicStatCard
            label="Terlambat"
            value={recap.counts.TERLAMBAT}
            icon={Clock}
            tone="warning"
          />
          <PublicStatCard
            label="Tidak Diketahui"
            value={recap.counts.BELUM_ABSEN}
            icon={HelpCircle}
            tone="neutral"
          />
        </div>

        {/* Grafik kehadiran total -- komponen chart.js yang sama persis
            dengan /dashboard (AttendanceTrendChart), datanya pun bersumber
            dari service publik yang sama tanpa filter kelas. */}
        <AttendanceTrendChart dailyPoints={dailyTrend.points} monthlyPoints={monthlyTrend.points} />

        <div className="grid gap-4 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <PublicClassStats data={classBreakdown} />
          </div>
          <div className="lg:col-span-2">
            <PublicRecentAttendance items={recentActivity} />
          </div>
        </div>

        <footer className="pb-6 pt-2 text-center text-xs text-[#71858C]">
          SMK Yadika Tanjungsari Sumedang — Sistem Absensi Siswa
        </footer>
      </main>
    </div>
  );
}