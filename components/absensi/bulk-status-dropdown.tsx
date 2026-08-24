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
import { Spinner } from "@/components/ui/spinner";

export function BulkStatusDropdown({
  studentIds,
  date,
  onDone,
}: {
  studentIds: string[];
  date: string; // "YYYY-MM-DD"
  onDone: (result: { successCount: number; failed: { studentId: string; reason: string }[] }) => void;
}) {
  const [isSaving, setIsSaving] = useState(false);

  const setStatus = async (status: string) => {
    setIsSaving(true);
    try {
      const res = await fetch("/api/absensi/status/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentIds, date, status }),
      });
      if (res.ok) {
        const data = await res.json();
        onDone(data);
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button size="sm" disabled={isSaving || studentIds.length === 0} />
        }
      >
        {isSaving && <Spinner />}
        {isSaving ? "Menyimpan..." : `Ubah Status (${studentIds.length})`}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {MANUAL_SETTABLE_STATUSES.map((s) => (
          <DropdownMenuItem key={s} onClick={() => setStatus(s)}>
            {STATUS_LABEL[s]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}