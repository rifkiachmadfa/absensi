import Link from "next/link";
import { requireRole } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import {
  getAttendanceReport,
  getReportClassOptions,
} from "@/lib/services/report-service";
import { getTodayDateOnly } from "@/lib/services/attendance-service";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ReportTabs } from "@/components/laporan/report-tabs";
import { ExportButton } from "@/components/laporan/export-button";

function toISODateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

export default async function LaporanPage({
  searchParams,
}: {
  searchParams: Promise<{
    mode?: string;
    date?: string;
    month?: string;
    classId?: string;
  }>;
}) {
  const actor = await requireRole(["SUPERADMIN", "ADMIN", "WALI_KELAS"]);
  const raw = await searchParams;

  const today = getTodayDateOnly();
  const mode = raw.mode === "monthly" ? "monthly" : "daily";
  const date = raw.date || toISODateOnly(today);
  const month = raw.month || toISODateOnly(today).slice(0, 7);

  let classId = raw.classId || undefined;

  // WALI_KELAS hanya boleh melihat laporan kelasnya sendiri -- classId dari
  // query string TIDAK dipercaya, selalu dipaksa dari data kelas yang diampu.
  let lockedClassName: string | null = null;
  if (actor.role === "WALI_KELAS") {
    const owned = await prisma.class.findFirst({
      where: { homeroomTeacherId: actor.id },
      select: { id: true, name: true },
    });
    classId = owned?.id;
    lockedClassName = owned?.name ?? null;
  }

  const [report, classOptions] = await Promise.all([
    getAttendanceReport(
      mode === "daily"
        ? { mode: "daily", date, classId }
        : { mode: "monthly", month, classId }
    ),
    actor.role === "WALI_KELAS" ? Promise.resolve([]) : getReportClassOptions(),
  ]);

  const query = (overrides: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const merged = { mode, date, month, classId: raw.classId, ...overrides };
    if (merged.mode) params.set("mode", merged.mode);
    if (merged.mode === "daily" && merged.date) params.set("date", merged.date);
    if (merged.mode === "monthly" && merged.month) params.set("month", merged.month);
    if (merged.classId) params.set("classId", merged.classId);
    return `/laporan?${params.toString()}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Laporan Absensi</h1>
          <p className="text-sm text-muted-foreground">{report.period.label}</p>
        </div>
        <ExportButton mode={mode} date={date} month={month} classId={classId} />
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border p-4">
        <div className="space-y-1">
          <Label>Mode</Label>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant={mode === "daily" ? "default" : "outline"}
              render={<Link href={query({ mode: "daily" })} />}
            >
              Harian
            </Button>
            <Button
              type="button"
              size="sm"
              variant={mode === "monthly" ? "default" : "outline"}
              render={<Link href={query({ mode: "monthly" })} />}
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

          {actor.role !== "WALI_KELAS" && (
            <div className="space-y-1">
              <Label htmlFor="classId">Kelas</Label>
              <Select name="classId" defaultValue={raw.classId ?? ""}>
                <SelectTrigger id="classId" className="w-44">
                  <SelectValue placeholder="Semua Kelas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Semua Kelas</SelectItem>
                  {classOptions.map((kelas) => (
                    <SelectItem key={kelas.id} value={kelas.id}>
                      {kelas.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <Button type="submit" variant="outline">
            Terapkan
          </Button>
        </form>

        {lockedClassName && (
          <p className="text-sm text-muted-foreground">
            Menampilkan laporan untuk kelas{" "}
            <span className="font-medium text-foreground">{lockedClassName}</span>{" "}
            (wali kelas).
          </p>
        )}
      </div>

      <ReportTabs report={report} />
    </div>
  );
}