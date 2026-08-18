import { Building2 } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import type { ClassBreakdown } from "@/lib/services/attendance-service";

// Warna bar mengikuti persentase kehadiran per kelas -- tetap dalam keluarga
// Status Colors (UI_RULES §5), bukan warna dekoratif baru.
function barColor(pct: number) {
  if (pct >= 90) return "bg-[#16A34A]";
  if (pct >= 75) return "bg-[#D97706]";
  return "bg-[#DC2626]";
}

// Versi publik dari components/dashboard/class-stats.tsx -- informasi saja,
// TANPA tombol "Kelola Kelas".
export function PublicClassStats({ data }: { data: ClassBreakdown[] }) {
  return (
    <Card className="h-full rounded-xl border-[#DCE7E9] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
      <CardHeader>
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-[8px] bg-[#EAF7F8] text-[#17586F]">
            <Building2 className="size-4" strokeWidth={2} />
          </div>
          <div>
            <CardTitle className="text-[18px] font-semibold text-[#17313A]">
              Statistik per Kelas
            </CardTitle>
            <CardDescription className="text-[13px] text-[#71858C]">
              Persentase kehadiran hari ini
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="py-6 text-center text-sm text-[#71858C]">
            Belum ada data kelas.
          </p>
        ) : (
          <ul className="space-y-3">
            {data.map((kelas, index) => (
              <li key={kelas.classId} className="flex items-center gap-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#F1F5F5] text-[11px] font-semibold text-[#48616A]">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                    <span className="truncate font-medium text-[#17313A]">
                      {kelas.className}
                    </span>
                    <span className="shrink-0 text-[#71858C]">
                      {kelas.hadir + kelas.terlambat}/{kelas.totalSiswa} ·{" "}
                      {kelas.persentaseHadir}%
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-[#F1F5F5]">
                    <div
                      className={`h-full rounded-full transition-all ${barColor(kelas.persentaseHadir)}`}
                      style={{ width: `${kelas.persentaseHadir}%` }}
                    />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}