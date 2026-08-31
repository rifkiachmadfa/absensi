// lib/cache/public-dashboard.ts

import { revalidatePath, revalidateTag } from "next/cache";
import {
  ATTENDANCE_TODAY_STATS_TAG,
  ATTENDANCE_TREND_TAG,
} from "@/lib/cache/tags";

const THROTTLE_MS = 5_000;

let lastRevalidateAt = 0;

export function notifyPublicDashboardChanged(): void {
  const now = Date.now();

  if (now - lastRevalidateAt < THROTTLE_MS) {
    return;
  }

  lastRevalidateAt = now;

  // Next.js 16 membutuhkan cacheLife profile sebagai argument kedua.
  // "max" menggunakan strategi stale-while-revalidate.
  revalidateTag(ATTENDANCE_TODAY_STATS_TAG, "max");
  revalidateTag(ATTENDANCE_TREND_TAG, "max");

  // Bersihkan cache halaman.
  revalidatePath("/");
  revalidatePath("/dashboard");
}