"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  updateDefaultScheduleAction,
  type PengaturanFormState,
} from "@/app/(protected)/pengaturan/actions";

const initialState: PengaturanFormState = {};

export function DefaultScheduleForm({
  defaultCheckInTime,
  lateAfter,
}: {
  defaultCheckInTime: string;
  lateAfter: string;
}) {
  const [state, formAction, isPending] = useActionState(
    updateDefaultScheduleAction,
    initialState
  );

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-end"
    >
      <div className="flex-1 space-y-1.5">
        <Label htmlFor="defaultCheckInTime">Jam Mulai Absen (Default)</Label>
        <Input
          id="defaultCheckInTime"
          name="defaultCheckInTime"
          type="time"
          defaultValue={defaultCheckInTime}
          required
        />
        {state.fieldErrors?.defaultCheckInTime && (
          <p className="text-sm text-destructive">
            {state.fieldErrors.defaultCheckInTime[0]}
          </p>
        )}
      </div>

      <div className="flex-1 space-y-1.5">
        <Label htmlFor="lateAfter">Batas Terlambat (Default)</Label>
        <Input
          id="lateAfter"
          name="lateAfter"
          type="time"
          defaultValue={lateAfter}
          required
        />
        {state.fieldErrors?.lateAfter && (
          <p className="text-sm text-destructive">
            {state.fieldErrors.lateAfter[0]}
          </p>
        )}
      </div>

      <Button type="submit" disabled={isPending}>
        {isPending && <Spinner />}
        Simpan Default
      </Button>

      {state.error && (
        <p className="col-span-full text-sm text-destructive">{state.error}</p>
      )}
      {state.success && (
        <p className="col-span-full text-sm text-success">Tersimpan.</p>
      )}
    </form>
  );
}