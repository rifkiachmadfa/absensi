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
import {
  createStudentAction,
  updateStudentAction,
  type StudentFormState,
} from "@/app/(protected)/siswa/action";

type ClassOption = { id: string; name: string; status: "ACTIVE" | "INACTIVE" };

type SiswaFormProps = {
  mode: "create" | "edit";
  studentId?: string;
  classOptions: ClassOption[];
  defaultValues?: {
    nis: string;
    nisn: string | null;
    name: string;
    classId: string;
  };
};

const initialState: StudentFormState = {};

export function SiswaForm({
  mode,
  studentId,
  classOptions,
  defaultValues,
}: SiswaFormProps) {
  const action =
    mode === "edit" && studentId
      ? updateStudentAction.bind(null, studentId)
      : createStudentAction;

  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="max-w-lg space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="nis">NIS *</Label>
          <Input
            id="nis"
            name="nis"
            placeholder="1023456789"
            defaultValue={defaultValues?.nis}
            required
          />
          {state.fieldErrors?.nis && (
            <p className="text-sm text-destructive">{state.fieldErrors.nis[0]}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="nisn">NISN</Label>
          <Input
            id="nisn"
            name="nisn"
            placeholder="0012345678"
            defaultValue={defaultValues?.nisn ?? ""}
          />
          {state.fieldErrors?.nisn && (
            <p className="text-sm text-destructive">{state.fieldErrors.nisn[0]}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="name">Nama Lengkap *</Label>
        <Input
          id="name"
          name="name"
          placeholder="Ahmad Fauzan"
          defaultValue={defaultValues?.name}
          required
        />
        {state.fieldErrors?.name && (
          <p className="text-sm text-destructive">{state.fieldErrors.name[0]}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="classId">Kelas *</Label>
        <Select name="classId" defaultValue={defaultValues?.classId}>
          <SelectTrigger id="classId" className="w-full">
            <SelectValue placeholder="Pilih kelas" />
          </SelectTrigger>
          <SelectContent>
            {classOptions.map((kelas) => (
              <SelectItem key={kelas.id} value={kelas.id}>
                {kelas.name} {kelas.status === "INACTIVE" ? "(Nonaktif)" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {state.fieldErrors?.classId && (
          <p className="text-sm text-destructive">{state.fieldErrors.classId[0]}</p>
        )}
      </div>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" disabled={isPending}>
        {isPending && <Spinner />}
        {isPending ? "Menyimpan..." : mode === "edit" ? "Simpan Perubahan" : "Tambah Siswa"}
      </Button>
    </form>
  );
}