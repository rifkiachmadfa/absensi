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

export async function getStudentById(id: string) {
  return prisma.student.findUnique({
    where: { id },
    include: {
      class: {
        select: { id: true, name: true, status: true },
      },
    },
  });
}

export async function getClassOptions() {
  return prisma.class.findMany({
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