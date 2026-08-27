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
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Debounce refresh: saat import Excel massal atau banyak scan beruntun,
// banyak event bisa masuk dalam waktu singkat -- kita tidak mau memanggil
// router.refresh() untuk tiap event satu-satu.
const REFRESH_DEBOUNCE_MS = 800;

export function DashboardRealtimeListener() {
  const router = useRouter();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supabase = createClient();

    const scheduleRefresh = () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        router.refresh();
      }, REFRESH_DEBOUNCE_MS);
    };

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
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      supabase.removeChannel(channel);
    };
  }, [router]);

  return null;
}