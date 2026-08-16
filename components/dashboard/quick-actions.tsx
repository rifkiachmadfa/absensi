import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ScanLine, Users, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { UserRole } from "@/app/generated/prisma/enums";

type Action = {
  href: string;
  label: string;
  icon: LucideIcon;
  roles: UserRole[];
  primary?: boolean;
};

const ACTIONS: Action[] = [
  {
    href: "/absensi",
    label: "Scan Absensi",
    icon: ScanLine,
    roles: ["SUPERADMIN", "ADMIN", "GURU", "WALI_KELAS"],
    primary: true,
  },
  {
    href: "/siswa",
    label: "Daftar Siswa",
    icon: Users,
    roles: ["SUPERADMIN", "ADMIN"],
  },
  {
    href: "/laporan",
    label: "Laporan",
    icon: FileText,
    roles: ["SUPERADMIN", "ADMIN", "WALI_KELAS"],
  },
];

export function QuickActions({ role }: { role: UserRole }) {
  const items = ACTIONS.filter((action) => action.roles.includes(role));

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((action) => (
        <Button
          key={action.href}
          variant={action.primary ? "default" : "outline"}
          render={<Link href={action.href} />}
        >
          <action.icon data-icon="inline-start" />
          {action.label}
        </Button>
      ))}
    </div>
  );
}