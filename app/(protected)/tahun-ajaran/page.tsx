import { requireRole } from "@/lib/auth/guard";
import { listAcademicYears } from "@/lib/services/tahun-ajaran-service";
import { setActiveAcademicYearAction } from "./actions";
import { AcademicYearForm } from "@/components/tahun-ajaran/academic-year-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";

export default async function TahunAjaranPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireRole(["SUPERADMIN"]);
  const { error } = await searchParams;
  const academicYears = await listAcademicYears();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Tahun Ajaran</h1>
        <p className="text-sm text-muted-foreground">
          Kelola tahun ajaran. Hanya satu tahun ajaran yang bisa aktif dalam
          satu waktu.
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {decodeURIComponent(error)}
        </div>
      )}

      <AcademicYearForm />

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Jumlah Kelas</TableHead>
              <TableHead>Dibuat</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {academicYears.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  Belum ada tahun ajaran.
                </TableCell>
              </TableRow>
            )}
            {academicYears.map((year) => (
              <TableRow key={year.id}>
                <TableCell className="font-medium">{year.name}</TableCell>
                <TableCell>
                  <Badge variant={year.status === "ACTIVE" ? "default" : "outline"}>
                    {year.status === "ACTIVE" ? "Aktif" : "Tidak Aktif"}
                  </Badge>
                </TableCell>
                <TableCell>{year._count.classes}</TableCell>
                <TableCell>
                  {new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(
                    year.createdAt
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {year.status !== "ACTIVE" && (
                    <AlertDialog>
                        <AlertDialogTrigger
                        render={
                            <Button size="sm" variant="outline">
                            Jadikan Aktif
                            </Button>
                        }
                        >
                        Jadikan Aktif
                        </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            Jadikan {year.name} tahun ajaran aktif?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            Mengaktifkan tahun ajaran ini akan menonaktifkan
                            tahun ajaran yang sedang aktif saat ini.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Batal</AlertDialogCancel>
                          <form action={setActiveAcademicYearAction.bind(null, year.id)}>
                            <AlertDialogAction type="submit">
                              Ya, Aktifkan
                            </AlertDialogAction>
                          </form>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}