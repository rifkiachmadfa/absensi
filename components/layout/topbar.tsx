import Link from "next/link";
import { UserNav } from "./user-nav";
import type { SessionUser } from "@/lib/auth/session";

export function Topbar({ user }: { user: SessionUser }) {
  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b bg-background px-4">
      <Link href="/" className="text-sm font-semibold">
        Sistem Absensi Siswa
      </Link>
      <UserNav name={user.name} email={user.email} role={user.role} />
    </header>
  );
}