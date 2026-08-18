// app/page.tsx
//
// HALAMAN PUBLIK -- bisa diakses siapa saja TANPA login (lihat middleware.ts:
// PUBLIC_EXACT_ROUTES). Tujuannya keterbukaan informasi kehadiran untuk
// orang tua/wali murid & umum.
//
// Dashboard KHUSUS ADMIN/GURU/WALI KELAS yang lama (dengan aksi) sekarang
// ada di /dashboard (app/(protected)/dashboard/page.tsx), bukan lagi di "/".
import { AttendanceService, getTodayDateOnly } from "@/lib/services/attendance-service";
import { getAttendanceTrend } from "@/lib/services/report-service";
import { AttendanceTrendChart } from "@/components/dashboard/attendance-trend-chart";
import { PublicStatCard } from "@/components/publik/public-stat-card";
import { PublicClassStats } from "@/components/publik/public-class-stats";
import { PublicRecentAttendance } from "@/components/publik/public-recent-attendance";
import { PublicStudentSearch } from "@/components/publik/public-student-search";
import { PublicHeader } from "@/components/publik/public-header";
import { Users, CheckCircle2, Clock, UserX } from "lucide-react";

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

  const [recap, classBreakdown, recentActivity, dailyTrend, monthlyTrend] =
    await Promise.all([
      AttendanceService.getDailyRecap({ date: today }),
      AttendanceService.getClassBreakdown({ date: today }),
      AttendanceService.getRecentActivity({ date: today, limit: 8 }),
      // Grafik kehadiran total -- reuse persis service & komponen chart.js
      // yang sama dengan /dashboard (Section 26: satu sumber logic).
      getAttendanceTrend({ mode: "daily" }),
      getAttendanceTrend({ mode: "monthly" }),
    ]);

  const hadirTotal = recap.counts.HADIR + recap.counts.TERLAMBAT;
  const persentaseKehadiran =
    recap.totalSiswa > 0 ? Math.round((hadirTotal / recap.totalSiswa) * 100) : 0;

  return (
    <div className="min-h-screen bg-[#F8FAFA]">
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

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <PublicStatCard label="Total Siswa" value={recap.totalSiswa} icon={Users} tone="neutral" />
          <PublicStatCard
            label="Hadir"
            value={recap.counts.HADIR}
            icon={CheckCircle2}
            tone="success"
            sublabel={`${persentaseKehadiran}% kehadiran`}
          />
          <PublicStatCard
            label="Terlambat"
            value={recap.counts.TERLAMBAT}
            icon={Clock}
            tone="warning"
          />
          <PublicStatCard
            label="Belum Absen"
            value={recap.counts.BELUM_ABSEN}
            icon={UserX}
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