// app/cek-kehadiran/[id]/page.tsx
//
// HALAMAN PUBLIK -- rekap kehadiran BULANAN satu siswa, bisa diakses siapa
// saja tanpa login. Reuse getStudentAttendanceDetail() yang sudah ada
// (lib/services/report-service.ts), mode "monthly" saja. Read-only
// sepenuhnya: tidak ada tombol ubah status, hapus, atau export.
import Link from "next/link";
import { notFound } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  ChevronLeft,
  Calendar,
  CheckCircle2,
  Clock,
  Stethoscope,
  FileText as FileIcon,
  BadgeCheck,
  XCircle,
  CircleDashed,
  TrendingUp,
} from "lucide-react";
import { getStudentById } from "@/lib/services/siswa-service";
import { getStudentAttendanceDetail } from "@/lib/services/report-service";
import { getTodayDateOnly } from "@/lib/services/attendance-service";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { STATUS_LABEL, STATUS_BADGE_CLASS } from "@/lib/constants/attendance";
import { PublicHeader } from "@/components/publik/public-header";

function toISODateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function attendancePctTone(pct: number) {
  if (pct >= 90) return { text: "text-[#16A34A]", bg: "bg-[#F0FDF4]" };
  if (pct >= 75) return { text: "text-[#D97706]", bg: "bg-[#FFFBEB]" };
  return { text: "text-[#DC2626]", bg: "bg-[#FEF2F2]" };
}

// Kartu ringkasan status -- warna & ikon mengikuti konvensi yang sama dengan
// components/publik/public-recent-attendance.tsx supaya konsisten di seluruh
// halaman publik (Hadir=success, Terlambat=warning, Sakit/Izin/Dispensasi=
// teal netral, Alpha=danger, Belum Diisi=neutral, %Kehadiran=brand primary).
function SummaryStat({
  label,
  value,
  icon: Icon,
  className,
  emphasis,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  className: string;
  emphasis?: boolean;
}) {
  return (
    <div
      className={`rounded-[14px] border p-4 ${
        emphasis ? "border-transparent" : "border-[#DCE7E9] bg-white"
      }`}
      style={emphasis ? { background: "linear-gradient(135deg, #17586F, #1C7F88)" } : undefined}
    >
      <div className="flex items-center justify-between gap-2">
        <p className={`text-[13px] ${emphasis ? "text-white/80" : "text-[#71858C]"}`}>
          {label}
        </p>
        <div
          className={`flex size-7 shrink-0 items-center justify-center rounded-[8px] ${
            emphasis ? "bg-white/15 text-white" : className
          }`}
        >
          <Icon className="size-3.5" strokeWidth={2.5} />
        </div>
      </div>
      <p className={`mt-1 text-2xl font-bold ${emphasis ? "text-white" : "text-[#17313A]"}`}>
        {value}
      </p>
    </div>
  );
}

