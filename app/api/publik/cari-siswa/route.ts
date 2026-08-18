// app/api/publik/cari-siswa/route.ts
//
// Endpoint PUBLIK (tanpa login) untuk fitur pencarian siswa di halaman "/"
// dan sumber navigasi ke /cek-kehadiran/[id].
//
// Keamanan:
// - Rate-limited PER IP (bukan per user, karena endpoint ini publik/anonim).
// - Hanya mengembalikan id + nama + nama kelas, TIDAK NIS/NISN/qrToken.
// - Query minimal 2 karakter, hasil dibatasi 10 baris.
import { NextRequest, NextResponse } from "next/server";
import { searchStudentsPublic } from "@/lib/services/siswa-service";
import { isRateLimited } from "@/lib/rate-limit";

function getClientIp(req: NextRequest): string {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);

  // Limit lebih ketat daripada pencarian internal (/api/absensi/search)
  // karena endpoint ini bisa diakses siapa saja tanpa autentikasi.
  if (isRateLimited(`publik:cari-siswa:${ip}`, 20, 60_000)) {
    return NextResponse.json(
      { message: "Terlalu banyak permintaan, coba beberapa saat lagi." },
      { status: 429 }
    );
  }

  const query = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (query.length < 2) {
    return NextResponse.json({ students: [] });
  }

  const students = await searchStudentsPublic(query);
  return NextResponse.json({
    students: students.map((s) => ({
      id: s.id,
      name: s.name,
      className: s.class.name,
    })),
  });
}