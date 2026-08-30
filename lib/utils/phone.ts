// lib/utils/phone.ts
//
// Normalisasi nomor WhatsApp Indonesia (docs/whatsapp-blast.md Section 13).
// Sengaja dipisah dari whatsapp-service.ts (yang "server-only" karena
// menyentuh Prisma/Fonnte) supaya fungsi murni ini bisa dipakai juga oleh
// lib/validations/pengaturan.ts (skema Zod untuk nomor sender, Section
// 45.3.1) tanpa ikut menyeret dependency server-only. Jangan buat helper
// normalisasi nomor duplikat di tempat lain.

/**
 * Menghasilkan format 62xxxxxxxxxx, atau null jika kosong/tidak dapat
 * dinormalisasi menjadi nomor Indonesia yang masuk akal (Section 13.1).
 */
export function normalizePhoneNumber(raw: string | null | undefined): string | null {
  if (!raw) return null;

  const trimmed = raw.trim();
  if (trimmed === "") return null;

  // Buang semua non-digit (spasi, tanda hubung, dsb) selain '+' di depan,
  // yang ditangani terpisah di bawah.
  const digitsOnly = trimmed.replace(/[^\d]/g, "");
  if (digitsOnly === "") return null;

  let normalized: string;
  if (trimmed.startsWith("+62")) {
    normalized = digitsOnly; // "+6281..." -> digitsOnly sudah "6281..."
  } else if (digitsOnly.startsWith("62")) {
    normalized = digitsOnly;
  } else if (digitsOnly.startsWith("0")) {
    normalized = `62${digitsOnly.slice(1)}`;
  } else if (digitsOnly.startsWith("8")) {
    normalized = `62${digitsOnly}`;
  } else {
    // Format tidak dikenali (mis. nomor luar negeri, input sampah).
    return null;
  }

  // Validasi masuk akal: nomor HP Indonesia setelah "62" berupa "8" diikuti
  // 8-12 digit lagi (total panjang nasional umum 10-13 digit termasuk "0"
  // di depan). Di luar rentang ini kemungkinan besar input salah ketik.
  if (!/^628\d{8,12}$/.test(normalized)) {
    return null;
  }

  return normalized;
}