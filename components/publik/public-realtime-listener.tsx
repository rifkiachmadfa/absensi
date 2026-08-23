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
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Debounce refresh: saat import Excel massal, banyak INSERT bisa masuk
// beruntun dalam waktu singkat -- kita tidak mau memanggil router.refresh()
// untuk tiap baris.
const REFRESH_DEBOUNCE_MS = 800;

export function PublicRealtimeListener() {
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
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      supabase.removeChannel(channel);
    };
  }, [router]);

  return null;
}