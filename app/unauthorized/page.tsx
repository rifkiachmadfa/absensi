export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-2 px-4 text-center">
      <h1 className="text-lg font-semibold">Akses Ditolak</h1>
      <p className="text-sm text-muted-foreground">
        Anda tidak memiliki izin untuk mengakses halaman ini.
      </p>
    </div>
  );
}