-- Mengaktifkan Supabase Realtime (Postgres Changes) untuk tabel Attendance.
-- Dipakai oleh components/publik/public-realtime-listener.tsx agar
-- halaman publik "/" auto-update tanpa reload saat ada absensi baru
-- (scan, input manual, maupun perubahan status).
--
-- Aman dijalankan berulang: DO block ini mengecek dulu apakah tabel sudah
-- ada di publication supaya tidak error jika sudah pernah ditambahkan
-- manual lewat Supabase Dashboard.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'Attendance'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE "public"."Attendance";
  END IF;
END $$;

-- Tabel ini dibuat lewat Prisma migration (bukan Supabase Studio), jadi
-- role "anon" belum tentu punya privilege apa pun di atasnya. Tanpa GRANT +
-- RLS policy di bawah, subscribe Realtime di browser (pakai anon key) akan
-- "berhasil" tapi TIDAK PERNAH menerima event sama sekali -- gagal senyap,
-- tanpa error yang terlihat.
--
-- Data absensi memang sudah ditampilkan terbuka di halaman publik "/"
-- (§7 project spec: keterbukaan informasi kehadiran), jadi read-only akses
-- untuk anon di sini bukan kebocoran baru -- hanya memindahkan akses baca
-- yang sudah publik dari "lewat Prisma/server" menjadi "juga lewat
-- Realtime". Tetap SELECT-only, tidak ada INSERT/UPDATE/DELETE policy.
ALTER TABLE "public"."Attendance" ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON "public"."Attendance" TO anon, authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'Attendance'
      AND policyname = 'Public read access for realtime'
  ) THEN
    CREATE POLICY "Public read access for realtime"
      ON "public"."Attendance"
      FOR SELECT
      TO anon, authenticated
      USING (true);
  END IF;
END $$;