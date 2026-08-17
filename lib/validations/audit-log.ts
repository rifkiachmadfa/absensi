import { z } from "zod";

// Daftar action harus sinkron dengan enum AuditAction di prisma/schema.prisma.
export const AUDIT_ACTIONS = [
  "CREATE",
  "UPDATE",
  "DELETE",
  "LOGIN",
  "LOGOUT",
  "ATTENDANCE_SCAN",
  "ATTENDANCE_MANUAL",
  "STATUS_CHANGE",
] as const;

export const auditLogFilterSchema = z.object({
  userId: z.string().optional(),
  action: z.enum(AUDIT_ACTIONS).optional(),
  entity: z.string().trim().optional(),
  search: z.string().trim().optional(), // cari di description
  dateFrom: z.string().optional(), // YYYY-MM-DD
  dateTo: z.string().optional(), // YYYY-MM-DD
});

export type AuditLogFilterInput = z.infer<typeof auditLogFilterSchema>;