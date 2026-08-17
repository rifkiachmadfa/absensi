import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BackButton } from "./back-button";

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-destructive/10">
        <ShieldAlert className="size-8 text-destructive" />
      </div>

      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-foreground sm:text-[26px]">
          Akses Ditolak
        </h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          Anda tidak memiliki izin untuk mengakses halaman ini. Hubungi
          admin atau superadmin jika Anda merasa ini sebuah kesalahan.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <BackButton />
        <Button render={<Link href="/" />}>Ke Dashboard</Button>
      </div>
    </div>
  );
}