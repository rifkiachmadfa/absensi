"use client";
import Link from "next/link";
import { ScanBarcode } from "lucide-react";
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
import { Spinner } from "@/components/ui/spinner";
import { STATUS_LABEL, STATUS_BADGE_CLASS } from "@/lib/constants/attendance";
import type { AttendanceTableRow, ClassOption } from "@/lib/types/attendance";
import { ScanDialogPulang } from "@/components/absensi/scan-dialog-pulang";
// Nilai filter semu (bukan status di database) untuk "Belum Absen Pulang" --
// digabung ke dropdown Status yang sama karena secara UX ini tetap terasa
// sebagai satu filter "Status" bagi guru/admin, walau secara data ini
// turunan dari checkInAt/checkOutAt, bukan kolom status Attendance.
const BELUM_PULANG_VALUE = "BELUM_PULANG";

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
  // isLoading: hanya true untuk load PERTAMA (belum pernah ada data sama
  // sekali) -- ini satu-satunya kondisi yang menampilkan skeleton penuh.
  const [isLoading, setIsLoading] = useState(true);
  // isFetching: refetch di belakang layar (ganti tanggal/kelas/status
  // filter). Baris lama tetap tampil (stale-while-revalidate) supaya tabel
  // tidak "reload"/flicker -- hanya indikator kecil yang muncul.
  const [isFetching, setIsFetching] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch("/api/kelas")
      .then((r) => r.json())
      .then((d) => setClasses(d.classes ?? []))
      .catch(() => setClasses([]));
  }, []);

  const loadTable = useCallback(
    async (signal?: AbortSignal) => {
      setIsFetching(true);
      try {
        const params = new URLSearchParams({ date });
        if (classId !== "all") params.set("classId", classId);
        // BELUM_PULANG bukan status Attendance yang dikenal server -- jangan
        // dikirim sebagai filter status, biarkan server kirim semua status
        // lalu difilter di client (lihat filteredRows).
        if (statusFilter !== "all" && statusFilter !== BELUM_PULANG_VALUE) {
          params.set("status", statusFilter);
        }
        const res = await fetch(`/api/absensi/table?${params.toString()}`, { signal });
        const data = await res.json();
        if (!signal?.aborted) {
          setRows(data.rows ?? []);
          setIsLoading(false);
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          console.error("Load attendance table error:", err);
        }
      } finally {
        if (!signal?.aborted) setIsFetching(false);
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

  // Refresh baris tertentu saja (setelah ubah status satu/beberapa siswa)
  // tanpa query ulang seluruh tabel dan tanpa memicu skeleton -- baris lain
  // tidak ikut ter-refetch/flicker. Baris yang setelah diubah tidak lagi
  // cocok dengan filter status yang aktif akan hilang dari tampilan, sama
  // seperti kalau tabel di-reload penuh.
  const refreshRows = useCallback(
    async (studentIds: string[]) => {
      if (studentIds.length === 0) return;
      try {
        const params = new URLSearchParams({ date, studentIds: studentIds.join(",") });
        if (classId !== "all") params.set("classId", classId);
        if (statusFilter !== "all" && statusFilter !== BELUM_PULANG_VALUE) {
          params.set("status", statusFilter);
        }
        const res = await fetch(`/api/absensi/table?${params.toString()}`);
        if (!res.ok) return;
        const data = await res.json();
        const updated = new Map<string, AttendanceTableRow>(
          (data.rows ?? []).map((r: AttendanceTableRow) => [r.studentId, r])
        );
        setRows((prev) => {
          const next = prev
            .map((r) => (updated.has(r.studentId) ? updated.get(r.studentId)! : r))
            .filter((r) => !studentIds.includes(r.studentId) || updated.has(r.studentId));
          // Baris baru yang belum ada di tabel saat ini (mis. hasil filter
          // classId/status berubah antara request) turut disisipkan.
          for (const id of studentIds) {
            if (updated.has(id) && !next.some((r) => r.studentId === id)) {
              next.push(updated.get(id)!);
            }
          }
          return next;
        });
      } catch (err) {
        console.error("Refresh attendance row error:", err);
      }
    },
    [date, classId, statusFilter]
  );

  // Reset seleksi checkbox setiap kali filter berubah, supaya tidak ada
  // studentId "terpilih" yang sudah tidak tampak di tabel (mis. pindah
  // tanggal/kelas/status filter).
  useEffect(() => {
    setSelectedIds(new Set());
  }, [date, classId, statusFilter]);

  const filteredRows = rows
    .filter((r) =>
      statusFilter === BELUM_PULANG_VALUE
        ? r.checkInAt !== null && r.checkOutAt === null
        : true
    )
    .filter((r) =>
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
    const affectedIds = Array.from(selectedIds);
    setSelectedIds(new Set());
    refreshRows(affectedIds);
  };

  const colSpan = canEditStatus ? 8 : 6;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-foreground">
          Absensi Siswa
          {isFetching && !isLoading && (
            <Spinner className="text-muted-foreground" aria-label="Memperbarui data" />
          )}
        </h1>
<div className="flex flex-wrap gap-2">
  <Button variant="outline" size="lg" render={<Link href="/absensi/scanner-fisik" />}>
    <ScanBarcode className="size-4" />
    Scanner Fisik
  </Button>
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
            <SelectItem value={BELUM_PULANG_VALUE}>Belum Absen Pulang</SelectItem>
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
              <th className="p-3 text-left">Jam Pulang</th>
              <th className="p-3 text-left">Status</th>
              {canEditStatus && <th className="p-3 text-left">Aksi</th>}
            </tr>
          </thead>
          <tbody
            className={
              isFetching && !isLoading ? "opacity-60 transition-opacity" : "transition-opacity"
            }
          >
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
                    {row.checkOutAt
                      ? new Intl.DateTimeFormat("id-ID", {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                          timeZone: "Asia/Jakarta",
                        }).format(new Date(row.checkOutAt))
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
                        onChanged={() => refreshRows([row.studentId])}
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