import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAuth } from "@/lib/auth/session";
import { canSetStudentStatus, canEditStudentIdentity } from "@/lib/auth/permissions";
import { getStudentById, getClassOptions } from "@/lib/services/siswa-service";
import { SiswaForm } from "@/components/siswa/siswa-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { setStudentStatusAction } from "@/app/(protected)/siswa/action";

export default async function DetailSiswaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  // Melihat detail siswa dibuka untuk semua role login.
  const actor = await requireAuth();
  const { id } = await params;
  const { error } = await searchParams;

  const siswa = await getStudentById(id);
  if (!siswa) {
    notFound();
  }

  const classOptions = await getClassOptions();
  const nextStatus = siswa.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
  const canEditIdentity = canEditStudentIdentity(actor, siswa.class.homeroomTeacherId);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-foreground">{siswa.name}</h1>
            <Badge variant={siswa.status === "ACTIVE" ? "default" : "outline"}>
              {siswa.status === "ACTIVE" ? "Aktif" : "Nonaktif"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            NIS {siswa.nis}
            {siswa.nisn ? ` • NISN ${siswa.nisn}` : ""} • {siswa.class.name}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            QR Token: <span className="font-mono">{siswa.qrToken}</span>
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            render={<Link href={`/kartu-siswa?studentId=${siswa.id}`} />}
          >
            Lihat / Cetak Kartu
          </Button>

          {canSetStudentStatus(actor, siswa.class.homeroomTeacherId) && (
            <AlertDialog>
              <AlertDialogTrigger
                render={
                  <Button variant={siswa.status === "ACTIVE" ? "destructive" : "outline"} />
                }
              >
                {siswa.status === "ACTIVE" ? "Nonaktifkan Siswa" : "Aktifkan Siswa"}
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {siswa.status === "ACTIVE"
                      ? `Nonaktifkan ${siswa.name}?`
                      : `Aktifkan ${siswa.name}?`}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {siswa.status === "ACTIVE"
                      ? "Data dan riwayat absensi siswa tidak akan dihapus. Siswa nonaktif tidak akan bisa melakukan absensi baru."
                      : "Siswa ini akan kembali muncul sebagai siswa aktif dan bisa melakukan absensi."}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Batal</AlertDialogCancel>
                  <form action={setStudentStatusAction.bind(null, id, nextStatus)}>
                    <SubmitButton pendingText="Memproses...">Ya, Lanjutkan</SubmitButton>
                  </form>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      {error && (
        <div className="max-w-lg rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {decodeURIComponent(error)}
        </div>
      )}

      {canEditIdentity ? (
        <div className="rounded-lg border p-4">
          <h2 className="mb-4 text-sm font-semibold">Edit Data Siswa</h2>
          <SiswaForm
            mode="edit"
            studentId={siswa.id}
            classOptions={classOptions}
            defaultValues={{
              nis: siswa.nis,
              nisn: siswa.nisn,
              name: siswa.name,
              classId: siswa.classId,
            }}
          />
        </div>
      ) : (
        <div className="rounded-lg border p-4">
          <h2 className="mb-4 text-sm font-semibold">Data Siswa</h2>
          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted-foreground">Nama</dt>
              <dd className="text-sm font-medium">{siswa.name}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">NIS</dt>
              <dd className="text-sm font-medium">{siswa.nis}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">NISN</dt>
              <dd className="text-sm font-medium">{siswa.nisn ?? "-"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Kelas</dt>
              <dd className="text-sm font-medium">{siswa.class.name}</dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-muted-foreground">
            Anda hanya bisa melihat identitas siswa ini. Untuk mengubah data,
            hubungi wali kelas kelas ini atau admin.
          </p>
        </div>
      )}
    </div>
  );
}