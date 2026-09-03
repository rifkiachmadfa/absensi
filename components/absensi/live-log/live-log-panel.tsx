// components/absensi/live-log/live-log-panel.tsx
"use client";

import { CheckCircle2, AlertTriangle, XCircle, LogIn, LogOut, Radio } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useLiveScanLog } from "./use-live-scan-log";
import type { LiveLogRow, LiveLogStatus } from "./types";

// UI_RULES Section 19 & 32: status TIDAK boleh hanya dibedakan lewat
// warna -- selalu icon + text. Section 14: card flat, border tipis,
// shadow subtle. Warna mengikuti status system (Section 5), bukan warna
// branding, karena ini menampilkan hasil (berhasil/perhatian/gagal), sama
// seperti ScanQueuePanel/ScanLiveCard.
const ROW_CARD_CLASS: Record<LiveLogStatus, string> = {
  pending: "border-border bg-muted/30",
  success: "border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/40",
  warning: "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40",
  error: "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/40",
};

function StatusIcon({ status }: { status: LiveLogStatus }) {
  if (status === "pending") return <Spinner className="size-4 text-muted-foreground" />;
  if (status === "success")
    return <CheckCircle2 className="size-4 shrink-0 text-[#16A34A]" aria-label="Berhasil" />;
  if (status === "warning")
    return <AlertTriangle className="size-4 shrink-0 text-[#D97706]" aria-label="Perhatian" />;
  return <XCircle className="size-4 shrink-0 text-[#DC2626]" aria-label="Gagal" />;
}

function jamJakarta(iso: string) {
  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(new Date(iso));
}

function LiveLogRowCard({ row }: { row: LiveLogRow }) {
  const isPending = row.status === "pending";
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border p-3 transition-colors",
        ROW_CARD_CLASS[row.status]
      )}
    >
      {row.mode === "masuk" ? (
        <LogIn className="size-4 shrink-0 text-muted-foreground" aria-label="Absen masuk" />
      ) : (
        <LogOut className="size-4 shrink-0 text-muted-foreground" aria-label="Absen pulang" />
      )}

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{row.name ?? row.label}</p>
        <p
          className={cn(
            "truncate text-xs text-muted-foreground",
            isPending && "animate-pulse"
          )}
        >
          {row.className ? `${row.className} · ` : ""}
          {isPending ? "Memproses..." : (row.detail ?? "Selesai diproses")}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <span className="text-xs text-muted-foreground">{jamJakarta(row.ts)}</span>
        <StatusIcon status={row.status} />
      </div>
    </div>
  );
}

// `open` = state buka/tutup dialog induk (ScanDialog/ScanDialogPulang) --
// pola yang sama dengan useScannerBridge({ enabled: open, ... }): panel
// hanya subscribe ke broadcast selagi dialog benar-benar terbuka, lepas
// dari tab mana yang sedang aktif di dalamnya (Section 34 UI_RULES: hindari
// koneksi yang terus berjalan tanpa perlu).
export function LiveLogPanel({ open }: { open: boolean }) {
  const { rows, isLoading } = useLiveScanLog({ enabled: open });

  return (
    <div className="space-y-3">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Radio className="size-3.5 text-[#22949E]" />
        Aktivitas scan dari semua perangkat, langsung diperbarui.
      </p>

      <div className="max-h-80 space-y-2 overflow-y-auto">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border p-8 text-center">
            <Radio className="size-5 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Belum ada aktivitas scan hari ini.</p>
          </div>
        ) : (
          rows.map((row) => <LiveLogRowCard key={row.id} row={row} />)
        )}
      </div>
    </div>
  );
}