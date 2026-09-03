// components/absensi/live-log/use-live-scan-log.ts
"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ABSENSI_LIVE_LOG_CHANNEL } from "@/lib/attendance/realtime/attendance-live-channel";
import { getInitialLiveLog } from "./actions";
import { MAX_LIVE_LOG_ROWS } from "./constants";
import type { LiveLogRow, LiveLogMode, LiveLogStatus } from "./types";

// Payload broadcast (bentuknya harus tetap SAMA dengan
// lib/realtime/attendance-live-broadcast.ts di server -- tidak diimpor
// langsung karena file itu server-only).
type IdentifiedPayload = {
  scanId: string;
  mode: LiveLogMode;
  name: string;
  className: string;
  ts: string;
};

type ResultPayload = {
  scanId: string;
  mode: LiveLogMode;
  name: string | null;
  className: string | null;
  status: LiveLogStatus;
  label: string;
  detail?: string;
  ts: string;
};

// Subscribe ke channel Broadcast + ambil riwayat hari ini saat mount.
// TIDAK terikat ke satu dialog/tab tertentu -- setiap komponen yang
// memanggil hook ini (mis. tab "Log Live" di ScanDialog & ScanDialogPulang
// sekaligus, kalau kebetulan dua-duanya terbuka) mendapat SALINAN state-nya
// sendiri, tapi semuanya menerima broadcast yang sama dari server.
export function useLiveScanLog({ enabled }: { enabled: boolean }) {
  const [rows, setRows] = useState<LiveLogRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const loadedOnceRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    // Snapshot awal hanya diambil SEKALI (per mount tab ini) -- update
    // sesudahnya murni dari broadcast, bukan polling ulang action ini.
    if (!loadedOnceRef.current) {
      loadedOnceRef.current = true;
      getInitialLiveLog()
        .then((initial) => {
          if (!cancelled) setRows(initial);
        })
        .catch((err) => {
          console.error("Load initial live log error:", err);
        })
        .finally(() => {
          if (!cancelled) setIsLoading(false);
        });
    } else {
      setIsLoading(false);
    }

    const supabase = createClient();
    const channel = supabase.channel(ABSENSI_LIVE_LOG_CHANNEL);

    channel
      .on("broadcast", { event: "identified" }, ({ payload }: { payload: IdentifiedPayload }) => {
        setRows((prev) => {
          // Fallback append: kalau tab ini baru connect DI TENGAH proses
          // (mis. dibuka setelah event "identified" untuk scan sebelumnya
          // sudah lewat), baris untuk scanId ini belum ada -- akan
          // ditambahkan begitu event "result" datang (lihat handler di
          // bawah). Di sini kita hanya menambahkan baris BARU untuk
          // scanId yang benar-benar belum pernah terlihat.
          if (prev.some((r) => r.id === payload.scanId)) return prev;
          const row: LiveLogRow = {
            id: payload.scanId,
            mode: payload.mode,
            name: payload.name,
            className: payload.className,
            status: "pending",
            label: payload.name,
            identified: true,
            ts: payload.ts,
          };
          return [row, ...prev].slice(0, MAX_LIVE_LOG_ROWS);
        });
      })
      .on("broadcast", { event: "result" }, ({ payload }: { payload: ResultPayload }) => {
        setRows((prev) => {
          const idx = prev.findIndex((r) => r.id === payload.scanId);
          const patched: LiveLogRow = {
            id: payload.scanId,
            mode: payload.mode,
            name: payload.name,
            className: payload.className,
            status: payload.status,
            label: payload.label,
            detail: payload.detail,
            identified: true,
            ts: payload.ts,
          };
          // Kalau identified tidak sempat diterima (race condition,
          // Section "Alur end-to-end" pada spesifikasi fitur) tapi result
          // datang duluan -> baris baru langsung dibuat dari sini saja.
          if (idx === -1) return [patched, ...prev].slice(0, MAX_LIVE_LOG_ROWS);
          const next = [...prev];
          next[idx] = patched;
          return next;
        });
      })
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [enabled]);

  return { rows, isLoading };
}