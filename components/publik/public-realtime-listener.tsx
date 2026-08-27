"use client";

// components/publik/public-realtime-listener.tsx
//
// Membuat halaman publik "/" update tanpa reload manual. Komponen ini tidak
// merender apa pun -- ia hanya subscribe ke perubahan tabel `Attendance` via
// Supabase Realtime (Postgres Changes) lalu memanggil router.refresh() saat
// ada INSERT/UPDATE. router.refresh() akan mem-fetch ulang Server Component
// (page.tsx) dengan data terbaru tanpa full page reload/flash, dan tetap
// memakai cache yang sudah di-revalidate oleh revalidatePath("/") di
// masing-masing action/API (lib/services/attendance-service.ts dst).
//
// Prasyarat: tabel "Attendance" harus dimasukkan ke publication
// `supabase_realtime` -- lihat migration
// prisma/migrations/<timestamp>_enable_realtime_attendance/migration.sql
// dan pastikan Realtime diaktifkan untuk tabel tsb di Supabase Dashboard
// (Database > Replication) jika project sudah lama/tidak lewat migration.
import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useThrottledRefresh } from "@/hooks/use-throttled-refresh";

// Throttle refresh -- lihat komentar di dashboard-realtime-listener.tsx.
// Halaman ini bahkan lebih perlu dilindungi: publik, tanpa login, jadi bisa
// dibuka & ditinggal terbuka oleh siapa saja (mis. layar TV di lobi
// sekolah), dan sekarang ikut merender leaderboard bulanan yang berat.
const REFRESH_INTERVAL_MS = 30_000;

export function PublicRealtimeListener() {
  const scheduleRefresh = useThrottledRefresh(REFRESH_INTERVAL_MS);

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel("public-attendance-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "Attendance" },
        () => {
          scheduleRefresh();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [scheduleRefresh]);

  return null;
}