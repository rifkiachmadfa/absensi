import Link from "next/link";
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
import { STATUS_LABEL, STATUS_BADGE_CLASS } from "@/lib/constants/attendance";
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

export function RecentAttendance({ items }: { items: RecentAttendanceItem[] }) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Absensi Terbaru</CardTitle>
        <CardDescription>Scan &amp; input manual hari ini</CardDescription>
        <CardAction>
          <Button variant="outline" size="sm" render={<Link href="/laporan" />}>
            Lihat Semua
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Belum ada absensi hari ini.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {item.studentName}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {item.className} · {formatTime(item.checkInAt)} ·{" "}
                    {item.method === "QR" ? "Scan QR" : "Manual"}
                  </p>
                </div>
                <Badge className={cn("shrink-0", STATUS_BADGE_CLASS[item.status])}>
                  {STATUS_LABEL[item.status]}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}