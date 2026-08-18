// app/page.tsx
//
// HALAMAN PUBLIK -- bisa diakses siapa saja TANPA login (lihat middleware.ts:
// PUBLIC_EXACT_ROUTES). Tujuannya keterbukaan informasi kehadiran untuk
// orang tua/wali murid & umum.
//
// Dashboard KHUSUS ADMIN/GURU/WALI KELAS yang lama (dengan aksi) sekarang
// ada di /dashboard (app/(protected)/dashboard/page.tsx), bukan lagi di "/".
import { AttendanceService, getTodayDateOnly } from "@/lib/services/attendance-service";
import { StatCard } from "@/components/dashboard/stat-card";
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

  const [recap, classBreakdown, recentActivity] = await Promise.all([
    AttendanceService.getDailyRecap({ date: today }),
    AttendanceService.getClassBreakdown({ date: today }),
    AttendanceService.getRecentActivity({ date: today, limit: 8 }),
  ]);

  const hadirTotal = recap.counts.HADIR + recap.counts.TERLAMBAT;
  const persentaseKehadiran =
    recap.totalSiswa > 0 ? Math.round((hadirTotal / recap.totalSiswa) * 100) : 0;

  return (
    <div className="min-h-screen bg-[#F8FAFA]">
      <PublicHeader />

      <main className="mx-auto max-w-6xl space-y-6 p-4 lg:p-6">
        <div className="space-y-1">
          <p className="text-[13px] font-medium text-[#48616A]">
            {formatIndonesianDate(today)}
          </p>
          <h1 className="text-[26px] font-bold tracking-tight text-[#17313A]">
            Informasi Kehadiran Siswa
          </h1>
        </div>

        <PublicStudentSearch />

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Total Siswa" value={recap.totalSiswa} icon={Users} tone="neutral" />
          <StatCard
            label="Hadir"
            value={recap.counts.HADIR}
            icon={CheckCircle2}
            tone="success"
            sublabel={`${persentaseKehadiran}% kehadiran`}
          />
          <StatCard
            label="Terlambat"
            value={recap.counts.TERLAMBAT}
            icon={Clock}
            tone="warning"
          />
          <StatCard
            label="Belum Absen"
            value={recap.counts.BELUM_ABSEN}
            icon={UserX}
            tone="neutral"
          />
        </div>

        <PublicClassStats data={classBreakdown} />

        <PublicRecentAttendance items={recentActivity} />

        <footer className="pb-6 pt-2 text-center text-xs text-[#71858C]">
          SMK Yadika Tanjungsari Sumedang — Sistem Absensi Siswa
        </footer>
      </main>
    </div>
  );
}