"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScanDialog } from "@/components/absensi/scan-dialog";
import { StatusDropdown } from "@/components/absensi/status-dropdown";
import { BulkStatusDropdown } from "@/components/absensi/bulk-status-dropdown";
import { STATUS_LABEL, STATUS_BADGE_CLASS } from "@/lib/constants/attendance";
import type { AttendanceTableRow, ClassOption } from "@/lib/types/attendance";
import { ScanDialogPulang } from "@/components/absensi/scan-dialog-pulang";
function todayJakarta() {
  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" });
  return formatter.format(new Date());
}

export function AbsensiClient({ canEditStatus }: { canEditStatus: boolean }) {
  const [date, setDate] = useState(todayJakarta());
  const [classId, setClassId] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [rows, setRows] = useState<AttendanceTableRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch("/api/kelas")
      .then((r) => r.json())
      .then((d) => setClasses(d.classes ?? []))
      .catch(() => setClasses([]));
  }, []);

  const loadTable = useCallback(
    async (signal?: AbortSignal) => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams({ date });
        if (classId !== "all") params.set("classId", classId);
        if (statusFilter !== "all") params.set("status", statusFilter);
        const res = await fetch(`/api/absensi/table?${params.toString()}`, { signal });
        const data = await res.json();
        if (!signal?.aborted) setRows(data.rows ?? []);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          console.error("Load attendance table error:", err);
        }
      } finally {
        if (!signal?.aborted) setIsLoading(false);
      }
    },
    [date, classId, statusFilter]
  );

  useEffect(() => {
    const controller = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-with-cleanup pattern (React docs), setState di dalam loadTable sudah di-guard oleh AbortController
    loadTable(controller.signal);
    return () => controller.abort();
  }, [loadTable]);

  // Reset seleksi checkbox setiap kali filter berubah, supaya tidak ada
  // studentId "terpilih" yang sudah tidak tampak di tabel (mis. pindah
  // tanggal/kelas/status filter).
  useEffect(() => {
    setSelectedIds(new Set());
  }, [date, classId, statusFilter]);

  const filteredRows = rows.filter((r) =>
    search.trim().length === 0
      ? true
      : r.name.toLowerCase().includes(search.toLowerCase()) || r.nisn.includes(search)
  );

  const selectedCount = selectedIds.size;
  const visibleIds = useMemo(() => filteredRows.map((r) => r.studentId), [filteredRows]);
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
  const someVisibleSelected = visibleIds.some((id) => selectedIds.has(id));

  const toggleRow = (studentId: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(studentId);
      else next.delete(studentId);
      return next;
    });
  };

  const toggleAllVisible = (checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        visibleIds.forEach((id) => next.add(id));
      } else {
        visibleIds.forEach((id) => next.delete(id));
      }
      return next;
    });
  };

  const handleBulkDone = (result: {
    successCount: number;
    failed: { studentId: string; reason: string }[];
  }) => {
    if (result.successCount > 0) {
      toast.success(`Status ${result.successCount} siswa berhasil diubah.`);
    }
    if (result.failed.length > 0) {
      toast.error(`${result.failed.length} siswa gagal diubah statusnya.`);
    }
    setSelectedIds(new Set());
    loadTable();
  };

  const colSpan = canEditStatus ? 7 : 5;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold text-foreground">Absensi Siswa</h1>
        <div className="flex gap-2">
          <ScanDialogPulang onSuccess={loadTable} />
          <ScanDialog onSuccess={loadTable} />
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />

        <Select value={classId} onValueChange={(value) => setClassId(value ?? "all")}>
          <SelectTrigger>
            <SelectValue placeholder="Semua Kelas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Kelas</SelectItem>
            {classes.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value ?? "all")}>
          <SelectTrigger>
            <SelectValue placeholder="Semua Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Status</SelectItem>
            {Object.entries(STATUS_LABEL).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          placeholder="Cari nama / NISN..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {canEditStatus && selectedCount > 0 && (
        <div className="mb-3 flex items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
          <span className="text-sm font-medium text-foreground">
            {selectedCount} siswa dipilih
          </span>
          <div className="flex items-center gap-2">
            <BulkStatusDropdown
              studentIds={Array.from(selectedIds)}
              date={date}
              onDone={handleBulkDone}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedIds(new Set())}
            >
              Batal
            </Button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              {canEditStatus && (
                <th className="w-12 p-3">
                  <div className="flex items-center justify-center">
                    <Checkbox
                      checked={allVisibleSelected}
                      indeterminate={!allVisibleSelected && someVisibleSelected}
                      onCheckedChange={(checked) => toggleAllVisible(checked === true)}
                      disabled={visibleIds.length === 0}
                      aria-label="Pilih semua"
                    />
                  </div>
                </th>
              )}
              <th className="p-3 text-left">Nama</th>
              <th className="p-3 text-left">NISN</th>
              <th className="p-3 text-left">Kelas</th>
              <th className="p-3 text-left">Jam Masuk</th>
              <th className="p-3 text-left">Status</th>
              {canEditStatus && <th className="p-3 text-left">Aksi</th>}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="border-t">
                  {Array.from({ length: colSpan }).map((_, c) => (
                    <td key={c} className="p-3">
                      <Skeleton className="h-4 w-full max-w-24" />
                    </td>
                  ))}
                </tr>
              ))
            ) : filteredRows.length === 0 ? (
              <tr>
                <td colSpan={colSpan} className="p-6 text-center text-muted-foreground">
                  Tidak ada data untuk filter ini.
                </td>
              </tr>
            ) : (
              filteredRows.map((row) => (
                <tr
                  key={row.studentId}
                  className={
                    "border-t" + (selectedIds.has(row.studentId) ? " bg-primary/5" : "")
                  }
                >
                  {canEditStatus && (
                    <td className="w-12 p-3">
                      <div className="flex items-center justify-center">
                        <Checkbox
                          checked={selectedIds.has(row.studentId)}
                          onCheckedChange={(checked) =>
                            toggleRow(row.studentId, checked === true)
                          }
                          aria-label={`Pilih ${row.name}`}
                        />
                      </div>
                    </td>
                  )}
                  <td className="p-3 font-medium">{row.name}</td>
                  <td className="p-3">{row.nisn}</td>
                  <td className="p-3">{row.className}</td>
                  <td className="p-3">
                    {row.checkInAt
                      ? new Intl.DateTimeFormat("id-ID", {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                          timeZone: "Asia/Jakarta",
                        }).format(new Date(row.checkInAt))
                      : "-"}
                  </td>
                  <td className="p-3">
                    <Badge className={STATUS_BADGE_CLASS[row.status]}>
                      {STATUS_LABEL[row.status]}
                    </Badge>
                  </td>
                  {canEditStatus && (
                    <td className="p-3">
                      <StatusDropdown
                        studentId={row.studentId}
                        date={date}
                        currentStatus={row.status}
                        onChanged={loadTable}
                      />
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}