-- ============================================================
-- SUPABASE REALTIME
-- ============================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_publication
    WHERE pubname = 'supabase_realtime'
  ) THEN

    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'Attendance'
    ) THEN

      ALTER PUBLICATION supabase_realtime
      ADD TABLE "public"."Attendance";

    END IF;

  END IF;
END $$;


-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE "public"."Attendance"
ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- READ ACCESS
-- ============================================================

GRANT SELECT
ON "public"."Attendance"
TO anon, authenticated;


-- ============================================================
-- RLS POLICY
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
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