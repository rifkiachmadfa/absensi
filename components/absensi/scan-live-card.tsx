// components/absensi/scan-live-card.tsx
"use client";

import { CheckCircle2, AlertTriangle, XCircle, ScanLine } from "lucide-react";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";
import type { ScanQueueItem, ScanQueueStatus } from "@/components/absensi/use-scan-queue";

// Kartu ini adalah pengganti tampilan kamera untuk mode "Scanner Fisik"
// (Section 29 UI_RULES: guru tetap butuh feedback visual yang jelas walau
// tidak ada preview kamera untuk dilihat). Menampilkan hasil scan TERBARU
// dari antrian (queue[0]) dalam format Nama / Kelas / Proses, mengikuti DUA
// fase NYATA di server (bukan animasi tebakan) -- lihat use-scan-queue.ts
// (markIdentified) & attendance-service.ts (identify()/identifyPulang()):
//
// 1. Belum diidentifikasi (`item.identified` masih false): server belum
//    sempat menjawab fase identifikasi cepat sama sekali -- Nama & Kelas
//    masih "-", baris "Proses" menampilkan "Mengidentifikasi kartu...".
// 2. Sudah diidentifikasi tapi status masih "pending": Nama/Kelas SUDAH
//    terisi (fase identifikasi cepat sudah menjawab), sementara absensi
//    sesungguhnya (checkIn()/checkOut()) masih diproses di background --
//    baris "Proses" menampilkan "Menyimpan data absensi...".
// 3. Hasil final datang (`status` bukan lagi "pending"): Nama/Kelas
//    terisi final (atau pesan error kalau kartu tidak dikenali sama
//    sekali), baris "Proses" berhenti di deskripsi hasil akhir, dan warna
//    kartu mengikuti status (hijau/kuning/merah) -- konsisten dengan
//    Section 4 UI_RULES (warna sesuai makna, bukan dekorasi).

const STATUS_CARD_CLASS: Record<ScanQueueStatus, string> = {
  pending: "border-border bg-muted/30",
  success: "border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/40",
  warning: "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40",
  error: "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/40",
};

function StatusIcon({ status }: { status: ScanQueueStatus }) {
  if (status === "pending") return <Spinner className="size-5 text-muted-foreground" />;
  if (status === "success") return <CheckCircle2 className="size-5 shrink-0 text-[#16A34A]" aria-label="Berhasil" />;
  if (status === "warning") return <AlertTriangle className="size-5 shrink-0 text-[#D97706]" aria-label="Perhatian" />;
  return <XCircle className="size-5 shrink-0 text-[#DC2626]" aria-label="Gagal" />;
}

function LiveCardBody<TResult>({ item }: { item: ScanQueueItem<TResult> }) {
  const isPending = item.status === "pending";
  const isIdentified = Boolean(item.identified);

  // Nama/Kelas hanya ditampilkan begitu server BENAR-BENAR mengenali siswa
  // (item.identified === true, lewat markIdentified() di use-scan-queue.ts)
  // -- bukan menebak dari `label` placeholder "Memindai kartu..." yang
  // dipasang handleDetected sebelum request dikirim.
  const nama = isIdentified ? item.label : "-";
  const kelas = isIdentified ? (item.meta?.className ?? "-") : "-";
  const proses = !isPending
    ? (item.detail ?? "Selesai diproses")
    : isIdentified
      ? "Menyimpan data absensi..."
      : "Mengidentifikasi kartu...";

  return (
    <div
      className={cn(
        "rounded-xl border p-4 transition-colors",
        STATUS_CARD_CLASS[item.status]
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            Nama
          </p>
          <p className="truncate text-lg font-semibold text-foreground">{nama}</p>

          <p className="mt-2.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            Kelas
          </p>
          <p className="text-sm text-foreground">{kelas}</p>
        </div>
        <StatusIcon status={item.status} />
      </div>

      <div className="mt-3 border-t border-border/70 pt-2.5">
        <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          Proses
        </p>
        <p
          className={cn(
            "text-sm text-foreground",
            isPending && "animate-pulse text-muted-foreground"
          )}
        >
          {proses}
        </p>
      </div>
    </div>
  );
}

export function ScanLiveCard<TResult>({ item }: { item?: ScanQueueItem<TResult> }) {
  if (!item) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border p-8 text-center">
        <ScanLine className="size-6 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Menunggu kartu di-scan...</p>
      </div>
    );
  }

  return <LiveCardBody key={item.id} item={item} />;
}