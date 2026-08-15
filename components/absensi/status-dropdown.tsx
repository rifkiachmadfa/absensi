"use client";

import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { MANUAL_SETTABLE_STATUSES, STATUS_LABEL } from "@/lib/constants/attendance";

export function StatusDropdown({
  studentId,
  date,
  currentStatus,
  onChanged,
}: {
  studentId: string;
  date: string; // "YYYY-MM-DD"
  currentStatus: string;
  onChanged: () => void;
}) {
  const [isSaving, setIsSaving] = useState(false);

  const setStatus = async (status: string) => {
    setIsSaving(true);
    try {
      const res = await fetch("/api/absensi/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, date, status }),
      });
      if (res.ok) onChanged();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <DropdownMenu>
<DropdownMenuTrigger
  render={
    <Button variant="outline" size="sm" disabled={isSaving} />
  }
>
  Ubah Status
</DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {MANUAL_SETTABLE_STATUSES.filter((s) => s !== currentStatus).map((s) => (
          <DropdownMenuItem key={s} onClick={() => setStatus(s)}>
            {STATUS_LABEL[s]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}