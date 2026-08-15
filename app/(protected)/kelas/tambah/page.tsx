import Link from "next/link";
import { requireRole } from "@/lib/auth/guard";
import {
  getAcademicYearOptions,
  getHomeroomTeacherOptions,
} from "@/lib/services/kelas-service";
import { KelasForm } from "@/components/kelas/kelas-form";

export default async function TambahKelasPage() {
  const actor = await requireRole(["SUPERADMIN", "ADMIN"]);

  const [academicYearOptions, homeroomTeacherOptions] = await Promise.all([
    getAcademicYearOptions(),
    getHomeroomTeacherOptions(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Tambah Kelas</h1>
        <p className="text-sm text-muted-foreground">
          Buat data kelas baru untuk tahun ajaran yang sudah tersedia.
        </p>
      </div>

      {academicYearOptions.length === 0 ? (
        <div className="max-w-lg rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Belum ada Tahun Ajaran.{" "}
          {actor.role === "SUPERADMIN" ? (
            <Link href="/tahun-ajaran" className="font-medium underline">
              Buat Tahun Ajaran
            </Link>
          ) : (
            "Hubungi Superadmin untuk membuat Tahun Ajaran terlebih dahulu."
          )}
        </div>
      ) : (
        <KelasForm
          mode="create"
          academicYearOptions={academicYearOptions}
          homeroomTeacherOptions={homeroomTeacherOptions}
        />
      )}
    </div>
  );
}