import Link from "next/link";
import { requireRole } from "@/lib/auth/guard";
import { getClassOptions } from "@/lib/services/siswa-service";
import { SiswaForm } from "@/components/siswa/siswa-form";

export default async function TambahSiswaPage({
  searchParams,
}: {
  searchParams: Promise<{ classId?: string }>;
}) {
  await requireRole(["SUPERADMIN", "ADMIN"]);
  const { classId } = await searchParams;
  const classOptions = await getClassOptions();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Tambah Siswa</h1>
        <p className="text-sm text-muted-foreground">
          QR Token akan dibuat otomatis oleh sistem setelah siswa disimpan.
        </p>
      </div>

      {classOptions.length === 0 ? (
        <div className="max-w-lg rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Belum ada Kelas.{" "}
          <Link href="/kelas/tambah" className="font-medium underline">
            Buat Kelas
          </Link>{" "}
          terlebih dahulu.
        </div>
      ) : (
        <SiswaForm
          mode="create"
          classOptions={classOptions}
          defaultValues={
            classId ? { nis: "", nisn: "", name: "", classId } : undefined
          }
        />
      )}
    </div>
  );
}