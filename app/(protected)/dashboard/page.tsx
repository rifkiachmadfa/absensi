import { requireAuth } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import {
  AttendanceService,
  getTodayDateOnly,
} from "@/lib/services/attendance-service";
import {
  getAttendanceTrend,
  getClassAttendanceTrend,
  getDisciplineMonthOptions,
  getTopDisciplinedStudents,
  getLowestAttendanceStudents,
  getTopLateStudents,
  getLateRecapToday,
} from "@/lib/services/report-service";
import { StatCard } from "@/components/dashboard/stat-card";
import { RecentAttendance } from "@/components/dashboard/recent-attendance";
import { ClassStats } from "@/components/dashboard/class-stats"; // ✅ benar
import { QuickActions } from "@/components/dashboard/quick-actions";
import { AttendanceTrendChart } from "@/components/dashboard/attendance-trend-chart";
import { ClassComparisonTrendChart } from "@/components/dashboard/class-comparison-trend-chart";
import { DisciplineLeaderboard } from "@/components/dashboard/discipline-leaderboard";
import { LowAttendanceLeaderboard } from "@/components/dashboard/low-attendance-leaderboard";
import { LateLeaderboard } from "@/components/dashboard/late-leaderboard";
import { LateRecapTodayCard } from "@/components/dashboard/late-recap-today-card";
import { DashboardRealtimeListener } from "@/components/dashboard/dashboard-realtime-listener";
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
  // Kapitalisasi awal kata (Intl id-ID kadang lowercase di beberapa runtime)
  return formatted.replace(/\b\w/g, (c) => c.toUpperCase());
}

export default async function DashboardPage() {
  const user = await requireAuth();
  const today = getTodayDateOnly();

  // WALI_KELAS hanya boleh melihat data kelasnya sendiri
  let classId: string | undefined;
  if (user.role === "WALI_KELAS") {
    const owned = await prisma.class.findFirst({
      where: { homeroomTeacherId: user.id },
      select: { id: true },
    });
    classId = owned?.id;
  }

  // Bulan yang tersedia di dropdown leaderboard kedisiplinan: bulan berjalan
  // + 5 bulan ke belakang (Agustus, Juli, ..., dst -- lihat
  // getDisciplineMonthOptions di report-service.ts).
  const disciplineMonths = getDisciplineMonthOptions();

  const [
    recap,
    classBreakdown,
    recentActivity,
    dailyTrend,
    monthlyTrend,
    classTrend,
    disciplineLeaderboards,
    lowAttendanceLeaderboards,
    lateLeaderboards,
    lateRecapToday,
  ] = await Promise.all([
    AttendanceService.getDailyRecap({ date: today, classId }),
    AttendanceService.getClassBreakdown({ date: today, classId }),
    AttendanceService.getRecentActivity({ date: today, classId, limit: 8 }),
    getAttendanceTrend({ mode: "daily", classId }),
    getAttendanceTrend({ mode: "monthly", classId }),
    getClassAttendanceTrend({ classId }),
    Promise.all(
      disciplineMonths.map((m) =>
        getTopDisciplinedStudents({ month: m.value, classId, limit: 5 })
      )
    ),
    Promise.all(
      disciplineMonths.map((m) =>
        getLowestAttendanceStudents({ month: m.value, classId, limit: 5 })
      )
    ),
    Promise.all(
      disciplineMonths.map((m) =>
        getTopLateStudents({ month: m.value, classId, limit: 5 })
      )
    ),
    getLateRecapToday({ classId }),
  ]);

  const hadirTotal = recap.counts.HADIR + recap.counts.TERLAMBAT;
  const persentaseKehadiran =
    recap.totalSiswa > 0 ? Math.round((hadirTotal / recap.totalSiswa) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Modern School — UI_RULES §9 (Page Title 24–30px / 600–700) & §3 (brand accent) */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <p className="text-[13px] font-medium text-[#48616A]">
            {formatIndonesianDate(today)}
          </p>
          <h1 className="text-[26px] font-bold tracking-tight text-[#17313A]">
            Selamat datang, {user.name.split(" ")[0]}
          </h1>
        </div>
      </div>
      <QuickActions role={user.role} />
      {/* Grafik tren kehadiran — diletakkan di atas shortcut Absensi/Laporan/
          Daftar Siswa sesuai permintaan; toggle Harian/Bulanan tidak butuh
          request tambahan karena kedua dataset sudah di-fetch sekaligus. */}
      <AttendanceTrendChart dailyPoints={dailyTrend.points} monthlyPoints={monthlyTrend.points} />

      {/* Baris kedua: kiri = perbandingan kehadiran antar kelas (Line Chart),
          kanan = Top 5 Murid Paling Disiplin (bulanan). */}
      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <ClassComparisonTrendChart data={classTrend} />
        </div>
        <div className="lg:col-span-2">
          <DisciplineLeaderboard leaderboards={disciplineLeaderboards} />
        </div>
      </div>



      {/* Statistic cards — UI_RULES §15, spacing kelipatan 4px. Rekap
          Keterlambatan Hari Ini digabung di sini karena bentuknya sama-sama
          angka ringkas + ikon (bukan leaderboard), jadi grid diperluas jadi
          5 kolom di layar besar. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard
          label="Total Siswa"
          value={recap.totalSiswa}
          icon={Users}
          tone="neutral"
        />
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
        <LateRecapTodayCard recap={lateRecapToday} />
      </div>

      {/* Baris tambahan: Top 5 Kehadiran Terendah & Top 5 Paling Sering
          Terlambat -- sama-sama leaderboard bulanan berdampingan, mengikuti
          pola visual DisciplineLeaderboard di atas. */}
      <div className="grid gap-4 lg:grid-cols-2">
        <LowAttendanceLeaderboard leaderboards={lowAttendanceLeaderboards} />
        <LateLeaderboard leaderboards={lateLeaderboards} />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <RecentAttendance items={recentActivity} />
        </div>
        <div className="lg:col-span-2">
          <ClassStats data={classBreakdown} />
        </div>
      </div>
    </div>
  );
}