"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { ROLE_LABEL, ROLE_VALUES } from "@/lib/validations/guru";
import {
  createGuruAction,
  updateGuruAction,
  type GuruFormState,
} from "@/app/(protected)/guru/action";

type GuruFormProps = {
  mode: "create" | "edit";
  userId?: string;
  defaultValues?: {
    name: string;
    email: string;
    role: (typeof ROLE_VALUES)[number];
  };
};

const initialState: GuruFormState = {};

export function GuruForm({ mode, userId, defaultValues }: GuruFormProps) {
  const action =
    mode === "edit" && userId ? updateGuruAction.bind(null, userId) : createGuruAction;

  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="max-w-lg space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Nama Lengkap *</Label>
        <Input
          id="name"
          name="name"
          placeholder="Budi Santoso"
          defaultValue={defaultValues?.name}
          required
        />
        {state.fieldErrors?.name && (
          <p className="text-sm text-destructive">{state.fieldErrors.name[0]}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email *</Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="budi@sekolah.sch.id"
          defaultValue={defaultValues?.email}
          required
        />
        {state.fieldErrors?.email && (
          <p className="text-sm text-destructive">{state.fieldErrors.email[0]}</p>
        )}
      </div>

      {mode === "create" && (
        <div className="space-y-2">
          <Label htmlFor="password">Password Awal *</Label>
          <Input
            id="password"
            name="password"
            type="password"
            placeholder="Minimal 8 karakter"
            minLength={8}
            required
          />
          <p className="text-xs text-muted-foreground">
            Akun langsung aktif dan bisa dipakai login begitu disimpan (tidak perlu verifikasi
            email).
          </p>
          {state.fieldErrors?.password && (
            <p className="text-sm text-destructive">{state.fieldErrors.password[0]}</p>
          )}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="role">Role *</Label>
        <Select name="role" defaultValue={defaultValues?.role ?? "GURU"}>
          <SelectTrigger id="role" className="w-full">
            <SelectValue placeholder="Pilih role" />
          </SelectTrigger>
          <SelectContent>
            {ROLE_VALUES.map((role) => (
              <SelectItem key={role} value={role}>
                {ROLE_LABEL[role]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {state.fieldErrors?.role && (
          <p className="text-sm text-destructive">{state.fieldErrors.role[0]}</p>
        )}
      </div>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" disabled={isPending}>
        {isPending && <Spinner />}
        {isPending ? "Menyimpan..." : mode === "edit" ? "Simpan Perubahan" : "Tambah Pengguna"}
      </Button>
    </form>
  );
}