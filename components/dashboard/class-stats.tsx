import Link from "next/link";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { ClassBreakdown } from "@/lib/services/attendance-service";

export function ClassStats({ data }: { data: ClassBreakdown[] }) {
  return (
    <Card className="h-full rounded-xl border-[#DCE7E9] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
      <CardHeader>
        <CardTitle className="text-[18px] font-semibold text-[#17313A]">
          Statistik per Kelas
        </CardTitle>
        <CardDescription className="text-[13px] text-[#71858C]">
          Persentase kehadiran hari ini
        </CardDescription>
        <CardAction>
          <Button
            size="sm"
            render={<Link href="/kelas" />}
            className="rounded-[10px] border border-[#DCE7E9] bg-white text-[#17313A] hover:bg-[#F1F5F5]"
          >
            Kelola Kelas
          </Button>
        </CardAction>
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