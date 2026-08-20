import Link from "next/link";
import { requireAuth } from "@/lib/auth/session";
import { canCreateStudentSomewhere } from "@/lib/auth/permissions";
import { listStudents, getClassOptions } from "@/lib/services/siswa-service";
import { studentFilterSchema } from "@/lib/validations/siswa";
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
import { GENDER_LABEL } from "@/lib/constants/student";

export default async function SiswaPage({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string;
    classId?: string;
    status?: string;
    page?: string;
  }>;
}) {
  // Semua role login (GURU, WALI_KELAS, ADMIN, SUPERADMIN) boleh melihat
  // seluruh siswa. Aksi tambah/edit/nonaktifkan diatur per-tombol lewat
  // fungsi di lib/auth/permissions.ts, bukan lewat guard halaman ini.
  const actor = await requireAuth();
  const rawParams = await searchParams;

  const filter = studentFilterSchema.parse({
    search: rawParams.search || undefined,
    classId: rawParams.classId || undefined,
    status:
      rawParams.status === "ACTIVE" || rawParams.status === "INACTIVE"
        ? rawParams.status
        : undefined,
  });
  const page = Number(rawParams.page) || 1;

  const [{ data: students, total, totalPages }, classOptions] = await Promise.all([
    listStudents(filter, page),
    getClassOptions(),
  ]);

  const query = (overrides: Record<string, string | number | undefined>) => {
    const params = new URLSearchParams();
    const merged = { ...filter, page, ...overrides };
    if (merged.search) params.set("search", merged.search);
    if (merged.classId) params.set("classId", merged.classId);
    if (merged.status) params.set("status", merged.status);
    if (merged.page && merged.page !== 1) params.set("page", String(merged.page));
    return `/siswa?${params.toString()}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Siswa</h1>
          <p className="text-sm text-muted-foreground">
            {total} siswa terdaftar.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" render={<Link href="/kartu-siswa" />}>
            Kartu Siswa
          </Button>
          {canCreateStudentSomewhere(actor) && (
            <Button render={<Link href="/siswa/tambah" />}>+ Tambah Siswa</Button>
          )}
        </div>
      </div>

      {classOptions.length === 0 && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Belum ada Kelas.{" "}
          <Link href="/kelas/tambah" className="font-medium underline">
            Buat Kelas
          </Link>{" "}
          terlebih dahulu sebelum menambah siswa.
        </div>
      )}

      <form className="flex flex-wrap items-end gap-3" method="get">
        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="search">
            Cari
          </label>
          <Input
            id="search"
            name="search"
            placeholder="Nama / NIS / NISN..."
            defaultValue={filter.search}
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="classId">
            Kelas
          </label>
          <Select name="classId" defaultValue={filter.classId ?? ""}>
            <SelectTrigger id="classId" className="w-44">
              <SelectValue placeholder="Semua" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Semua</SelectItem>
              {classOptions.map((kelas) => (
                <SelectItem key={kelas.id} value={kelas.id}>
                  {kelas.name}
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
              <TableHead>Nama</TableHead>
              <TableHead>NIS</TableHead>
              <TableHead>NISN</TableHead>
              <TableHead>Jenis Kelamin</TableHead>
              <TableHead>Kelas</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {students.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  Belum ada data siswa.
                </TableCell>
              </TableRow>
            )}
            {students.map((siswa) => (
              <TableRow key={siswa.id}>
                <TableCell>
                  <Link href={`/siswa/${siswa.id}`} className="font-medium hover:underline">
                    {siswa.name}
                  </Link>
                </TableCell>
                <TableCell>{siswa.nis}</TableCell>
                <TableCell>{siswa.nisn ?? "-"}</TableCell>
                <TableCell>{siswa.gender ? GENDER_LABEL[siswa.gender] : "-"}</TableCell>
                <TableCell>{siswa.class.name}</TableCell>
                <TableCell>
                  <Badge variant={siswa.status === "ACTIVE" ? "default" : "outline"}>
                    {siswa.status === "ACTIVE" ? "Aktif" : "Nonaktif"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    size="sm"
                    variant="ghost"
                    render={<Link href={`/kartu-siswa?studentId=${siswa.id}`} />}
                  >
                    Kartu
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            disabled={page <= 1}
            render={<Link href={query({ page: page - 1 })} />}
          >
            Sebelumnya
          </Button>
          <span className="text-sm text-muted-foreground">
            Halaman {page} dari {totalPages}
          </span>
          <Button
            variant="outline"
            disabled={page >= totalPages}
            render={<Link href={query({ page: page + 1 })} />}
          >
            Berikutnya
          </Button>
        </div>
      )}
    </div>
  );
}