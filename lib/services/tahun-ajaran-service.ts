import "server-only";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/auth/session";
import type { AcademicYearFormInput } from "@/lib/validations/tahun-ajaran";

export class AcademicYearServiceError extends Error {}

export async function listAcademicYears() {
  return prisma.academicYear.findMany({
    include: {
      _count: { select: { classes: true } },
    },
    orderBy: { name: "desc" },
  });
}

export async function createAcademicYear(
  data: AcademicYearFormInput,
  actor: SessionUser
) {
  const existing = await prisma.academicYear.findUnique({
    where: { name: data.name },
  });

  if (existing) {
    throw new AcademicYearServiceError("Tahun ajaran ini sudah ada.");
  }

  const academicYear = await prisma.academicYear.create({
    data: { name: data.name },
  });

  await prisma.auditLog.create({
    data: {
      userId: actor.id,
      action: "CREATE",
      entity: "AcademicYear",
      entityId: academicYear.id,
      description: `Membuat tahun ajaran ${academicYear.name}`,
    },
  });

  return academicYear;
}

export async function setActiveAcademicYear(id: string, actor: SessionUser) {
  const target = await prisma.academicYear.findUnique({ where: { id } });

  if (!target) {
    throw new AcademicYearServiceError("Tahun ajaran tidak ditemukan.");
  }

  if (target.status === "ACTIVE") {
    return target;
  }

  const previousActive = await prisma.academicYear.findFirst({
    where: { status: "ACTIVE" },
  });

  const [, updated] = await prisma.$transaction([
    prisma.academicYear.updateMany({
      where: { status: "ACTIVE" },
      data: { status: "INACTIVE" },
    }),
    prisma.academicYear.update({
      where: { id },
      data: { status: "ACTIVE" },
    }),
  ]);

  await prisma.auditLog.create({
    data: {
      userId: actor.id,
      action: "STATUS_CHANGE",
      entity: "AcademicYear",
      entityId: updated.id,
      description: previousActive
        ? `Mengaktifkan tahun ajaran ${updated.name} (sebelumnya ${previousActive.name})`
        : `Mengaktifkan tahun ajaran ${updated.name}`,
    },
  });

  return updated;
}