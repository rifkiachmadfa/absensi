import "server-only";
import { createClient } from "@supabase/supabase-js";

// Client Supabase dengan Service Role Key -- HANYA boleh dipakai di server
// (Server Action / Route Handler), TIDAK PERNAH diimport dari Client Component.
//
// Dipakai untuk operasi admin yang butuh bypass RLS & tidak butuh sesi user
// yang sedang login, contoh: membuat akun guru baru, reset password langsung
// tanpa verifikasi password lama, mengubah email login guru.
//
// JANGAN PERNAH expose SUPABASE_SERVICE_ROLE_KEY ke client (Section 27).
let cachedAdminClient: ReturnType<typeof createClient> | null = null;

export function getSupabaseAdmin() {
  if (cachedAdminClient) return cachedAdminClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_URL belum diset di environment (.env)."
    );
  }

  cachedAdminClient = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  return cachedAdminClient;
}