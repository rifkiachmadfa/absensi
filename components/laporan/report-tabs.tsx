"use client";

import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ReportPayload } from "@/lib/services/report-service";

function Pct({ value }: { value: number }) {
  const tone =
    value >= 90 ? "text-green-700" : value >= 75 ? "text-amber-700" : "text-red-700";
  return <span className={`font-semibold ${tone}`}>{value}%</span>;
}

function SummaryCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold text-foreground">{value}</p>
    </div>
  );
}

export function ReportTabs({ report }: { report: ReportPayload }) {
  const { overall, perClass, perStudent, period } = report;
  const detailQuery =
    period.mode === "daily" ? `mode=daily&date=${period.startDate}` : `mode=monthly&month=${period.startDate.slice(0, 7)}`;

  return (
    <Tabs defaultValue="ringkasan">
      <TabsList className="grid w-full grid-cols-3 sm:w-fit">
        <TabsTrigger value="ringkasan">Ringkasan</TabsTrigger>
        <TabsTrigger value="kelas">Per Kelas</TabsTrigger>
        <TabsTrigger value="siswa">Per Siswa</TabsTrigger>
      </TabsList>

      <TabsContent value="ringkasan" className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SummaryCard label="Total Siswa" value={overall.totalSiswa} />
          <SummaryCard label="Hadir" value={overall.hadir} />
          <SummaryCard label="Terlambat" value={overall.terlambat} />
          <SummaryCard label="Persentase Kehadiran" value={`${overall.persentaseKehadiran}%`} />
          <SummaryCard label="Sakit" value={overall.sakit} />
          <SummaryCard label="Izin" value={overall.izin} />
          <SummaryCard label="Dispensasi" value={overall.dispensasi} />
          <SummaryCard label="Alpha" value={overall.alpha} />
        </div>
        <p className="text-sm text-muted-foreground">
          {period.mode === "monthly"
            ? `${period.schoolDays} hari sekolah (Senin–Jumat) terhitung dalam periode ini.`
            : period.schoolDays === 0
              ? "Tanggal ini adalah akhir pekan (bukan hari sekolah)."
              : "Tanggal ini terhitung sebagai hari sekolah."}
        </p>
      </TabsContent>

      <TabsContent value="kelas">
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kelas</TableHead>
                <TableHead className="text-right">Total Siswa</TableHead>
                <TableHead className="text-right">Hadir</TableHead>
                <TableHead className="text-right">Terlambat</TableHead>
                <TableHead className="text-right">Sakit</TableHead>
                <TableHead className="text-right">Izin</TableHead>
                <TableHead className="text-right">Dispensasi</TableHead>
                <TableHead className="text-right">Alpha</TableHead>
                <TableHead className="text-right">Belum Diisi</TableHead>
                <TableHead className="text-right">% Hadir</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {perClass.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-muted-foreground">
                    Tidak ada data kelas.
                  </TableCell>
                </TableRow>
              )}
              {perClass.map((kelas) => (
                <TableRow key={kelas.classId}>
                  <TableCell className="font-medium">{kelas.className}</TableCell>
                  <TableCell className="text-right">{kelas.totalSiswa}</TableCell>
                  <TableCell className="text-right">{kelas.hadir}</TableCell>
                  <TableCell className="text-right">{kelas.terlambat}</TableCell>
                  <TableCell className="text-right">{kelas.sakit}</TableCell>
                  <TableCell className="text-right">{kelas.izin}</TableCell>
                  <TableCell className="text-right">{kelas.dispensasi}</TableCell>
                  <TableCell className="text-right">{kelas.alpha}</TableCell>
                  <TableCell className="text-right">{kelas.belumAbsen}</TableCell>
                  <TableCell className="text-right">
                    <Pct value={kelas.persentaseKehadiran} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </TabsContent>

      <TabsContent value="siswa">
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama</TableHead>
                <TableHead>Kelas</TableHead>
                <TableHead className="text-right">Hadir</TableHead>
                <TableHead className="text-right">Terlambat</TableHead>
                <TableHead className="text-right">Sakit</TableHead>
                <TableHead className="text-right">Izin</TableHead>
                <TableHead className="text-right">Dispensasi</TableHead>
                <TableHead className="text-right">Alpha</TableHead>
                <TableHead className="text-right">Belum Diisi</TableHead>
                <TableHead className="text-right">% Hadir</TableHead>
                <TableHead className="text-right">Detail</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {perStudent.length === 0 && (
                <TableRow>
                  <TableCell colSpan={11} className="text-center text-muted-foreground">
                    Tidak ada data siswa untuk periode ini.
                  </TableCell>
                </TableRow>
              )}
              {perStudent.map((siswa) => (
                <TableRow key={siswa.studentId}>
                  <TableCell className="font-medium">{siswa.name}</TableCell>
                  <TableCell>{siswa.className}</TableCell>
                  <TableCell className="text-right">{siswa.hadir}</TableCell>
                  <TableCell className="text-right">{siswa.terlambat}</TableCell>
                  <TableCell className="text-right">{siswa.sakit}</TableCell>
                  <TableCell className="text-right">{siswa.izin}</TableCell>
                  <TableCell className="text-right">{siswa.dispensasi}</TableCell>
                  <TableCell className="text-right">{siswa.alpha}</TableCell>
                  <TableCell className="text-right">{siswa.belumAbsen}</TableCell>
                  <TableCell className="text-right">
                    <Pct value={siswa.persentaseKehadiran} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Link
                      href={`/laporan/siswa/${siswa.studentId}?${detailQuery}`}
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      Lihat
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </TabsContent>
    </Tabs>
  );
}