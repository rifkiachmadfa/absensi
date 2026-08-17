import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ScanLine, Users, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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
          size="lg"
          render={<Link href={action.href} />}
          className={cn(
            "min-h-11 rounded-[10px] px-4 font-medium",
            action.primary
              ? "bg-[#22949E] text-white hover:bg-[#1C7F88]"
              : "border border-[#DCE7E9] bg-white text-[#17313A] hover:bg-[#F1F5F5]"
          )}
        >
          <action.icon data-icon="inline-start" className="size-4" />
          {action.label}
        </Button>
      ))}
    </div>
  );
}