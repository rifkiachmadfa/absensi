// lib/services/audit-log-service.ts
import "server-only";
import { prisma } from "@/lib/prisma";
import type { AuditLogFilterInput } from "@/lib/validations/audit-log";

const PAGE_SIZE = 25;

// ============================================================
// Audit log tidak boleh dihapus/diubah lewat UI biasa (Section 20) --
// service ini HANYA menyediakan operasi baca. Penulisan audit log
// dilakukan langsung oleh masing-masing service (siswa, kelas,
// tahun-ajaran, attendance) di titik terjadinya aksi, bukan di sini.
// ============================================================

export async function listAuditLogs(filter: AuditLogFilterInput, page = 1) {
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;

  const dateFrom = filter.dateFrom ? new Date(`${filter.dateFrom}T00:00:00.000Z`) : undefined;
  const dateTo = filter.dateTo ? new Date(`${filter.dateTo}T23:59:59.999Z`) : undefined;

  const where = {
    userId: filter.userId || undefined,
    action: filter.action || undefined,
    entity: filter.entity || undefined,
    description: filter.search
      ? { contains: filter.search, mode: "insensitive" as const }
      : undefined,
    createdAt:
      dateFrom || dateTo
        ? {
            ...(dateFrom ? { gte: dateFrom } : {}),
            ...(dateTo ? { lte: dateTo } : {}),
          }
        : undefined,
  };

  const [data, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, role: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (safePage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    data,
    total,
    page: safePage,
    pageSize: PAGE_SIZE,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

// Dipakai untuk dropdown filter "Pengguna" -- hanya user yang PERNAH
// tercatat di audit log (bukan seluruh user aktif) agar tidak
// menampilkan opsi yang pasti kosong hasilnya.
export async function getAuditLogUserOptions() {
  const logs = await prisma.auditLog.findMany({
    where: { userId: { not: null } },
    distinct: ["userId"],
    select: { user: { select: { id: true, name: true, role: true } } },
    orderBy: { createdAt: "desc" },
  });

  return logs
    .map((log) => log.user)
    .filter((user): user is NonNullable<typeof user> => user !== null)
    .sort((a, b) => a.name.localeCompare(b.name));
}

// Dipakai untuk dropdown filter "Entitas" -- daftar entity yang benar-benar
// pernah tercatat, bukan daftar statis, supaya otomatis ikut bertambah
// kalau ada modul baru yang menulis audit log.
export async function getAuditLogEntityOptions() {
  const logs = await prisma.auditLog.findMany({
    distinct: ["entity"],
    select: { entity: true },
    orderBy: { entity: "asc" },
  });
  return logs.map((log) => log.entity);
}