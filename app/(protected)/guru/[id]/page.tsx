// app/(protected)/guru/[id]/page.tsx
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/guard";
import { getGuruById } from "@/lib/services/guru-service";
import { ROLE_LABEL } from "@/lib/validations/guru";
import { GuruForm } from "@/components/guru/guru-form";
import { ResetPasswordDialog } from "@/components/guru/reset-password-dialog";
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
import { setGuruStatusAction } from "@/app/(protected)/guru/action";

export default async function DetailGuruPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const actor = await requireRole(["SUPERADMIN", "ADMIN"]);
  const { id } = await params;
  const { error } = await searchParams;

  const guru = await getGuruById(id);
  if (!guru) {
    notFound();
  }

  const nextStatus = guru.isActive ? "INACTIVE" : "ACTIVE";
  const isSelf = guru.id === actor.id;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold">{guru.name}</h1>
            <Badge variant="outline">{ROLE_LABEL[guru.role]}</Badge>
            <Badge variant={guru.isActive ? "default" : "outline"}>
              {guru.isActive ? "Aktif" : "Nonaktif"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">{guru.email}</p>
        </div>

        <div className="flex gap-2">
          <ResetPasswordDialog userId={guru.id} userName={guru.name} />

          <AlertDialog>
            <AlertDialogTrigger
              render={
                <Button
                  variant={guru.isActive ? "destructive" : "outline"}
                  disabled={isSelf}
                />
              }
            >
              {guru.isActive ? "Nonaktifkan" : "Aktifkan"}
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {guru.isActive ? `Nonaktifkan ${guru.name}?` : `Aktifkan ${guru.name}?`}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {guru.isActive
                    ? "Akun tidak akan dihapus, hanya tidak bisa dipakai untuk login. Histori absensi dan audit log yang sudah tercatat atas nama akun ini tetap tersimpan."
                    : "Akun ini akan bisa login kembali seperti biasa."}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Batal</AlertDialogCancel>
                <form action={setGuruStatusAction.bind(null, id, nextStatus)}>
                  <AlertDialogAction type="submit">Ya, Lanjutkan</AlertDialogAction>
                </form>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {isSelf && (
        <div className="max-w-lg rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Ini akun Anda sendiri — status aktif/nonaktif akun sendiri tidak bisa diubah dari sini.
        </div>
      )}

      {error && (
        <div className="max-w-lg rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {decodeURIComponent(error)}
        </div>
      )}

      <div className="rounded-lg border p-4">
        <h2 className="mb-4 text-sm font-semibold">Edit Data Pengguna</h2>
        <GuruForm
          mode="edit"
          userId={guru.id}
          defaultValues={{
            name: guru.name,
            email: guru.email,
            role: guru.role,
          }}
        />
      </div>

      {guru.homeroomClasses.length > 0 && (
        <div className="rounded-lg border p-4">
          <h2 className="mb-3 text-sm font-semibold">
            Wali Kelas Dari ({guru.homeroomClasses.length})
          </h2>
          <div className="flex flex-wrap gap-2">
            {guru.homeroomClasses.map((kelas) => (
              <Badge key={kelas.id} variant={kelas.status === "ACTIVE" ? "default" : "outline"}>
                {kelas.name}
              </Badge>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Penautan wali kelas diatur dari halaman Kelas, bukan dari sini.
          </p>
        </div>
      )}
    </div>
  );
}