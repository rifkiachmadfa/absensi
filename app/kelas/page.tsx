import Link from "next/link";
import { requireRole } from "@/lib/auth/guard";
import { listClasses, getAcademicYearOptions } from "@/lib/services/kelas-service";
import { classFilterSchema } from "@/lib/validations/kelas";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function KelasPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; academicYearId?: string; status?: string }>;
}) {
  const actor = await requireRole(["SUPERADMIN", "ADMIN"]);
  const rawParams = await searchParams;

  const filter = classFilterSchema.parse({
    search: rawParams.search || undefined,
    academicYearId: rawParams.academicYearId || undefined,
    status:
      rawParams.status === "ACTIVE" || rawParams.status === "INACTIVE"
        ? rawParams.status
        : undefined,
  });

  const [classes, academicYearOptions] = await Promise.all([
    listClasses(filter),
    getAcademicYearOptions(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Kelas</h1>
          <p className="text-sm text-muted-foreground">Kelola data kelas per tahun ajaran.</p>
        </div>
        <div className="flex gap-2">
          {actor.role === "SUPERADMIN" && (
            <Button
            variant="outline"
            render={<Link href="/tahun-ajaran" />}
            >
            Kelola Tahun Ajaran
            </Button>
          )}
            <Button render={<Link href="/kelas/tambah" />}>
            + Tambah Kelas
            </Button>
        </div>
      </div>

      {academicYearOptions.length === 0 && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Belum ada Tahun Ajaran.{" "}
          {actor.role === "SUPERADMIN" ? (
            <Link href="/tahun-ajaran" className="font-medium underline">
              Buat Tahun Ajaran
            </Link>
          ) : (
            "Hubungi Superadmin untuk membuat Tahun Ajaran terlebih dahulu."
          )}
        </div>
      )}

      <form className="flex flex-wrap items-end gap-3" method="get">
        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="search">
            Cari
          </label>
          <Input id="search" name="search" placeholder="Nama kelas..." defaultValue={filter.search} />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="academicYearId">
            Tahun Ajaran
          </label>
          <Select name="academicYearId" defaultValue={filter.academicYearId ?? ""}>
            <SelectTrigger id="academicYearId" className="w-44">
              <SelectValue placeholder="Semua" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Semua</SelectItem>
              {academicYearOptions.map((year) => (
                <SelectItem key={year.id} value={year.id}>
                  {year.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="status">
            Status
          </label>
          <Select name="status" defaultValue={filter.status ?? ""}>
            <SelectTrigger id="status" className="w-36">
              <SelectValue placeholder="Semua" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Semua</SelectItem>
              <SelectItem value="ACTIVE">Aktif</SelectItem>
              <SelectItem value="INACTIVE">Nonaktif</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button type="submit" variant="outline">
          Terapkan Filter
        </Button>
      </form>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama Kelas</TableHead>
              <TableHead>Tahun Ajaran</TableHead>
              <TableHead>Wali Kelas</TableHead>
              <TableHead>Jumlah Siswa</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {classes.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  Belum ada data kelas.
                </TableCell>
              </TableRow>
            )}
            {classes.map((kelas) => (
              <TableRow key={kelas.id}>
                <TableCell>
                  <Link href={`/kelas/${kelas.id}`} className="font-medium hover:underline">
                    {kelas.name}
                  </Link>
                </TableCell>
                <TableCell>{kelas.academicYear.name}</TableCell>
                <TableCell>{kelas.homeroomTeacher?.name ?? "-"}</TableCell>
                <TableCell>{kelas._count.students}</TableCell>
                <TableCell>
                  <Badge variant={kelas.status === "ACTIVE" ? "default" : "outline"}>
                    {kelas.status === "ACTIVE" ? "Aktif" : "Nonaktif"}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}