"use client";

import { useActionState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createAcademicYearAction,
  type AcademicYearFormState,
} from "@/app/tahun-ajaran/actions";

const initialState: AcademicYearFormState = {};

export function AcademicYearForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, isPending] = useActionState(
    createAcademicYearAction,
    initialState
  );

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
    }
  }, [state.success]);

  return (
    <form ref={formRef} action={formAction} className="space-y-3 rounded-lg border p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-2">
          <Label htmlFor="name">Tahun Ajaran Baru</Label>
          <Input id="name" name="name" placeholder="2026/2027" required />
        </div>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Menyimpan..." : "Tambah Tahun Ajaran"}
        </Button>
      </div>

      {state.fieldErrors?.name && (
        <p className="text-sm text-destructive">{state.fieldErrors.name[0]}</p>
      )}
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
    </form>
  );
}