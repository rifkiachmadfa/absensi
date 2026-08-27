import { PrismaClient } from "@/app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// PENTING -- baca sebelum mengubah `max`:
// Tiap instance serverless (Vercel Fluid Compute) membuat pool `pg` sendiri.
// Total koneksi real ke Postgres = (jumlah instance yang hidup bersamaan) x
// `max` di bawah ini. Karena itu:
//   1. DATABASE_URL WAJIB mengarah ke Supabase connection pooler (Supavisor,
//      port 6543, host "...pooler.supabase.com"), BUKAN direct connection
//      (port 5432) -- direct connection Supabase punya limit koneksi kecil
//      dan cepat habis saat banyak instance aktif bersamaan (mis. jam
//      masuk sekolah saat guru ramai-ramai scan & buka dashboard).
//   2. `max` di sini sengaja dibuat KECIL per instance -- jangan dinaikkan
//      tanpa menghitung ulang total (instance x max) terhadap limit pooler.
//   3. `connectionTimeoutMillis` dibuat pendek supaya request GAGAL CEPAT
//      dengan error yang jelas ketika pool penuh, daripada ikut mengantre
//      lama dan menyeret request lain (mis. /login, /api/absensi/search)
//      ikut timeout karena menunggu koneksi yang sama.
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
  max: 10,
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 5_000,
});

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}