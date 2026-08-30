import Link from "next/link";
import { requireAuth } from "@/lib/auth/session";
import { canCreateStudentSomewhere } from "@/lib/auth/permissions";
import { getClassOptionsForCreate } from "@/lib/services/siswa-service";
import { redirect } from "next/navigation";
import { SiswaForm } from "@/components/siswa/siswa-form";

export default async function TambahSiswaPage({
  searchParams,
}: {
  searchParams: Promise<{ classId?: string }>;
}) {

  const actor = await requireAuth();
if (!canCreateStudentSomewhere(actor)) redirect("/unauthorized");
  const { classId } = await searchParams;
  const classOptions = await getClassOptionsForCreate(actor) 

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Tambah Siswa</h1>
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
            classId
              ? { nis: "", nisn: "", name: "", classId, whatsappNumber: "" }
              : undefined
          }
        />
      )}
    </div>
  );
}