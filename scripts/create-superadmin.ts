import { createClient } from "@supabase/supabase-js";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  const email = process.argv[2];
  const password = process.argv[3];
  const name = process.argv[4] ?? "Super Admin";

  if (!email || !password) {
    console.error(
      "Usage: tsx scripts/create-superadmin.ts <email> <password> [name]"
    );
    process.exit(1);
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("SUPABASE_SERVICE_ROLE_KEY tidak ditemukan di environment.");
    process.exit(1);
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const created = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  let authUserId: string;
  // weCreatedTheAuthUser menentukan apakah rollback (hapus Supabase Auth
  // user) boleh dilakukan kalau langkah Prisma di bawah gagal. Kalau
  // akun Supabase Auth-nya SUDAH ada sebelum script ini jalan (cabang
  // "already registered"), kita TIDAK BOLEH menghapusnya -- itu bukan
  // milik/tanggung jawab run ini.
  let weCreatedTheAuthUser: boolean;

  if (created.data.user && !created.error) {
    authUserId = created.data.user.id;
    weCreatedTheAuthUser = true;
  } else if (
    // Kasus paling umum setelah clone ulang project: akun Supabase Auth
    // untuk email ini sudah ada (dibuat dari dashboard Supabase, atau
    // dari run script sebelumnya di database lain), tapi baris di tabel
    // User (Prisma) di database yang SEDANG dipakai sekarang belum ada.
    // Ini persis kondisi yang bikin requireAuth() infinite-redirect-loop
    // (lihat lib/auth/session.ts). Daripada berhenti dengan error, kita
    // verifikasi email+password yang diberikan benar-benar valid (lewat
    // signInWithPassword), lalu pakai id akun itu untuk membuat baris
    // User yang hilang.
    created.error?.code === "email_exists" ||
    created.error?.status === 422 ||
    created.error?.message?.toLowerCase().includes("already")
  ) {
    console.log(
      `Akun Supabase Auth untuk "${email}" sudah ada. Memverifikasi password untuk menautkannya...`
    );

    const signInClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data: signInData, error: signInError } =
      await signInClient.auth.signInWithPassword({ email, password });

    if (signInError || !signInData.user) {
      console.error(
        "Akun sudah ada di Supabase Auth, tapi password yang dimasukkan salah -- " +
          "tidak bisa memverifikasi kepemilikan akun. Reset password akun ini " +
          "lewat Supabase Dashboard, lalu jalankan ulang script dengan password baru."
      );
      process.exit(1);
    }

    authUserId = signInData.user.id;
    weCreatedTheAuthUser = false;
  } else {
    console.error("Gagal membuat user di Supabase Auth:", created.error?.message);
    process.exit(1);
    return;
  }

  try {
    // upsert (bukan create) -- supaya script ini aman dijalankan ulang:
    // kalau baris User sudah ada tapi nonaktif/role lain, dipulihkan
    // jadi SUPERADMIN aktif; kalau belum ada, dibuat baru.
    await prisma.user.upsert({
      where: { id: authUserId },
      update: {
        email,
        name,
        role: "SUPERADMIN",
        isActive: true,
      },
      create: {
        id: authUserId,
        email,
        name,
        role: "SUPERADMIN",
        isActive: true,
      },
    });
  } catch (err) {
    if (weCreatedTheAuthUser) {
      // Rollback: kalau insert ke Prisma gagal, jangan tinggalkan user "orphan" di Supabase Auth
      console.error("Gagal membuat User di database, rollback Supabase Auth user...");
      await supabaseAdmin.auth.admin.deleteUser(authUserId);
    }
    throw err;
  }

  console.log(`SUPERADMIN "${email}" berhasil dibuat/ditautkan.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());