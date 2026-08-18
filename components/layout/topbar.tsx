import Image from "next/image";
import Link from "next/link";
import { UserNav } from "./user-nav";
import { MobileNav } from "./mobile-nav";
import type { SessionUser } from "@/lib/auth/session";
import { SCHOOL_LOGO_URL } from "@/lib/kartu-siswa/constants";

export function Topbar({ user }: { user: SessionUser }) {
  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between gap-2 border-b border-[#DCE7E9] bg-white px-4">
      <div className="flex min-w-0 items-center gap-1">
        <MobileNav role={user.role} />

        <Link
          href="/dashboard"
          className="flex min-w-0 items-center gap-2.5"
        >
          <div className="relative flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-[8px]">
            <Image
              src={SCHOOL_LOGO_URL}
              alt="Logo SMK Yadika"
              width={32}
              height={32}
              className="object-contain"
              priority
            />
          </div>

          <span className="truncate text-[14px] font-semibold tracking-tight text-[#17313A] sm:text-[15px]">
            Sistem Absensi Murid SMK Yadika Sumedang
          </span>
        </Link>
      </div>

      <UserNav
        name={user.name}
        email={user.email}
        role={user.role}
      />
    </header>
  );
}