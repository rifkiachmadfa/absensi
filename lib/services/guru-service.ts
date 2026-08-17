// lib/services/guru-service.ts
import "server-only";
import { prisma } from "@/lib/prisma";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { SessionUser } from "@/lib/auth/session";
import type {
  GuruCreateInput,
  GuruUpdateInput,
  GuruFilterInput,
} from "@/lib/validations/guru";

export class GuruServiceError extends Error {}

const PAGE_SIZE = 25;

// ============================================================
// Read
// ============================================================

export async function listGuru(filter: GuruFilterInput, page = 1) {
  const where = {
    ...(filter.role ? { role: filter.role } : {}),
    ...(filter.status === "ACTIVE" ? { isActive: true } : {}),
    ...(filter.status === "INACTIVE" ? { isActive: false } : {}),
    ...(filter.search
      ? {
          OR: [
            { name: { contains: filter.search, mode: "insensitive" as const } },
            { email: { contains: filter.search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;

  const [data, total] = await Promise.all([
    prisma.user.findMany({
      where,
      include: {
        homeroomClasses: { select: { id: true, name: true, status: true } },
      },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      skip: (safePage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.user.count({ where }),
  ]);

  return {
    data,
    total,
    page: safePage,
    pageSize: PAGE_SIZE,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

export async function getGuruById(id: string) {
  return prisma.user.findUnique({
    where: { id },
    include: {
      homeroomClasses: { select: { id: true, name: true, status: true } },
    },
  });
}

// ============================================================
// Write
// ============================================================

/**
 * Membuat akun guru/pengguna baru: 1) buat user di Supabase Auth (email +
 * password, langsung dikonfirmasi tanpa perlu verifikasi email), 2) simpan
 * data profil & role di tabel User (Prisma) dengan id yang SAMA PERSIS
 * dengan id Supabase Auth.
 *
 * Jika langkah 2 gagal, langkah 1 di-rollback (hapus user Supabase Auth)
 * supaya tidak ada akun "orphan" yang bisa login tapi tidak punya profil.
 */
export async function createGuru(data: GuruCreateInput, actor: SessionUser) {
  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) {
    throw new GuruServiceError("Email sudah digunakan oleh pengguna lain.");
  }

  const supabaseAdmin = getSupabaseAdmin();

  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: data.email,
    password: data.password,
    email_confirm: true,
  });

  if (authError || !authData.user) {
    const msg = authError?.message ?? "";
    if (msg.toLowerCase().includes("already") || msg.toLowerCase().includes("registered")) {
      throw new GuruServiceError("Email sudah terdaftar di sistem autentikasi.");
    }
    throw new GuruServiceError(msg || "Gagal membuat akun autentikasi.");
  }

  try {
    const user = await prisma.user.create({
      data: {
        id: authData.user.id,
        email: data.email,
        name: data.name.trim(),
        role: data.role,
        isActive: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: actor.id,
        action: "CREATE",
        entity: "User",
        entityId: user.id,
        description: `Menambahkan pengguna ${user.name} (${user.email}) sebagai ${user.role}`,
      },
    });

    return user;
  } catch (err) {
    // Rollback: user Supabase Auth sudah terlanjur dibuat, tapi profil Prisma
    // gagal disimpan (mis. race condition email unik). Jangan tinggalkan
    // akun "orphan" yang bisa login tapi tidak terdaftar di sistem.
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id).catch(() => {});
    console.error("createGuru: rollback Supabase Auth user setelah Prisma gagal:", err);
    throw new GuruServiceError("Gagal menyimpan data pengguna, silakan coba lagi.");
  }
}

/**
 * Mengubah profil guru/pengguna (nama, email, role). Password TIDAK diubah
 * lewat sini -- pakai resetGuruPassword() secara terpisah (Section: reset
 * password langsung tanpa verifikasi password lama).
 */
export async function updateGuru(id: string, data: GuruUpdateInput, actor: SessionUser) {
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) {
    throw new GuruServiceError("Pengguna tidak ditemukan.");
  }

  if (data.email !== existing.email) {
    const duplicateEmail = await prisma.user.findFirst({
      where: { email: data.email, NOT: { id } },
    });
    if (duplicateEmail) {
      throw new GuruServiceError("Email sudah digunakan oleh pengguna lain.");
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { error } = await supabaseAdmin.auth.admin.updateUserById(id, {
      email: data.email,
      email_confirm: true,
    });
    if (error) {
      throw new GuruServiceError(`Gagal mengubah email login: ${error.message}`);
    }
  }

  const updated = await prisma.user.update({
    where: { id },
    data: {
      name: data.name.trim(),
      email: data.email,
      role: data.role,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: actor.id,
      action: "UPDATE",
      entity: "User",
      entityId: updated.id,
      description: `Mengubah data pengguna ${updated.name} (${updated.email})`,
    },
  });

  return updated;
}

/**
 * Aktifkan/nonaktifkan akun. Ini adalah pengganti "hapus" -- data pengguna
 * TIDAK dihapus permanen, karena masih dirujuk oleh histori absensi
 * (Attendance.recordedById) dan audit log (Section 3.3 & 20: audit log
 * tidak boleh hilang). Akun nonaktif tidak bisa login (lihat
 * lib/auth/session.ts: getCurrentUser menolak user isActive=false).
 */
export async function setGuruStatus(
  id: string,
  status: "ACTIVE" | "INACTIVE",
  actor: SessionUser
) {
  if (id === actor.id) {
    throw new GuruServiceError("Anda tidak dapat menonaktifkan akun Anda sendiri.");
  }

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) {
    throw new GuruServiceError("Pengguna tidak ditemukan.");
  }

  if (status === "INACTIVE" && existing.role === "SUPERADMIN") {
    const activeSuperadminCount = await prisma.user.count({
      where: { role: "SUPERADMIN", isActive: true },
    });
    if (activeSuperadminCount <= 1) {
      throw new GuruServiceError("Tidak dapat menonaktifkan SUPERADMIN terakhir yang aktif.");
    }
  }

  const isActive = status === "ACTIVE";

  const updated = await prisma.user.update({
    where: { id },
    data: { isActive },
  });

  await prisma.auditLog.create({
    data: {
      userId: actor.id,
      action: "STATUS_CHANGE",
      entity: "User",
      entityId: updated.id,
      description: `Status pengguna ${updated.name}: ${
        existing.isActive ? "AKTIF" : "NONAKTIF"
      } -> ${isActive ? "AKTIF" : "NONAKTIF"}`,
    },
  });

  return updated;
}

/**
 * Reset password guru langsung oleh admin/superadmin, TANPA perlu
 * memasukkan/verifikasi password lama guru tersebut.
 */
export async function resetGuruPassword(
  id: string,
  newPassword: string,
  actor: SessionUser
) {
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) {
    throw new GuruServiceError("Pengguna tidak ditemukan.");
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { error } = await supabaseAdmin.auth.admin.updateUserById(id, {
    password: newPassword,
  });

  if (error) {
    throw new GuruServiceError(`Gagal mereset password: ${error.message}`);
  }

  await prisma.auditLog.create({
    data: {
      userId: actor.id,
      action: "UPDATE",
      entity: "User",
      entityId: existing.id,
      description: `Reset password untuk pengguna ${existing.name} (${existing.email})`,
    },
  });
}