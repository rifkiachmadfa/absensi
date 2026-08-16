import { requireAuth } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import {
  AttendanceService,
  getTodayDateOnly,
} from "@/lib/services/attendance-service";
import { StatCard } from "@/components/dashboard/stat-card";
import { RecentAttendance } from "@/components/dashboard/recent-attendance";
import { ClassStats } from "@/components/dashboard/class-stats"; // ✅ benar
import { QuickActions } from "@/components/dashboard/quick-actions";
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

  const [recap, classBreakdown, recentActivity] = await Promise.all([
    AttendanceService.getDailyRecap({ date: today, classId }),
    AttendanceService.getClassBreakdown({ date: today, classId }),
    AttendanceService.getRecentActivity({ date: today, classId, limit: 8 }),
  ]);

  const hadirTotal = recap.counts.HADIR + recap.counts.TERLAMBAT;
  const persentaseKehadiran =
    recap.totalSiswa > 0 ? Math.round((hadirTotal / recap.totalSiswa) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            {formatIndonesianDate(today)}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Selamat datang, {user.name.split(" ")[0]}
          </h1>
        </div>
      </div>

      <QuickActions role={user.role} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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