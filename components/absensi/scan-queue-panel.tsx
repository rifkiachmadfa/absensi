// components/absensi/scan-queue-panel.tsx
"use client";

import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import type { ScanQueueItem } from "@/components/absensi/use-scan-queue";

// Daftar hasil scan sesi berjalan, terbaru di atas. Item "pending" tampil
// dengan spinner (progress indicator) dan berubah sendiri jadi
// sukses/duplikat/gagal begitu server merespons -- guru tidak perlu
// menunggu di layar ini, cukup lanjut mengarahkan kamera ke kartu berikutnya
// (Section 20 & 29 UI_RULES: feedback jelas, tidak mengandalkan warna saja).
export function ScanQueuePanel<TResult>({ items }: { items: ScanQueueItem<TResult>[] }) {
  if (items.length === 0) return null;

  return (
    <div className="mt-4">
      <p className="mb-2 text-xs font-medium text-muted-foreground">Riwayat scan sesi ini</p>
      <div className="max-h-48 space-y-1.5 overflow-y-auto rounded-lg border border-border bg-muted/30 p-2">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between gap-3 rounded-md bg-background px-3 py-2 text-sm shadow-[0_1px_3px_rgba(15,23,42,0.06)]"
          >
            <div className="min-w-0">
              <p className="truncate font-medium text-foreground">{item.label}</p>
              {item.detail && <p className="truncate text-xs text-muted-foreground">{item.detail}</p>}
            </div>

            {item.status === "pending" && (
              <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                <Spinner className="size-4" />
                Memproses
              </span>
            )}
            {item.status === "success" && (
              <CheckCircle2 className="size-4 shrink-0 text-[#16A34A]" aria-label="Berhasil" />
            )}
            {item.status === "warning" && (
              <AlertTriangle className="size-4 shrink-0 text-[#D97706]" aria-label="Perhatian" />
            )}
            {item.status === "error" && (
              <XCircle className="size-4 shrink-0 text-[#DC2626]" aria-label="Gagal" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}