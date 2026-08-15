import "server-only";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/auth/session";
import type { ClassFormInput, ClassFilterInput } from "@/lib/validations/kelas";

export class ClassServiceError extends Error {}

function normalizeOptional(value?: string) {
  return value && value.trim() !== "" ? value.trim() : null;
}

export async function listClasses(filter: ClassFilterInput) {
  return prisma.class.findMany({
    where: {
      status: filter.status ?? undefined,
      academicYearId: filter.academicYearId || undefined,
      name: filter.search
        ? { contains: filter.search, mode: "insensitive" }
        : undefined,
    },
    include: {
      academicYear: { select: { id: true, name: true } },
      homeroomTeacher: { select: { id: true, name: true } },
      _count: { select: { students: true } },
    },
    orderBy: { name: "asc" },
  });
}

export async function getClassById(id: string) {
  return prisma.class.findUnique({
    where: { id },
    include: {
      academicYear: { select: { id: true, name: true, status: true } },
      homeroomTeacher: { select: { id: true, name: true } },
    },
  });
}

export async function getAcademicYearOptions() {
  return prisma.academicYear.findMany({
    select: { id: true, name: true, status: true },
    orderBy: [{ status: "asc" }, { name: "desc" }],
  });
}

export async function getHomeroomTeacherOptions() {
  return prisma.user.findMany({
    where: {
      role: { in: ["GURU", "WALI_KELAS"] },
      isActive: true,
    },
    select: { id: true, name: true, role: true },
    orderBy: { name: "asc" },
  });
}

export async function createClass(data: ClassFormInput, actor: SessionUser) {
  const academicYear = await prisma.academicYear.findUnique({
    where: { id: data.academicYearId },
  });

  if (!academicYear) {
    throw new ClassServiceError("Tahun ajaran tidak ditemukan.");
  }

  const duplicate = await prisma.class.findUnique({
    where: {
      name_academicYearId: {
        name: data.name,
        academicYearId: data.academicYearId,
      },
    },
  });

  if (duplicate) {
    throw new ClassServiceError("Nama kelas sudah digunakan pada tahun ajaran ini.");
  }

  const kelas = await prisma.class.create({
    data: {
      name: data.name,
      academicYearId: data.academicYearId,
      level: normalizeOptional(data.level),
      major: normalizeOptional(data.major),
      homeroomTeacherId: normalizeOptional(data.homeroomTeacherId),
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: actor.id,
      action: "CREATE",
      entity: "Class",
      entityId: kelas.id,
      description: `Membuat kelas ${kelas.name}`,
    },
  });

  return kelas;
}

export async function updateClass(
  id: string,
  data: ClassFormInput,
  actor: SessionUser
) {
  const existing = await prisma.class.findUnique({ where: { id } });

  if (!existing) {
    throw new ClassServiceError("Kelas tidak ditemukan.");
  }

  const academicYear = await prisma.academicYear.findUnique({
    where: { id: data.academicYearId },
  });

  if (!academicYear) {
    throw new ClassServiceError("Tahun ajaran tidak ditemukan.");
  }

  const duplicate = await prisma.class.findFirst({
    where: {
      name: data.name,
      academicYearId: data.academicYearId,
      NOT: { id },
    },
  });

  if (duplicate) {
    throw new ClassServiceError("Nama kelas sudah digunakan pada tahun ajaran ini.");
  }

  const updated = await prisma.class.update({
    where: { id },
    data: {
      name: data.name,
      academicYearId: data.academicYearId,
      level: normalizeOptional(data.level),
      major: normalizeOptional(data.major),
      homeroomTeacherId: normalizeOptional(data.homeroomTeacherId),
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: actor.id,
      action: "UPDATE",
      entity: "Class",
      entityId: updated.id,
      description: `Mengubah data kelas ${updated.name}`,
    },
  });

  return updated;
}

export async function setClassStatus(
  id: string,
  status: "ACTIVE" | "INACTIVE",
  actor: SessionUser
) {
  const existing = await prisma.class.findUnique({ where: { id } });

  if (!existing) {
    throw new ClassServiceError("Kelas tidak ditemukan.");
  }

  const updated = await prisma.class.update({
    where: { id },
    data: { status },
  });

  await prisma.auditLog.create({
    data: {
      userId: actor.id,
      action: "STATUS_CHANGE",
      entity: "Class",
      entityId: updated.id,
      description: `Status kelas ${updated.name}: ${existing.status} → ${status}`,
    },
  });

  return updated;
}