export default async function CekKehadiranPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ month?: string }>;
}) {
  const { id } = await params;
  const raw = await searchParams;
  const today = getTodayDateOnly();
  const month = raw.month || toISODateOnly(today).slice(0, 7);

  // Guard tambahan khusus halaman publik: siswa nonaktif tidak ditampilkan
  // di sini, meski URL diketik/ditebak langsung.
  const student = await getStudentById(id);
  if (!student || student.status !== "ACTIVE") {
    notFound();
  }

  const detail = await getStudentAttendanceDetail({
    studentId: id,
    mode: "monthly",
    month,
  });
  if (!detail) {
    notFound();
  }

  const pctTone = attendancePctTone(detail.summary.persentaseKehadiran);

  return (
    <div className="min-h-screen bg-[#F8FAFA]">
      <PublicHeader />

      <main className="mx-auto max-w-4xl space-y-6 p-4 lg:p-6">
        <Button
          variant="ghost"
          size="sm"
          render={<Link href="/" />}
          className="-ml-2 gap-1 text-[#48616A] hover:bg-[#F1F5F5] hover:text-[#17313A]"
        >
          <ChevronLeft className="size-4" />
          Kembali ke Pencarian
        </Button>

        {/* Profil siswa -- avatar inisial + chip identitas, menggantikan
            heading polos supaya halaman terasa seperti "kartu identitas
            digital" (selaras dengan tema kartu siswa di UI_RULES §25). */}
        <div className="overflow-hidden rounded-[18px] border border-[#DCE7E9] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
          <div className="h-14 bg-gradient-to-r from-[#17586F] to-[#1C7F88]" />
          <div className="flex flex-col gap-4 px-5 pb-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="-mt-8 flex items-end gap-4">
              <div className="flex size-16 shrink-0 items-center justify-center rounded-full border-4 border-white bg-[#EAF7F8] text-[19px] font-bold text-[#17586F] shadow-sm">
                {initials(detail.student.name)}
              </div>
              <div className="min-w-0 pb-1">
                <h1 className="truncate text-[22px] font-bold tracking-tight text-[#17313A] sm:text-[26px]">
                  {detail.student.name}
                </h1>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  <span className="rounded-full bg-[#F1F5F5] px-2.5 py-1 text-[11px] font-medium text-[#48616A]">
                    NIS {detail.student.nis}
                  </span>
                  <span className="rounded-full bg-[#F1F5F5] px-2.5 py-1 text-[11px] font-medium text-[#48616A]">
                    NISN {detail.student.nisn}
                  </span>
                  <span className="rounded-full bg-[#EAF7F8] px-2.5 py-1 text-[11px] font-medium text-[#17586F]">
                    {detail.student.className}
                  </span>
                </div>
              </div>
            </div>

            <div className={`flex shrink-0 items-center gap-2 rounded-[12px] px-3 py-2 ${pctTone.bg}`}>
              <TrendingUp className={`size-4 ${pctTone.text}`} strokeWidth={2.5} />
              <div>
                <p className={`text-lg font-bold leading-none ${pctTone.text}`}>
                  {detail.summary.persentaseKehadiran}%
                </p>
                <p className="mt-0.5 text-[11px] text-[#71858C]">{detail.period.label}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filter bulan -- read-only, hanya untuk memilih periode yang
            ditampilkan (bukan aksi yang mengubah data). */}
        <form
          className="flex flex-wrap items-end gap-3 rounded-[14px] border border-[#DCE7E9] bg-white p-4"
          method="get"
        >
          <div className="space-y-1">
            <Label htmlFor="month" className="flex items-center gap-1.5 text-[#48616A]">
              <Calendar className="size-3.5" />
              Bulan
            </Label>
            <Input
              id="month"
              type="month"
              name="month"
              defaultValue={month}
              max={toISODateOnly(today).slice(0, 7)}
              className="border-[#DCE7E9] focus-visible:border-[#22949E] focus-visible:ring-[#22949E]/20"
            />
          </div>
          <Button
            type="submit"
            className="rounded-[10px] bg-[#22949E] text-white hover:bg-[#1C7F88]"
          >
            Terapkan
          </Button>
        </form>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SummaryStat
            label="Hadir"
            value={detail.summary.hadir}
            icon={CheckCircle2}
            className="bg-[#F0FDF4] text-[#16A34A]"
          />
          <SummaryStat
            label="Terlambat"
            value={detail.summary.terlambat}
            icon={Clock}
            className="bg-[#FFFBEB] text-[#D97706]"
          />
          <SummaryStat
            label="Sakit"
            value={detail.summary.sakit}
            icon={Stethoscope}
            className="bg-[#EAF7F8] text-[#17586F]"
          />
          <SummaryStat
            label="Izin"
            value={detail.summary.izin}
            icon={FileIcon}
            className="bg-[#EAF7F8] text-[#17586F]"
          />
          <SummaryStat
            label="Dispensasi"
            value={detail.summary.dispensasi}
            icon={BadgeCheck}
            className="bg-[#EAF7F8] text-[#17586F]"
          />
          <SummaryStat
            label="Alpha"
            value={detail.summary.alpha}
            icon={XCircle}
            className="bg-[#FEF2F2] text-[#DC2626]"
          />
          <SummaryStat
            label="Belum Diisi"
            value={detail.summary.belumAbsen}
            icon={CircleDashed}
            className="bg-[#F1F5F5] text-[#48616A]"
          />
          <SummaryStat
            label="% Kehadiran"
            value={`${detail.summary.persentaseKehadiran}%`}
            icon={TrendingUp}
            className="bg-white/15 text-white"
            emphasis
          />
        </div>

        <div className="overflow-hidden rounded-[14px] border border-[#DCE7E9] bg-white">
          <Table>
            <TableHeader>
              <TableRow className="bg-[#F1F5F5] hover:bg-[#F1F5F5]">
                <TableHead className="text-[#48616A]">Tanggal</TableHead>
                <TableHead className="text-[#48616A]">Hari</TableHead>
                <TableHead className="text-[#48616A]">Status</TableHead>
                <TableHead className="text-[#48616A]">Jam Masuk</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {detail.log.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-[#71858C]">
                    Tidak ada hari sekolah pada periode ini.
                  </TableCell>
                </TableRow>
              )}
              {detail.log.map((entry) => (
                <TableRow key={entry.date} className="hover:bg-[#F8FAFA]">
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

        <p className="text-center text-xs text-[#71858C]">
          Data bersifat informasi saja. Hubungi wali kelas/admin sekolah jika
          ada data yang perlu dikoreksi.
        </p>
      </main>
    </div>
  );
}