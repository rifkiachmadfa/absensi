import { requireAuth } from "@/lib/auth/session";
import {
  listAttendanceSchedules,
  getDefaultSchedule,
} from "@/lib/services/pengaturan-service";
import { ChangePasswordForm } from "@/components/pengaturan/change-password-form";
import { ThemeToggle } from "@/components/pengaturan/theme-toggle";
import { ScheduleDayRow } from "@/components/pengaturan/schedule-day-row";
import { DefaultScheduleForm } from "@/components/pengaturan/default-schedule-form";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";

export default async function PengaturanPage() {
  const actor = await requireAuth();
  const isSuperAdmin = actor.role === "SUPERADMIN";

  const [schedules, defaultSchedule] = isSuperAdmin
    ? await Promise.all([listAttendanceSchedules(), getDefaultSchedule()])
    : [null, null];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Pengaturan</h1>
        <p className="text-sm text-muted-foreground">
          Kelola akun dan preferensi tampilan Anda.
        </p>
      </div>

      <Tabs defaultValue="akun">
        <TabsList>
          <TabsTrigger value="akun">Akun Saya</TabsTrigger>
          <TabsTrigger value="tampilan">Tampilan</TabsTrigger>
          {isSuperAdmin && (
            <TabsTrigger value="jadwal">Jadwal Absensi</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="akun" className="space-y-6 pt-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              Ganti Password
            </h2>
            <p className="text-sm text-muted-foreground">
              Masukkan password saat ini untuk mengonfirmasi perubahan.
            </p>
          </div>
          <ChangePasswordForm />
        </TabsContent>

        <TabsContent value="tampilan" className="space-y-6 pt-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              Tampilan
            </h2>
            <p className="text-sm text-muted-foreground">
              Sesuaikan tema tampilan aplikasi.
            </p>
          </div>
          <ThemeToggle />
        </TabsContent>

        {isSuperAdmin && schedules && defaultSchedule && (
          <TabsContent value="jadwal" className="space-y-8 pt-4">
            <div className="space-y-2">
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  Jadwal Default
                </h2>
                <p className="text-sm text-muted-foreground">
                  Dipakai untuk hari yang tidak memiliki jadwal khusus di
                  bawah. Ini hanya patokan — status akhir kehadiran tetap
                  ditentukan manual oleh guru saat scan/absen manual.
                </p>
              </div>
              <DefaultScheduleForm
                defaultCheckInTime={defaultSchedule.defaultCheckInTime}
                lateAfter={defaultSchedule.lateAfter}
              />
            </div>

            <div className="space-y-2">
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  Jadwal Per Hari
                </h2>
                <p className="text-sm text-muted-foreground">
                  Aktifkan &quot;Khusus&quot; untuk hari yang jadwalnya
                  berbeda dari default, misalnya Jumat masuk lebih siang.
                </p>
              </div>
              <div className="rounded-lg border">
                {schedules.map((schedule) => (
                  <ScheduleDayRow
                    key={`${schedule.dayOfWeek}-${schedule.isActive}-${schedule.checkInStart}-${schedule.lateAfter}`}
                    schedule={schedule}
                    defaultCheckInTime={defaultSchedule.defaultCheckInTime}
                    defaultLateAfter={defaultSchedule.lateAfter}
                  />
                ))}
              </div>
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}