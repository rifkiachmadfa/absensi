import { requireRole } from "@/lib/auth/guard";
import { getStudentById, getClassOptions } from "@/lib/services/siswa-service";
import { SiswaForm } from "@/components/siswa/siswa-form";
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
import { setStudentStatusAction } from "@/app/(protected)/siswa/action";

export default async function DetailSiswaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  await requireRole(["SUPERADMIN", "ADMIN"]);
  const { id } = await params;
  const { error } = await searchParams;

  // === DEBUG SEMENTARA ===
  const debugInfo: Record<string, unknown> = {
    receivedId: id,
    idLength: id.length,
    idCharCodes: Array.from(id).map((c) => c.charCodeAt(0)),
  };

  let siswa;
  try {
    siswa = await getStudentById(id);
    debugInfo.queryResult = siswa;
    debugInfo.queryError = null;
  } catch (err) {
    siswa = null;
    debugInfo.queryResult = null;
    debugInfo.queryError = err instanceof Error ? err.message : String(err);
    debugInfo.queryErrorStack = err instanceof Error ? err.stack : null;
  }

  if (!siswa) {
    return (
      <pre
        style={{
          whiteSpace: "pre-wrap",
          padding: 16,
          fontSize: 12,
          background: "#111",
          color: "#0f0",
          borderRadius: 8,
        }}
      >
        {JSON.stringify(debugInfo, null, 2)}
      </pre>
    );
  }
  // === END DEBUG ===

  const classOptions = await getClassOptions();
  const nextStatus = siswa.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold">{siswa.name}</h1>
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
    </div>
  );
}