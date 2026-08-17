// lib/kartu-siswa/avatar.ts

/**
 * Avatar murid menggunakan DiceBear "clay" (https://www.dicebear.com/styles/clay/).
 * Seed dibuat dari NIS agar avatar setiap murid konsisten setiap kali
 * kartu dirender ulang (tidak berubah-ubah acak).
 *
 * PENTING: jangan set backgroundColor="transparent" — itu bukan nilai valid
 * di DiceBear (tipe backgroundColor adalah hex color, mis. "22949E").
 * Kalau parameter ini tidak diisi sama sekali, background sudah otomatis
 * transparan, jadi cukup dihilangkan.
 */
export type AvatarFormat = "svg" | "png";

const DICEBEAR_VERSION = "10.x"; // versi aktif terbaru (9.x juga masih aktif)
const DICEBEAR_STYLE = "clay";

export function getStudentAvatarUrl(
  seed: string,
  format: AvatarFormat = "svg"
): string {
  const params = new URLSearchParams({ seed });
  return `https://api.dicebear.com/${DICEBEAR_VERSION}/${DICEBEAR_STYLE}/${format}?${params.toString()}`;
}