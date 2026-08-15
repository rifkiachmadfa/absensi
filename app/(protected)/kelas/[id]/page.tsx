import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/guard";
import {
  getClassById,
  getAcademicYearOptions,
  getHomeroomTeacherOptions,
} from "@/lib/services/kelas-service";
import { KelasForm } from "@/components/kelas/kelas-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { setClassStatusAction } from "@/app/(protected)/kelas/action";
import { listStudents } from "@/lib/services/siswa-service";
import Link from "next/link";

export default async function DetailKelasPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  await requireRole(["SUPERADMIN", "ADMIN"]);
  const { id } = await params;
  const { error } = await searchParams;

const [kelas, academicYearOptions, homeroomTeacherOptions, studentsInClass] =
  await Promise.all([
    getClassById(id),
    getAcademicYearOptions(),
    getHomeroomTeacherOptions(),
    listStudents({ search: undefined, classId: id, status: undefined }, 1),
  ]);

  if (!kelas) {
    notFound();
  }

  const nextStatus = kelas.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold">{kelas.name}</h1>
            <Badge variant={kelas.status === "ACTIVE" ? "default" : "outline"}>
              {kelas.status === "ACTIVE" ? "Aktif" : "Nonaktif"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {kelas.academicYear.name}
            {kelas.homeroomTeacher ? ` • Wali kelas: ${kelas.homeroomTeacher.name}` : ""}
          </p>
        </div>

        <AlertDialog>
            <AlertDialogTrigger
            render={
                <Button
                variant={kelas.status === "ACTIVE" ? "destructive" : "outline"}
                />
            }
            >
            {kelas.status === "ACTIVE" ? "Nonaktifkan Kelas" : "Aktifkan Kelas"}
            </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {kelas.status === "ACTIVE" ? `Nonaktifkan ${kelas.name}?` : `Aktifkan ${kelas.name}?`}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {kelas.status === "ACTIVE"
                  ? "Data kelas tidak akan dihapus. Kelas nonaktif tidak akan muncul sebagai pilihan aktif di form lain."
                  : "Kelas ini akan kembali muncul sebagai kelas aktif."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Batal</AlertDialogCancel>
              <form action={setClassStatusAction.bind(null, id, nextStatus)}>
                <AlertDialogAction type="submit">Ya, Lanjutkan</AlertDialogAction>
              </form>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {error && (
        <div className="max-w-lg rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {decodeURIComponent(error)}
        </div>
      )}

      <div className="rounded-lg border p-4">
        <h2 className="mb-4 text-sm font-semibold">Edit Data Kelas</h2>
        <KelasForm
          mode="edit"
          classId={kelas.id}
          academicYearOptions={academicYearOptions}
          homeroomTeacherOptions={homeroomTeacherOptions}
          defaultValues={{
            name: kelas.name,
            academicYearId: kelas.academicYearId,
            level: kelas.level,
            major: kelas.major,
            homeroomTeacherId: kelas.homeroomTeacherId,
          }}
        />
      </div>

      <div className="rounded-lg border p-4">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold">
            Siswa di Kelas Ini ({studentsInClass.total})
          </h2>
          <div className="flex gap-2">
            <Button variant="outline" render={<Link href={`/siswa?classId=${id}`} />}>
              Lihat Semua
            </Button>
            <Button render={<Link href={`/siswa/tambah?classId=${id}`} />}>
              + Tambah Siswa
            </Button>
          </div>
        </div>

        {studentsInClass.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">Belum ada siswa di kelas ini.</p>
        ) : (
          <ul className="divide-y">
            {studentsInClass.data.map((siswa) => (
              <li key={siswa.id} className="flex items-center justify-between py-2 text-sm">
                <Link href={`/siswa/${siswa.id}`} className="hover:underline">
                  {siswa.name} <span className="text-muted-foreground">({siswa.nis})</span>
                </Link>
                <Badge variant={siswa.status === "ACTIVE" ? "default" : "outline"}>
                  {siswa.status === "ACTIVE" ? "Aktif" : "Nonaktif"}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}