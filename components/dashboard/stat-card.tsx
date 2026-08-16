import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const TONE_CLASSES = {
  primary: "bg-primary/10 text-primary",
  success: "bg-success-bg text-success",
  warning: "bg-warning-bg text-warning",
  danger: "bg-danger-bg text-danger",
  neutral: "bg-muted text-muted-foreground",
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
    <Card>
      <CardContent className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold tabular-nums text-foreground">
            {value}
          </p>
          {sublabel && (
            <p className="text-xs text-muted-foreground">{sublabel}</p>
          )}
        </div>
        <div
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-lg",
            TONE_CLASSES[tone]
          )}
        >
          <Icon className="size-5" />
        </div>
      </CardContent>
    </Card>
  );
}