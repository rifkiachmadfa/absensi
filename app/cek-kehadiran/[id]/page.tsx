// app/cek-kehadiran/[id]/page.tsx
//
// HALAMAN PUBLIK -- rekap kehadiran BULANAN satu siswa, bisa diakses siapa
// saja tanpa login. Reuse getStudentAttendanceDetail() yang sudah ada
// (lib/services/report-service.ts), mode "monthly" saja. Read-only
// sepenuhnya: tidak ada tombol ubah status, hapus, atau export.
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
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

function SummaryStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-[14px] border border-[#DCE7E9] bg-white p-4">
      <p className="text-[13px] text-[#71858C]">{label}</p>
      <p className="text-2xl font-bold text-[#17313A]">{value}</p>
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

        <div>
          <h1 className="text-[26px] font-bold tracking-tight text-[#17313A]">
            {detail.student.name}
          </h1>
          <p className="text-sm text-[#48616A]">
            NIS {detail.student.nis} • NISN {detail.student.nisn} •{" "}
            {detail.student.className}
          </p>
          <p className="mt-1 text-sm text-[#71858C]">{detail.period.label}</p>
        </div>

        {/* Filter bulan -- read-only, hanya untuk memilih periode yang
            ditampilkan (bukan aksi yang mengubah data). */}
        <form
          className="flex flex-wrap items-end gap-3 rounded-[14px] border border-[#DCE7E9] bg-white p-4"
          method="get"
        >
          <div className="space-y-1">
            <Label htmlFor="month">Bulan</Label>
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
          <SummaryStat label="Hadir" value={detail.summary.hadir} />
          <SummaryStat label="Terlambat" value={detail.summary.terlambat} />
          <SummaryStat label="Sakit" value={detail.summary.sakit} />
          <SummaryStat label="Izin" value={detail.summary.izin} />
          <SummaryStat label="Dispensasi" value={detail.summary.dispensasi} />
          <SummaryStat label="Alpha" value={detail.summary.alpha} />
          <SummaryStat label="Belum Diisi" value={detail.summary.belumAbsen} />
          <SummaryStat
            label="% Kehadiran"
            value={`${detail.summary.persentaseKehadiran}%`}
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