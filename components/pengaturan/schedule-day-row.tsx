"use client";

import { useActionState, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  upsertAttendanceScheduleAction,
  type PengaturanFormState,
} from "@/app/(protected)/pengaturan/actions";

const initialState: PengaturanFormState = {};

type DaySchedule = {
  dayOfWeek: number;
  dayName: string;
  checkInStart: string | null;
  lateAfter: string | null;
  isActive: boolean;
};

export function ScheduleDayRow({
  schedule,
  defaultCheckInTime,
  defaultLateAfter,
}: {
  schedule: DaySchedule;
  defaultCheckInTime: string;
  defaultLateAfter: string;
}) {
  const [state, formAction, isPending] = useActionState(
    upsertAttendanceScheduleAction,
    initialState
  );
  // Nilai awal diambil dari prop; jika data server berubah (mis. setelah
  // revalidatePath), parent (page.tsx) memberi `key` baru pada komponen ini
  // agar ia remount dengan initial state yang segar -- bukan disinkronkan
  // lewat useEffect (menghindari cascading render).
  const [isActive, setIsActive] = useState(schedule.isActive);

  return (
    <form
      action={formAction}
      className="grid grid-cols-1 items-end gap-3 border-b p-4 last:border-b-0 sm:grid-cols-[100px_1fr_1fr_auto_auto] sm:gap-4"
    >
      <input type="hidden" name="dayOfWeek" value={schedule.dayOfWeek} />
      <input type="hidden" name="isActive" value={isActive ? "on" : "off"} />

      <div className="flex items-center gap-2 sm:block">
        <p className="text-sm font-medium">{schedule.dayName}</p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`checkInStart-${schedule.dayOfWeek}`} className="text-xs text-muted-foreground">
          Jam Mulai Absen
        </Label>
        <Input
          id={`checkInStart-${schedule.dayOfWeek}`}
          name="checkInStart"
          type="time"
          defaultValue={schedule.checkInStart ?? defaultCheckInTime}
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`lateAfter-${schedule.dayOfWeek}`} className="text-xs text-muted-foreground">
          Batas Terlambat
        </Label>
        <Input
          id={`lateAfter-${schedule.dayOfWeek}`}
          name="lateAfter"
          type="time"
          defaultValue={schedule.lateAfter ?? defaultLateAfter}
          required
        />
      </div>

      <div className="flex items-center gap-2">
        <Switch
          checked={isActive}
          onCheckedChange={setIsActive}
          aria-label={`Aktifkan jadwal khusus ${schedule.dayName}`}
        />
        <span className="text-xs text-muted-foreground">
          {isActive ? "Khusus" : "Default"}
        </span>
      </div>

      <Button type="submit" size="sm" variant="outline" disabled={isPending}>
        {isPending && <Spinner />}
        Simpan
      </Button>

      {(state.fieldErrors?.checkInStart || state.fieldErrors?.lateAfter || state.error) && (
        <p className="col-span-full text-sm text-destructive">
          {state.fieldErrors?.checkInStart?.[0] ??
            state.fieldErrors?.lateAfter?.[0] ??
            state.error}
        </p>
      )}
    </form>
  );
}