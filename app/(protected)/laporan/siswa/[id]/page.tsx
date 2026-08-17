import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getStudentAttendanceDetail } from "@/lib/services/report-service";
import { getTodayDateOnly } from "@/lib/services/attendance-service";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireAuth } from "@/lib/auth/session";

import { STATUS_LABEL, STATUS_BADGE_CLASS } from "@/lib/constants/attendance";
import { StudentExportButton } from "@/components/laporan/student-export-button";

function toISODateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function SummaryStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold text-foreground">{value}</p>
    </div>
  );
}

export default async function LaporanSiswaDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ mode?: string; date?: string; month?: string }>;
}) {
    await requireAuth();
  const { id } = await params;
  const raw = await searchParams;

  const today = getTodayDateOnly();
  const mode = raw.mode === "monthly" ? "monthly" : "daily";
  const date = raw.date || toISODateOnly(today);
  const month = raw.month || toISODateOnly(today).slice(0, 7);

  const detail = await getStudentAttendanceDetail(
    mode === "daily" ? { studentId: id, mode: "daily", date } : { studentId: id, mode: "monthly", month }
  );

  if (!detail) {
    notFound();
  }

  const backHref = `/laporan?mode=${mode}${mode === "daily" ? `&date=${date}` : `&month=${month}`}`;

  // Dipakai oleh tombol toggle mode (Harian/Bulanan) agar date/month yang
  // sedang aktif tetap terbawa saat berpindah mode.
  const modeQuery = (nextMode: "daily" | "monthly") => {
    const params = new URLSearchParams();
    params.set("mode", nextMode);
    if (nextMode === "daily") params.set("date", date);
    else params.set("month", month);
    return `/laporan/siswa/${id}?${params.toString()}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Button variant="ghost" size="sm" render={<Link href={backHref} />} className="mb-2 -ml-2">
            ← Kembali ke Laporan
          </Button>
          <h1 className="text-2xl font-semibold text-foreground">{detail.student.name}</h1>
          <p className="text-sm text-muted-foreground">
            NIS {detail.student.nis} • NISN {detail.student.nisn} • {detail.student.className}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{detail.period.label}</p>
        </div>
        <StudentExportButton studentId={id} mode={mode} date={date} month={month} />
      </div>

      {/* Filter: mode Harian/Bulanan + pemilih tanggal/bulan, mengikuti pola
          filter di halaman /laporan agar konsisten. */}
      <div className="flex flex-wrap items-end gap-3 rounded-lg border p-4">
        <div className="space-y-1">
          <Label>Mode</Label>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant={mode === "daily" ? "default" : "outline"}
              render={<Link href={modeQuery("daily")} />}
            >
              Harian
            </Button>
            <Button
              type="button"
              size="sm"
              variant={mode === "monthly" ? "default" : "outline"}
              render={<Link href={modeQuery("monthly")} />}
            >
              Bulanan
            </Button>
          </div>
        </div>

        <form className="flex flex-wrap items-end gap-3" method="get">
          <input type="hidden" name="mode" value={mode} />

          {mode === "daily" ? (
            <div className="space-y-1">
              <Label htmlFor="date">Tanggal</Label>
              <Input
                id="date"
                type="date"
                name="date"
                defaultValue={date}
                max={toISODateOnly(today)}
              />
            </div>
          ) : (
            <div className="space-y-1">
              <Label htmlFor="month">Bulan</Label>
              <Input
                id="month"
                type="month"
                name="month"
                defaultValue={month}
                max={toISODateOnly(today).slice(0, 7)}
              />
            </div>
          )}

          <Button type="submit" variant="outline">
            Terapkan
          </Button>
        </form>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryStat label="Hadir" value={detail.summary.hadir} />
        <SummaryStat label="Terlambat" value={detail.summary.terlambat} />
        <SummaryStat label="Sakit" value={detail.summary.sakit} />
        <SummaryStat label="Izin" value={detail.summary.izin} />
        <SummaryStat label="Dispensasi" value={detail.summary.dispensasi} />
        <SummaryStat label="Alpha" value={detail.summary.alpha} />
        <SummaryStat label="Belum Diisi" value={detail.summary.belumAbsen} />
        <SummaryStat label="% Kehadiran" value={`${detail.summary.persentaseKehadiran}%`} />
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tanggal</TableHead>
              <TableHead>Hari</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Jam Masuk</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {detail.log.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  Tidak ada hari sekolah pada periode ini.
                </TableCell>
              </TableRow>
            )}
            {detail.log.map((entry) => (
              <TableRow key={entry.date}>
                <TableCell>
                  {new Intl.DateTimeFormat("id-ID", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                    timeZone: "UTC",
                  }).format(new Date(`${entry.date}T00:00:00.000Z`))}
                </TableCell>
                <TableCell>{entry.weekday}</TableCell>
                <TableCell>
                  <Badge className={STATUS_BADGE_CLASS[entry.status]}>
                    {STATUS_LABEL[entry.status]}
                  </Badge>
                </TableCell>
                <TableCell>
                  {entry.checkInAt
                    ? new Intl.DateTimeFormat("id-ID", {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                        timeZone: "Asia/Jakarta",
                      }).format(new Date(entry.checkInAt))
                    : "-"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}