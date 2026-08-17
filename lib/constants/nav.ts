// lib/constants/nav.ts
import type { LucideIcon } from "lucide-react"
import {
  LayoutDashboard,
  ScanLine,
  Users,
  UserCog,
  GraduationCap,
  FileText,
  IdCard,
  History,
  Settings,
} from "lucide-react"
import type { UserRole } from "@/app/generated/prisma/enums"

export type NavItem = {
  href: string
  label: string
  icon: LucideIcon
  roles: UserRole[]
  comingSoon?: boolean
}

// Struktur menu sesuai UI_RULES §5 (Dashboard, Absensi, Siswa, Kelas,
// Laporan, Kartu Siswa, Log Aktivitas, Pengaturan).
//
// PENTING: `roles` di sini HANYA mengatur tampil/tidaknya item menu.
// Ini bukan sumber kebenaran otorisasi — setiap page/action tetap
// wajib punya guard sendiri (requireAuth/requireRole/fungsi canXxx di
// lib/auth/permissions.ts), supaya akses lewat URL langsung tetap
// tertolak sesuai role meskipun menunya tidak tampil.
export const NAV_ITEMS: NavItem[] = [
  {
    href: "/",
    label: "Dashboard",
    icon: LayoutDashboard,
    roles: ["SUPERADMIN", "ADMIN", "GURU", "WALI_KELAS"],
  },
  {
    href: "/absensi",
    label: "Absensi",
    icon: ScanLine,
    roles: ["SUPERADMIN", "ADMIN", "GURU", "WALI_KELAS"],
  },
  {
    href: "/siswa",
    label: "Siswa",
    icon: Users,
    // GURU: lihat & ubah identitas siswa (tidak bisa tambah/nonaktifkan).
    // WALI_KELAS: + tambah/nonaktifkan siswa khusus di kelas ampuannya.
    roles: ["SUPERADMIN", "ADMIN", "GURU", "WALI_KELAS"],
  },
  {
    href: "/kelas",
    label: "Kelas",
    icon: GraduationCap,
    // Semua role bisa lihat daftar & statistik kelas; kelola kelas
    // (tambah/edit/nonaktifkan) dibatasi di page lewat canManageClasses.
    roles: ["SUPERADMIN", "ADMIN", "GURU", "WALI_KELAS"],
  },
  {
    href: "/guru",
    label: "Guru",
    icon: UserCog,
    roles: ["SUPERADMIN", "ADMIN"],
  },
  {
    href: "/laporan",
    label: "Laporan",
    icon: FileText,
    roles: ["SUPERADMIN", "ADMIN", "WALI_KELAS"],
  },
  {
    href: "/kartu-siswa",
    label: "Kartu Siswa",
    icon: IdCard,
    roles: ["SUPERADMIN", "ADMIN", "WALI_KELAS"],
  },
  {
    href: "/log-aktivitas",
    label: "Log Aktivitas",
    icon: History,
    roles: ["SUPERADMIN"],
  },
  {
    href: "/pengaturan",
    label: "Pengaturan",
    icon: Settings,
    roles: ["SUPERADMIN", "ADMIN", "GURU", "WALI_KELAS"],
  },
]