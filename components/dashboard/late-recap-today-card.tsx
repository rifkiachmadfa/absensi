import { AlarmClock, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { LateRecapToday } from "@/lib/services/report-service";

// Modern School — UI_RULES §15 (Statistic Card) & §5 (Warning = Terlambat).
// Widget kompak: "Keterlambatan Hari Ini · 24 siswa · ↑ 8% dibanding
// kemarin". Arah panah TIDAK diberi makna baik/buruk lewat warna hijau/merah
// (naiknya keterlambatan bukan "sukses" & turunnya bukan "gagal" secara
// warna literal) -- konsisten dengan §32 (jangan mengandalkan warna saja),
// arah tetap dibedakan lewat ikon + teks, warna tetap warning-neutral.
function DirectionBadge({ recap }: { recap: LateRecapToday }) {
  if (recap.direction === "none") {
    return (
      <span className="text-[12px] font-medium text-[#71858C]">
        Belum ada pembanding
      </span>
    );
  }

  if (recap.direction === "new") {
    return (
      <span className="inline-flex items-center gap-1 text-[12px] font-medium text-[#D97706]">
        <TrendingUp className="size-3.5" strokeWidth={2.5} />
        Baru muncul (kemarin 0 siswa)
      </span>
    );
  }

  if (recap.direction === "flat" || recap.percentChange === null) {
    return (
      <span className="inline-flex items-center gap-1 text-[12px] font-medium text-[#71858C]">
        <Minus className="size-3.5" strokeWidth={2.5} />
        Sama seperti {recap.compareLabel}
      </span>
    );
  }

  const isUp = recap.direction === "up";
  const Icon = isUp ? TrendingUp : TrendingDown;

  return (
    <span className="inline-flex items-center gap-1 text-[12px] font-medium text-[#48616A]">
      <Icon className={isUp ? "size-3.5 text-[#D97706]" : "size-3.5 text-[#16A34A]"} strokeWidth={2.5} />
      {Math.abs(recap.percentChange)}% dibanding {recap.compareLabel}
    </span>
  );
}

export function LateRecapTodayCard({ recap }: { recap: LateRecapToday }) {
  return (
    <Card className="rounded-xl border-[#DCE7E9] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
      <CardContent className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-[13px] font-medium text-[#48616A]">
            Keterlambatan Hari Ini
          </p>
          {!recap.isSchoolDay ? (
            <p className="text-[14px] font-medium text-[#71858C]">
              Hari ini bukan hari sekolah
            </p>
          ) : (
            <>
              <p className="text-2xl font-bold tabular-nums text-[#17313A] sm:text-[28px]">
                {recap.todayCount}{" "}
                <span className="text-[14px] font-medium text-[#71858C]">siswa</span>
              </p>
              <DirectionBadge recap={recap} />
            </>
          )}
        </div>
        <div className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-[#FFFBEB] text-[#D97706]">
          <AlarmClock className="size-5" strokeWidth={2} />
        </div>
      </CardContent>
    </Card>
  );
}