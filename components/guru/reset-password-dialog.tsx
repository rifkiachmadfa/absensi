"use client";

import { useActionState, useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import {
  resetGuruPasswordAction,
  type ResetPasswordState,
} from "@/app/(protected)/guru/action";

const initialState: ResetPasswordState = {};

export function ResetPasswordDialog({
  userId,
  userName,
}: {
  userId: string;
  userName: string;
}) {
  const [open, setOpen] = useState(false);
  const action = resetGuruPasswordAction.bind(null, userId);
  const [state, formAction, isPending] = useActionState(action, initialState);

  // Password berhasil direset -> tutup dialog otomatis setelah sesaat.
  useEffect(() => {
    if (state.success) {
      const timeout = setTimeout(() => setOpen(false), 1500);
      return () => clearTimeout(timeout);
    }
  }, [state.success]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
      }}
    >
      <DialogTrigger render={<Button variant="outline" />}>Reset Password</DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Reset Password</DialogTitle>
          <DialogDescription>
            Buat password baru untuk <span className="font-medium">{userName}</span>. Password
            lama tidak perlu dimasukkan — password baru ini langsung berlaku.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">Password Baru *</Label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="Minimal 8 karakter"
              minLength={8}
              required
              autoFocus
            />
            {state.fieldErrors?.password && (
              <p className="text-sm text-destructive">{state.fieldErrors.password[0]}</p>
            )}
          </div>

          {state.error && <p className="text-sm text-destructive">{state.error}</p>}
          {state.success && (
            <p className="text-sm text-green-700">Password berhasil direset.</p>
          )}

          <DialogFooter className="gap-2">
            <DialogClose render={<Button type="button" variant="ghost" />}>Tutup</DialogClose>
            <Button type="submit" disabled={isPending}>
              {isPending && <Spinner />}
              {isPending ? "Menyimpan..." : "Reset Password"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}