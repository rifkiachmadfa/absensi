import { createClient } from "@supabase/supabase-js";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

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

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error || !data.user) {
    console.error("Gagal membuat user di Supabase Auth:", error?.message);
    process.exit(1);
  }

  try {
    await prisma.user.create({
      data: {
        id: data.user.id,
        email,
        name,
        role: "SUPERADMIN",
        isActive: true,
      },
    });
  } catch (err) {
    // Rollback: kalau insert ke Prisma gagal, jangan tinggalkan user "orphan" di Supabase Auth
    console.error("Gagal membuat User di database, rollback Supabase Auth user...");
    await supabaseAdmin.auth.admin.deleteUser(data.user.id);
    throw err;
  }

  console.log(`SUPERADMIN "${email}" berhasil dibuat.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());