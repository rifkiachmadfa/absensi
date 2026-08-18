import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import type { ClassBreakdown } from "@/lib/services/attendance-service";

// Versi publik dari components/dashboard/class-stats.tsx -- informasi saja,
// TANPA tombol "Kelola Kelas".
export function PublicClassStats({ data }: { data: ClassBreakdown[] }) {
  return (
    <Card className="h-full rounded-xl border-[#DCE7E9] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
      <CardHeader>
        <CardTitle className="text-[18px] font-semibold text-[#17313A]">
          Statistik per Kelas
        </CardTitle>
        <CardDescription className="text-[13px] text-[#71858C]">
          Persentase kehadiran hari ini
        </CardDescription>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="py-6 text-center text-sm text-[#71858C]">
            Belum ada data kelas.
          </p>
        ) : (
          <ul className="space-y-3">
            {data.map((kelas) => (
              <li key={kelas.classId}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="font-medium text-[#17313A]">
                    {kelas.className}
                  </span>
                  <span className="text-[#71858C]">
                    {kelas.hadir + kelas.terlambat}/{kelas.totalSiswa} ·{" "}
                    {kelas.persentaseHadir}%
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-[#F1F5F5]">
                  <div
                    className="h-full rounded-full bg-[#22949E] transition-all"
                    style={{ width: `${kelas.persentaseHadir}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}