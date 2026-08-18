import Image from "next/image";
import Link from "next/link";
import { LogIn } from "lucide-react";
import { SCHOOL_LOGO_URL } from "@/lib/kartu-siswa/constants";

// Header untuk halaman publik ("/", "/cek-kehadiran/[id]"). Sengaja terpisah
// dari <Topbar> karena Topbar mewajibkan SessionUser -- halaman ini justru
// harus bisa diakses tanpa login sama sekali.
export function PublicHeader() {
  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between gap-2 border-b border-[#DCE7E9] bg-white px-4">
      <Link href="/" className="flex min-w-0 items-center gap-2.5">
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

      <Link
        href="/login"
        className="flex shrink-0 items-center gap-1.5 rounded-[10px] border border-[#DCE7E9] px-3 py-1.5 text-[13px] font-medium text-[#17313A] transition-colors hover:bg-[#F1F5F5]"
      >
        <LogIn className="size-3.5" />
        <span className="hidden sm:inline">Login Admin/Guru</span>
        <span className="sm:hidden">Login</span>
      </Link>
    </header>
  );
}