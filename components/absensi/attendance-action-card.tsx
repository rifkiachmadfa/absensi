"use client";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  ATTENDANCE_ACTION_STATUSES,
  ATTENDANCE_ACTION_BUTTON_CLASS,
  STATUS_LABEL,
} from "@/lib/constants/attendance";
import type { PendingStudent } from "@/lib/types/attendance";
import { cn } from "@/lib/utils";

export function AttendanceActionCard({
  student,
  isSubmitting,
  onConfirm,
  onCancel,
}: {
  student: PendingStudent;
  isSubmitting: boolean;
  onConfirm: (status: string) => void;
  onCancel: () => void;
}) {
  return (
    <div className="rounded-2xl border-2 border-primary/30 bg-primary/5 p-5">
      <p className="text-center text-xs font-medium tracking-wide text-muted-foreground uppercase">
        Siswa Terdeteksi
      </p>
      <p className="mt-1 text-center text-xl font-semibold text-foreground">{student.name}</p>
      <p className="text-center text-sm text-muted-foreground">
        NISN {student.nisn} · {student.className}
      </p>

      <div className="mt-4 border-t pt-4">
        <p className="text-center text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Pilih status kehadiran
        </p>
        <p className="mt-1 text-center text-xs text-muted-foreground">
          Saran sistem: <span className="font-medium">{STATUS_LABEL[student.suggestedStatus]}</span> — sesuaikan
          dengan kondisi sebenarnya.
        </p>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {ATTENDANCE_ACTION_STATUSES.map((status) => (
            <Button
              key={status}
              type="button"
              variant="outline"
              disabled={isSubmitting}
              onClick={() => onConfirm(status)}
              className={cn(
                "justify-center",
                ATTENDANCE_ACTION_BUTTON_CLASS[status],
                status === student.suggestedStatus && "ring-2 ring-primary ring-offset-1"
              )}
            >
              {isSubmitting ? <Spinner /> : STATUS_LABEL[status]}
            </Button>
          ))}
        </div>

        <Button
          type="button"
          variant="ghost"
          disabled={isSubmitting}
          onClick={onCancel}
          className="mt-3 w-full text-muted-foreground"
        >
          Batal, scan siswa lain
        </Button>
      </div>
    </div>
  );
}