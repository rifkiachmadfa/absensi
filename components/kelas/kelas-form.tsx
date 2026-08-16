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
import {
  createClassAction,
  updateClassAction,
  type ClassFormState,
} from "@/app/(protected)/kelas/action";
import { Spinner } from "@/components/ui/spinner";

type Option = { id: string; name: string };

type KelasFormProps = {
  mode: "create" | "edit";
  classId?: string;
  academicYearOptions: (Option & { status: "ACTIVE" | "INACTIVE" })[];
  homeroomTeacherOptions: Option[];
  defaultValues?: {
    name: string;
    academicYearId: string;
    level: string | null;
    major: string | null;
    homeroomTeacherId: string | null;
  };
};

const initialState: ClassFormState = {};

export function KelasForm({
  mode,
  classId,
  academicYearOptions,
  homeroomTeacherOptions,
  defaultValues,
}: KelasFormProps) {
  const action =
    mode === "edit" && classId
      ? updateClassAction.bind(null, classId)
      : createClassAction;

  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="max-w-lg space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Nama Kelas *</Label>
        <Input
          id="name"
          name="name"
          placeholder="XI TKJ 1"
          defaultValue={defaultValues?.name}
          required
        />
        {state.fieldErrors?.name && (
          <p className="text-sm text-destructive">{state.fieldErrors.name[0]}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="academicYearId">Tahun Ajaran *</Label>
        <Select name="academicYearId" defaultValue={defaultValues?.academicYearId}>
          <SelectTrigger id="academicYearId" className="w-full">
            <SelectValue placeholder="Pilih tahun ajaran" />
          </SelectTrigger>
          <SelectContent>
            {academicYearOptions.map((year) => (
              <SelectItem key={year.id} value={year.id}>
                {year.name} {year.status === "ACTIVE" ? "(Aktif)" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {state.fieldErrors?.academicYearId && (
          <p className="text-sm text-destructive">
            {state.fieldErrors.academicYearId[0]}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="level">Tingkat</Label>
          <Input id="level" name="level" placeholder="XI" defaultValue={defaultValues?.level ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="major">Jurusan</Label>
          <Input id="major" name="major" placeholder="TKJ" defaultValue={defaultValues?.major ?? ""} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="homeroomTeacherId">Wali Kelas</Label>
        <Select name="homeroomTeacherId" defaultValue={defaultValues?.homeroomTeacherId ?? ""}>
          <SelectTrigger id="homeroomTeacherId" className="w-full">
            <SelectValue placeholder="Belum ditentukan" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Belum ditentukan</SelectItem>
            {homeroomTeacherOptions.map((teacher) => (
              <SelectItem key={teacher.id} value={teacher.id}>
                {teacher.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}

<Button type="submit" disabled={isPending}>
        {isPending && <Spinner />}
        {isPending ? "Menyimpan..." : mode === "edit" ? "Simpan Perubahan" : "Tambah Kelas"}
      </Button>
    </form>
  );
}