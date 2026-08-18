import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// Versi publik dari components/dashboard/stat-card.tsx -- sama-sama informasi
// saja (tanpa aksi), tapi dengan aksen visual sedikit lebih kuat (bar warna +
// chip ikon lebih besar) karena kartu ini jadi elemen utama halaman publik.
// Palet & radius tetap mengikuti UI_RULES §4-5 (Status Colors) & §14 (Card).
const TONE_CLASSES = {
  primary: { bar: "bg-[#22949E]", chip: "bg-[#EAF7F8] text-[#17586F]" },
  success: { bar: "bg-[#16A34A]", chip: "bg-[#F0FDF4] text-[#16A34A]" },
  warning: { bar: "bg-[#D97706]", chip: "bg-[#FFFBEB] text-[#D97706]" },
  neutral: { bar: "bg-[#A5B2B6]", chip: "bg-[#F1F5F5] text-[#48616A]" },
} as const;

type Tone = keyof typeof TONE_CLASSES;

export function PublicStatCard({
  label,
  value,
  icon: Icon,
  tone = "neutral",
  sublabel,
}: {
  label: string;
  value: number | string;
  icon: LucideIcon;
  tone?: Tone;
  sublabel?: string;
}) {
  const t = TONE_CLASSES[tone];
  return (
    <div className="relative overflow-hidden rounded-xl border border-[#DCE7E9] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
      <span className={cn("absolute inset-x-0 top-0 h-[3px]", t.bar)} aria-hidden />
      <div className="flex items-start justify-between gap-3 p-4 pt-5">
        <div className="min-w-0 space-y-1">
          <p className="truncate text-[12px] font-medium text-[#71858C] sm:text-[13px]">
            {label}
          </p>
          <p className="text-[22px] font-bold tabular-nums text-[#17313A] sm:text-[28px]">
            {value}
          </p>
          {sublabel && (
            <p className="truncate text-[11px] font-medium text-[#48616A] sm:text-xs">
              {sublabel}
            </p>
          )}
        </div>
        <div
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-[10px] sm:size-10",
            t.chip
          )}
        >
          <Icon className="size-4 sm:size-5" strokeWidth={2} />
        </div>
      </div>
    </div>
  );
}