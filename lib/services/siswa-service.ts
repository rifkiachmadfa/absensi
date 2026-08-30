import "server-only";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/auth/session";
import type {
  StudentFormInput,
  StudentFilterInput,
} from "@/lib/validations/siswa";

export class StudentServiceError extends Error {}

const PAGE_SIZE = 25;

function normalizeOptional(value?: string) {
  return value && value.trim() !== "" ? value.trim() : null;
}

function generateQrToken() {
  return `STD-${crypto.randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()}`;
}

async function generateUniqueQrToken() {
  for (let attempt = 0; attempt < 5; attempt++) {
    const token = generateQrToken();
    const exists = await prisma.student.findUnique({ where: { qrToken: token } });
    if (!exists) return token;
  }
  throw new StudentServiceError("Gagal membuat QR Token, silakan coba lagi.");
}

export async function listStudents(filter: StudentFilterInput, page = 1) {
  const where = {
    status: filter.status ?? undefined,
    classId: filter.classId || undefined,
    OR: filter.search
      ? [
          { name: { contains: filter.search, mode: "insensitive" as const } },
          { nis: { contains: filter.search, mode: "insensitive" as const } },
          { nisn: { contains: filter.search, mode: "insensitive" as const } },
        ]
      : undefined,
  };

  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;

  const [data, total] = await Promise.all([
    prisma.student.findMany({
      where,
      include: {
        class: { select: { id: true, name: true } },
      },
      orderBy: { name: "asc" },
      skip: (safePage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.student.count({ where }),
  ]);

  return {
    data,
    total,
    page: safePage,
    pageSize: PAGE_SIZE,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

// SESUDAH
export async function getStudentById(id: string) {
  return prisma.student.findUnique({
    where: { id },
    include: {
      class: {
        select: {
          id: true,
          name: true,
          major: true,
          status: true,
          homeroomTeacherId: true,
        },
      },
    },
  });
}

/**
 * Mengambil daftar siswa untuk keperluan cetak kartu.
 * Digunakan oleh modul Kartu Siswa (/kartu-siswa).
 *
 * - classId diisi  -> seluruh siswa aktif pada kelas tersebut.
 * - classId kosong -> seluruh siswa aktif di semua kelas.
 *
 * Sengaja tidak dipaginasi (halaman cetak butuh seluruh data sekaligus),
 * namun tetap dibatasi hanya siswa berstatus ACTIVE karena kartu siswa
 * nonaktif tidak relevan untuk dicetak massal.
 */
// SESUDAH
export async function getStudentsForCardPrint(params: { classId?: string }) {
  return prisma.student.findMany({
    where: {
      status: "ACTIVE",
      classId: params.classId || undefined,
    },
    include: {
      class: { select: { id: true, name: true, major: true } },
    },
    orderBy: [{ class: { name: "asc" } }, { name: "asc" }],
  });
}

/**
 * Pencarian siswa untuk halaman PUBLIK (root "/" & /cek-kehadiran) --
 * dipakai oleh orang tua/umum TANPA login untuk menemukan anaknya.
 *
 * Mengembalikan id, nama, nama kelas, dan NIS. NIS diikutkan (bukan
 * sensitif -- lihat catatan di bawah) supaya avatar hasil pencarian bisa
 * memakai seed yang SAMA dengan avatar di Kartu Siswa (DiceBear seed =
 * NIS, lihat lib/kartu-siswa/avatar.ts), bukan lagi lingkaran inisial
 * teks. NISN tetap TIDAK dikembalikan karena lebih sensitif (dipakai
 * untuk verifikasi identitas di beberapa sistem lain).
 *
 * Catatan: NIS pada dasarnya sudah tampil sebagai teks biasa (tanpa
 * login) di leaderboard halaman publik yang sama (lihat "NIS {row.nis}"
 * di komponen dashboard/*-leaderboard.tsx yang direuse di app/page.tsx),
 * jadi menyertakannya di sini tidak menambah eksposur data baru.
 *
 * Hanya siswa berstatus ACTIVE yang muncul, dan query minimal 2 karakter
 * supaya tidak dipakai untuk "membrowsing" seluruh data siswa. Endpoint
 * yang memanggil fungsi ini WAJIB rate-limited (lihat
 * app/api/publik/cari-siswa).
 */
export async function searchStudentsPublic(query: string) {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  return prisma.student.findMany({
    where: {
      status: "ACTIVE",
      OR: [
        { name: { contains: trimmed, mode: "insensitive" as const } },
        { nis: { contains: trimmed } },
        { nisn: { contains: trimmed } },
      ],
    },
    select: {
      id: true,
      name: true,
      nis: true,
      class: { select: { name: true } },
    },
    orderBy: { name: "asc" },
    take: 10,
  });
}

export async function getClassOptions() {
  return prisma.class.findMany({
    select: { id: true, name: true, status: true },
    orderBy: [{ status: "asc" }, { name: "asc" }],
  });
}

export async function getClassHomeroomTeacherId(classId: string) {
  const kelas = await prisma.class.findUnique({
    where: { id: classId },
    select: { homeroomTeacherId: true },
  });
  return kelas?.homeroomTeacherId ?? null;
}

export async function getStudentClassHomeroomTeacherId(studentId: string) {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { class: { select: { homeroomTeacherId: true } } },
  });
  return student?.class.homeroomTeacherId ?? null;
}

/** Daftar kelas yang boleh dipilih actor untuk MENAMBAH siswa. */
export async function getClassOptionsForCreate(actor: SessionUser) {
  if (actor.role === "SUPERADMIN" || actor.role === "ADMIN") {
    return getClassOptions();
  }
  // WALI_KELAS hanya boleh menambah siswa ke kelas yang ia ampu.
  return prisma.class.findMany({
    where: { homeroomTeacherId: actor.id },
    select: { id: true, name: true, status: true },
    orderBy: [{ status: "asc" }, { name: "asc" }],
  });
}

export async function createStudent(data: StudentFormInput, actor: SessionUser) {
  const kelas = await prisma.class.findUnique({ where: { id: data.classId } });
  if (!kelas) {
    throw new StudentServiceError("Kelas tidak ditemukan.");
  }

  const duplicateNis = await prisma.student.findUnique({ where: { nis: data.nis } });
  if (duplicateNis) {
    throw new StudentServiceError("NIS sudah digunakan oleh siswa lain.");
  }

  const nisn = normalizeOptional(data.nisn);
  if (nisn) {
    const duplicateNisn = await prisma.student.findUnique({ where: { nisn } });
    if (duplicateNisn) {
      throw new StudentServiceError("NISN sudah digunakan oleh siswa lain.");
    }
  }

  const qrToken = await generateUniqueQrToken();

  const student = await prisma.student.create({
    data: {
      nis: data.nis.trim(),
      nisn,
      name: data.name.trim(),
      gender: data.gender,
      classId: data.classId,
      qrToken,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: actor.id,
      action: "CREATE",
      entity: "Student",
      entityId: student.id,
      description: `Menambahkan siswa ${student.name} (NIS ${student.nis})`,
    },
  });

  return student;
}

export async function updateStudent(
  id: string,
  data: StudentFormInput,
  actor: SessionUser
) {
  const existing = await prisma.student.findUnique({ where: { id } });
  if (!existing) {
    throw new StudentServiceError("Siswa tidak ditemukan.");
  }

  const kelas = await prisma.class.findUnique({ where: { id: data.classId } });
  if (!kelas) {
    throw new StudentServiceError("Kelas tidak ditemukan.");
  }

  const duplicateNis = await prisma.student.findFirst({
    where: { nis: data.nis, NOT: { id } },
  });
  if (duplicateNis) {
    throw new StudentServiceError("NIS sudah digunakan oleh siswa lain.");
  }

  const nisn = normalizeOptional(data.nisn);
  if (nisn) {
    const duplicateNisn = await prisma.student.findFirst({
      where: { nisn, NOT: { id } },
    });
    if (duplicateNisn) {
      throw new StudentServiceError("NISN sudah digunakan oleh siswa lain.");
    }
  }

  const updated = await prisma.student.update({
    where: { id },
    data: {
      nis: data.nis.trim(),
      nisn,
      name: data.name.trim(),
      gender: data.gender,
      classId: data.classId,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: actor.id,
      action: "UPDATE",
      entity: "Student",
      entityId: updated.id,
      description: `Mengubah data siswa ${updated.name}`,
    },
  });

  return updated;
}

export async function setStudentStatus(
  id: string,
  status: "ACTIVE" | "INACTIVE",
  actor: SessionUser
) {
  const existing = await prisma.student.findUnique({ where: { id } });
  if (!existing) {
    throw new StudentServiceError("Siswa tidak ditemukan.");
  }

  const updated = await prisma.student.update({
    where: { id },
    data: { status },
  });

  await prisma.auditLog.create({
    data: {
      userId: actor.id,
      action: "STATUS_CHANGE",
      entity: "Student",
      entityId: updated.id,
      description: `Status siswa ${updated.name}: ${existing.status} → ${status}`,
    },
  });

  return updated;
}