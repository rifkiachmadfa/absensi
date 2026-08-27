"use client";

// hooks/use-throttled-refresh.ts
//
// Dipakai oleh dashboard-realtime-listener.tsx & public-realtime-listener.tsx.
//
// Sebelumnya kedua listener itu memakai DEBOUNCE murni (800ms): setiap event
// realtime me-reset timer, baru refresh setelah 800ms TANPA event baru. Saat
// jam masuk sekolah, scan siswa datang beruntun tapi jaraknya sering > 800ms
// (bukan machine-gun terus-menerus) -- sehingga debounce tetap memicu
// router.refresh() berkali-kali dalam rentang singkat. Setiap refresh berarti
// Server Component (dashboard/page.tsx atau app/page.tsx) di-render ulang,
// termasuk seluruh query leaderboard -- inilah salah satu penyebab query
// storm ke database saat banyak siswa scan berurutan.
//
// Throttle di bawah ini membatasi MAKSIMAL 1 refresh per `intervalMs`,
// terlepas dari seberapa sering event realtime masuk, tapi tetap menjamin
// ada 1 refresh "trailing" setelah interval berakhir supaya data tidak
// pernah basi lebih dari `intervalMs`. Ini sengaja dibuat generik (bukan
// logic khusus dashboard) supaya bisa dipakai ulang oleh listener lain di
// masa depan tanpa duplikasi (lihat Development Rules §39.10).
import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export function useThrottledRefresh(intervalMs: number) {
  const router = useRouter();
  const lastRunRef = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef(false);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return useCallback(() => {
    const now = Date.now();
    const elapsed = now - lastRunRef.current;

    if (elapsed >= intervalMs) {
      lastRunRef.current = now;
      router.refresh();
      return;
    }

    // Sudah ada refresh yang dijadwalkan untuk menutup window ini -- event
    // tambahan sebelum window berakhir tidak perlu menjadwalkan lagi.
    if (pendingRef.current) return;

    pendingRef.current = true;
    timeoutRef.current = setTimeout(() => {
      pendingRef.current = false;
      lastRunRef.current = Date.now();
      router.refresh();
    }, intervalMs - elapsed);
  }, [intervalMs, router]);
}