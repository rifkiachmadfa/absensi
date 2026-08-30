"use client";

import { useMemo, useState } from "react";
import { Trophy } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
  CardContent,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { StudentAvatar } from "@/components/siswa/student-avatar";
import type { DisciplineLeaderboardPayload } from "@/lib/services/report-service";

// Modern School — UI_RULES §3 (Yellow = accent untuk "important statistic" /
// "badge khusus") dipakai HANYA untuk badge peringkat #1, sisanya netral.
const RANK_BADGE_STYLE = [
  "bg-[#FFF8D9] text-[#8A6D00] border border-[#FFCC31]", // #1 — accent branding
  "bg-[#F1F5F5] text-[#48616A] border border-[#DCE7E9]", // #2
  "bg-[#F1F5F5] text-[#48616A] border border-[#DCE7E9]", // #3
  "bg-[#F1F5F5] text-[#48616A] border border-[#DCE7E9]", // #4
  "bg-[#F1F5F5] text-[#48616A] border border-[#DCE7E9]", // #5
];

export function DisciplineLeaderboard({
  leaderboards,
}: {
  // Sudah di-fetch server-side untuk setiap bulan yang tersedia (index 0 =
  // bulan berjalan), jadi ganti bulan di client TIDAK perlu request baru --
  // pola yang sama seperti toggle Harian/Bulanan di AttendanceTrendChart.
  leaderboards: DisciplineLeaderboardPayload[];
}) {
  const [monthIndex, setMonthIndex] = useState(0);
  const active = leaderboards[monthIndex] ?? leaderboards[0];

  const monthOptions = useMemo(
    () => leaderboards.map((l, i) => ({ index: i, value: l.month, label: l.monthLabel })),
    [leaderboards]
  );

  if (!active) return null;

  return (
    <Card className="h-full rounded-xl border-[#DCE7E9] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-[18px] font-semibold text-[#17313A]">
          <Trophy className="h-[18px] w-[18px] text-[#22949E]" />
          Top 5 Murid Paling Disiplin
        </CardTitle>
        <CardDescription className="text-[13px] text-[#71858C]">
          Penilaian bulanan (bukan harian) · {active.monthLabel}
        </CardDescription>
        <CardAction>
          {/* Pemilih bulan -- native <select> supaya ringkas & aksesibel,
              opsinya "Agustus 2026, Juli 2026, ..." dari getDisciplineMonthOptions() */}
          <select
            value={monthIndex}
            onChange={(e) => setMonthIndex(Number(e.target.value))}
            className="h-9 rounded-[10px] border border-[#DCE7E9] bg-white px-3 text-[13px] text-[#17313A] outline-none focus:border-[#22949E]"
            aria-label="Pilih bulan penilaian"
          >
            {monthOptions.map((opt) => (
              <option key={opt.value} value={opt.index}>
                {opt.label}
              </option>
            ))}
          </select>
        </CardAction>
      </CardHeader>

      <CardContent>
        {active.schoolDays === 0 ? (
          <p className="py-10 text-center text-sm text-[#71858C]">
            Bulan ini belum memiliki hari sekolah yang berjalan.
          </p>
        ) : active.rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-[#71858C]">
            Belum ada data kehadiran pada {active.monthLabel}.
          </p>
        ) : (
          <ul className="space-y-2">
            {active.rows.map((row, i) => (
              <li
                key={row.studentId}
                className="flex items-center gap-3 rounded-[10px] border border-[#DCE7E9] px-3 py-2.5"
              >
                <span
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold",
                    RANK_BADGE_STYLE[i] ?? RANK_BADGE_STYLE[4]
                  )}
                >
                  {i + 1}
                </span>

                <StudentAvatar nis={row.nis} name={row.name} size={36} />

                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-medium text-[#17313A]">
                    {row.name}
                  </p>
                  <p className="truncate text-[12px] text-[#71858C]">
                    {row.className} · NIS {row.nis}
                  </p>
                </div>

                <div className="shrink-0 text-right">
                  <p className="text-[14px] font-semibold text-[#17313A]">
                    {row.hadirCount}/{active.schoolDays} hari
                  </p>
                  <p className="text-[12px] text-[#71858C]">
                    rata² {row.avgCheckInLabel}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-3 text-[12px] text-[#71858C]">
          Peringkat dinilai dari jumlah hari masuk sekolah bulan ini, lalu
          rata-rata jam check-in paling pagi sebagai penentu jika jumlahnya sama.
        </p>
      </CardContent>
    </Card>
  );
}