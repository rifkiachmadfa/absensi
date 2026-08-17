import { requireRole } from "@/lib/auth/guard";
import { GuruForm } from "@/components/guru/guru-form";

export default async function TambahGuruPage() {
  await requireRole(["SUPERADMIN", "ADMIN"]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Tambah Pengguna</h1>
        <p className="text-sm text-muted-foreground">
          Akun akan langsung aktif dan bisa dipakai login begitu disimpan.
        </p>
      </div>

      <GuruForm mode="create" />
    </div>
  );
}