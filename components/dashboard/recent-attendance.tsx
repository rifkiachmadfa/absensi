import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  CheckCircle2,
  Clock,
  Stethoscope,
  FileText as FileIcon,
  BadgeCheck,
  XCircle,
} from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { STATUS_LABEL } from "@/lib/constants/attendance";
import { cn } from "@/lib/utils";
import type { RecentAttendanceItem } from "@/lib/services/attendance-service";

function formatTime(iso: string) {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

// Modern School — UI_RULES §19 & §32: status tidak boleh hanya dibedakan
// warna, wajib icon + text. Mapping ini murni presentasional (icon + warna
// brand-compliant); label tetap bersumber dari STATUS_LABEL (lib/constants).
type StatusStyle = { icon: LucideIcon; className: string };

const STATUS_STYLE: Record<string, StatusStyle> = {
  HADIR: {
    icon: CheckCircle2,
    className: "bg-[#F0FDF4] text-[#16A34A]",
  },
  TERLAMBAT: {
    icon: Clock,
    className: "bg-[#FFFBEB] text-[#D97706]",
  },
  SAKIT: {
    icon: Stethoscope,
    className: "bg-[#EAF7F8] text-[#17586F]",
  },
  IZIN: {
    icon: FileIcon,
    className: "bg-[#EAF7F8] text-[#17586F]",
  },
  DISPENSASI: {
    icon: BadgeCheck,
    className: "bg-[#EAF7F8] text-[#17586F]",
  },
  ALPHA: {
    icon: XCircle,
    className: "bg-[#FEF2F2] text-[#DC2626]",
  },
  BELUM_ABSEN: {
    icon: Clock,
    className: "bg-[#F1F5F5] text-[#48616A]",
  },
};

export function RecentAttendance({ items }: { items: RecentAttendanceItem[] }) {
  return (
    <Card className="h-full rounded-xl border-[#DCE7E9] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
      <CardHeader>
        <CardTitle className="text-[18px] font-semibold text-[#17313A]">
          Absensi Terbaru
        </CardTitle>
        <CardDescription className="text-[13px] text-[#71858C]">
          Scan &amp; input manual hari ini
        </CardDescription>
        <CardAction>
          <Button
            size="sm"
            render={<Link href="/laporan" />}
            className="rounded-[10px] border border-[#DCE7E9] bg-white text-[#17313A] hover:bg-[#F1F5F5]"
          >
            Lihat Semua
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="py-6 text-center text-sm text-[#71858C]">
            Belum ada absensi hari ini.
          </p>
        ) : (
          <ul className="divide-y divide-[#DCE7E9]">
            {items.map((item) => {
              const style = STATUS_STYLE[item.status] ?? STATUS_STYLE.BELUM_ABSEN;
              const StatusIcon = style.icon;
              return (
                <li
                  key={item.id}
                  className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[#17313A]">
                      {item.studentName}
                    </p>
                    <p className="truncate text-xs text-[#71858C]">
                      {item.className} · {formatTime(item.checkInAt)} ·{" "}
                      {item.method === "QR" ? "Scan QR" : "Manual"}
                    </p>
                  </div>
                  <Badge
                    className={cn(
                      "shrink-0 gap-1 rounded-full px-2.5 py-1 font-medium",
                      style.className
                    )}
                  >
                    <StatusIcon className="size-3" strokeWidth={2.5} />
                    {STATUS_LABEL[item.status]}
                  </Badge>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}