"use client";

// components/dashboard/dashboard-realtime-listener.tsx
//
// Versi protected dari components/publik/public-realtime-listener.tsx.
// Sebelumnya /dashboard (app/(protected)/dashboard/page.tsx) TIDAK punya
// listener realtime sama sekali -- itu sebabnya halaman ini butuh reload
// manual untuk melihat data terbaru, berbeda dengan halaman publik "/"
// yang sudah realtime.
//
// Komponen ini tidak merender apa pun -- ia subscribe ke perubahan tabel
// `Attendance` via Supabase Realtime (Postgres Changes) dan memanggil
// router.refresh() saat ada INSERT/UPDATE/DELETE, sehingga Server Component
// (dashboard/page.tsx) di-refetch dengan data terbaru tanpa reload penuh.
//
// Prasyarat sudah terpenuhi: tabel "Attendance" sudah dimasukkan ke
// publication `supabase_realtime` lewat migration
// prisma/migrations/20260823120000_enable_realtime_attendance/migration.sql
// (yang sama dipakai oleh halaman publik).
import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useThrottledRefresh } from "@/hooks/use-throttled-refresh";

// Throttle refresh: dashboard/page.tsx me-render ulang leaderboard bulanan
// yang berat (lihat report-service.ts) setiap kali di-refresh. Saat jam
// masuk sekolah, ratusan scan bisa masuk dalam hitungan menit -- kalau
// setiap scan langsung memicu router.refresh(), setiap tab dashboard yang
// terbuka akan menembak ulang query berat itu berkali-kali dalam waktu
// singkat dan membanjiri koneksi database. Data dashboard cukup update
// per 30 detik saja saat jam sibuk (leaderboard bulanan sendiri sudah
// di-cache 5 menit, jadi refresh sesering ini tidak menambah beban DB
// yang berarti).
const REFRESH_INTERVAL_MS = 30_000;

export function DashboardRealtimeListener() {
  const scheduleRefresh = useThrottledRefresh(REFRESH_INTERVAL_MS);

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel("dashboard-attendance-changes")
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