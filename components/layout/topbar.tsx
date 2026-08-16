import Link from "next/link";
import { UserNav } from "./user-nav";
import { MobileNav } from "./mobile-nav";
import type { SessionUser } from "@/lib/auth/session";

export function Topbar({ user }: { user: SessionUser }) {
  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between gap-2 border-b border-border bg-background px-4">
      <div className="flex items-center gap-1">
        <MobileNav role={user.role} />
        <Link href="/" className="text-sm font-semibold text-foreground">
          Sistem Absensi Siswa
        </Link>
      </div>
      <UserNav name={user.name} email={user.email} role={user.role} />
    </header>
  );
}