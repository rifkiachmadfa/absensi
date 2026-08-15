import { prisma } from "@/lib/prisma";
import {
  Prisma,
  AttendanceStatus,
  AttendanceMethod,
  StudentStatus,
  AuditAction,
} from "@/app/generated/prisma/client";

export type CheckInResult =
  | { type: "SUCCESS"; student: StudentSummary; time: string; status: AttendanceStatus }
  | { type: "ALREADY_CHECKED_IN"; student: StudentSummary; time: string; status: AttendanceStatus }
  | { type: "STUDENT_NOT_FOUND" }
  | { type: "STUDENT_INACTIVE"; student: StudentSummary };

type StudentSummary = {
  id: string;
  name: string;
  nisn: string;
  className: string;
};

const TIMEZONE = "Asia/Jakarta";

function getJakartaNow() {
  const now = new Date();
  const local = new Date(now.toLocaleString("en-US", { timeZone: TIMEZONE }));
  const hhmm = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(now);
  return { serverTime: now, dayOfWeek: local.getDay(), hhmm };
}

function getTodayDateOnly() {
  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE });
  return new Date(`${formatter.format(new Date())}T00:00:00.000Z`);
}

async function resolveStatus(dayOfWeek: number, hhmm: string): Promise<AttendanceStatus> {
  const daySchedule = await prisma.attendanceSchedule.findFirst({
    where: { dayOfWeek, isActive: true },
  });

  if (daySchedule) {
    return hhmm <= daySchedule.lateAfter ? AttendanceStatus.HADIR : AttendanceStatus.TERLAMBAT;
  }

  const setting = await prisma.schoolSetting.findFirst();
  const lateAfter = setting?.lateAfter ?? "07:15";
  return hhmm <= lateAfter ? AttendanceStatus.HADIR : AttendanceStatus.TERLAMBAT;
}

function toSummary(student: { id: string; name: string; nisn: string | null; class: { name: string } }): StudentSummary {
  return {
    id: student.id,
    name: student.name,
    nisn: student.nisn ?? "-",
    className: student.class.name,
  };
}

export class AttendanceService {
  static async checkIn(params: {
    identifier: string; // qrToken (QR) atau studentId (MANUAL)
    method: AttendanceMethod;
    recordedById: string;
  }): Promise<CheckInResult> {
    const { identifier, method, recordedById } = params;

    const student = await prisma.student.findFirst({
      where: method === AttendanceMethod.QR ? { qrToken: identifier } : { id: identifier },
      include: { class: true },
    });

    if (!student) return { type: "STUDENT_NOT_FOUND" };
    if (student.status !== StudentStatus.ACTIVE) {
      return { type: "STUDENT_INACTIVE", student: toSummary(student) };
    }

    const date = getTodayDateOnly();
    const { serverTime, dayOfWeek, hhmm } = getJakartaNow();
    const status = await resolveStatus(dayOfWeek, hhmm);

    try {
      const attendance = await prisma.$transaction(async (tx) => {
        const created = await tx.attendance.create({
          data: {
            studentId: student.id,
            date,
            checkInAt: serverTime,
            status,
            method,
            recordedById,
          },
        });

        await tx.auditLog.create({
          data: {
            userId: recordedById,
            action: method === AttendanceMethod.QR ? AuditAction.ATTENDANCE_SCAN : AuditAction.ATTENDANCE_MANUAL,
            entity: "Attendance",
            entityId: created.id,
            description: `Absen ${student.name} (${student.class.name}) - ${status}`,
          },
        });

        return created;
      });

      return {
        type: "SUCCESS",
        student: toSummary(student),
        time: attendance.checkInAt.toISOString(),
        status: attendance.status,
      };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        const existing = await prisma.attendance.findUnique({
          where: { studentId_date: { studentId: student.id, date } },
        });
        return {
          type: "ALREADY_CHECKED_IN",
          student: toSummary(student),
          time: existing?.checkInAt.toISOString() ?? "",
          status: existing?.status ?? status,
        };
      }
      throw err;
    }
  }

  static async searchStudents(query: string) {
    return prisma.student.findMany({
      where: {
        status: StudentStatus.ACTIVE,
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { nis: { contains: query } },
          { nisn: { contains: query } },
        ],
      },
      include: { class: true },
      take: 10,
    });
  }
}