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
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Statistik per Kelas</CardTitle>
        <CardDescription>Persentase kehadiran hari ini</CardDescription>
        <CardAction>
          <Button variant="outline" size="sm" render={<Link href="/kelas" />}>
            Kelola Kelas
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Belum ada data kelas.
          </p>
        ) : (
          <ul className="space-y-3">
            {data.map((kelas) => (
              <li key={kelas.classId}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="font-medium text-foreground">
                    {kelas.className}
                  </span>
                  <span className="text-muted-foreground">
                    {kelas.hadir + kelas.terlambat}/{kelas.totalSiswa} ·{" "}
                    {kelas.persentaseHadir}%
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
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