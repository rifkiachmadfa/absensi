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
    roles: ["SUPERADMIN", "ADMIN"],
  },
  {
    href: "/kelas",
    label: "Kelas",
    icon: GraduationCap,
    roles: ["SUPERADMIN", "ADMIN"],
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
    roles: ["SUPERADMIN", "ADMIN"],
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