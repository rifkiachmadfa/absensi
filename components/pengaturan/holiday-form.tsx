"use client";

import { useActionState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  createHolidayAction,
  type PengaturanFormState,
} from "@/app/(protected)/pengaturan/actions";

const initialState: PengaturanFormState = {};

export function HolidayForm() {
  const [state, formAction, isPending] = useActionState(
    createHolidayAction,
    initialState
  );
  const formRef = useRef<HTMLFormElement>(null);

  // Reset form setelah berhasil, supaya admin bisa langsung menambahkan
  // hari libur berikutnya tanpa perlu menghapus input manual.
  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
    }
  }, [state.success]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-end"
    >
      <div className="flex-1 space-y-1.5">
        <Label htmlFor="holiday-date">Tanggal</Label>
        <Input id="holiday-date" name="date" type="date" required />
        {state.fieldErrors?.date && (
          <p className="text-sm text-destructive">{state.fieldErrors.date[0]}</p>
        )}
      </div>

      <div className="flex-[2] space-y-1.5">
        <Label htmlFor="holiday-name">Keterangan</Label>
        <Input
          id="holiday-name"
          name="name"
          placeholder="mis. Libur Hari Kemerdekaan"
          required
        />
        {state.fieldErrors?.name && (
          <p className="text-sm text-destructive">{state.fieldErrors.name[0]}</p>
        )}
      </div>

      <Button type="submit" disabled={isPending}>
        {isPending && <Spinner />}
        Tambah Hari Libur
      </Button>

      {state.error && (
        <p className="col-span-full text-sm text-destructive">{state.error}</p>
      )}
    </form>
  );
}
