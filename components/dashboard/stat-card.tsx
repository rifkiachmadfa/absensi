import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// Modern School — UI_RULES §15 (Statistic Card) & §5 (Status Colors)
// Icon chip pakai warna tipis sebagai accent kecil; card itu sendiri tetap
// netral (putih) supaya dashboard tidak terasa "berwarna-warni".
const TONE_CLASSES = {
  primary: "bg-[#EAF7F8] text-[#17586F]",
  success: "bg-[#F0FDF4] text-[#16A34A]",
  warning: "bg-[#FFFBEB] text-[#D97706]",
  danger: "bg-[#FEF2F2] text-[#DC2626]",
  neutral: "bg-[#F1F5F5] text-[#48616A]",
} as const;

type Tone = keyof typeof TONE_CLASSES;

export function StatCard({
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
  return (
    <Card className="rounded-xl border-[#DCE7E9] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
      <CardContent className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-[13px] font-medium text-[#48616A]">{label}</p>
          <p className="text-2xl font-bold tabular-nums text-[#17313A] sm:text-[28px]">
            {value}
          </p>
          {sublabel && (
            <p className="text-xs font-medium text-[#71858C]">{sublabel}</p>
          )}
        </div>
        <div
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-[10px]",
            TONE_CLASSES[tone]
          )}
        >
          <Icon className="size-5" strokeWidth={2} />
        </div>
      </CardContent>
    </Card>
  );
}