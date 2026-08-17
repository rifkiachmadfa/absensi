import Link from "next/link";
import { requireRole } from "@/lib/auth/guard";
import {
  listAuditLogs,
  getAuditLogUserOptions,
  getAuditLogEntityOptions,
} from "@/lib/services/audit-log-service";
import { auditLogFilterSchema, AUDIT_ACTIONS } from "@/lib/validations/audit-log";
import { ACTION_LABEL, ACTION_BADGE_CLASS, ENTITY_LABEL } from "@/lib/constants/audit-log";
import { Badge } from "@/components/ui/badge";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function LogAktivitasPage({
  searchParams,
}: {
  searchParams: Promise<{
    userId?: string;
    action?: string;
    entity?: string;
    search?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: string;
  }>;
}) {
  // Audit log hanya boleh dilihat SUPERADMIN (Section 4.1) -- Admin, Guru,
  // dan Wali Kelas TIDAK memiliki akses lihat log aktivitas (Section 4.2-4.4
  // tidak mencantumkan kemampuan ini untuk role selain SUPERADMIN).
  await requireRole(["SUPERADMIN"]);
  const rawParams = await searchParams;

  const validAction = AUDIT_ACTIONS.includes(rawParams.action as (typeof AUDIT_ACTIONS)[number])
    ? (rawParams.action as (typeof AUDIT_ACTIONS)[number])
    : undefined;

  const filter = auditLogFilterSchema.parse({
    userId: rawParams.userId || undefined,
    action: validAction,
    entity: rawParams.entity || undefined,
    search: rawParams.search || undefined,
    dateFrom: rawParams.dateFrom || undefined,
    dateTo: rawParams.dateTo || undefined,
  });
  const page = Number(rawParams.page) || 1;

  const [{ data: logs, total, totalPages }, userOptions, entityOptions] = await Promise.all([
    listAuditLogs(filter, page),
    getAuditLogUserOptions(),
    getAuditLogEntityOptions(),
  ]);

  const query = (overrides: Record<string, string | number | undefined>) => {
    const params = new URLSearchParams();
    const merged = { ...filter, page, ...overrides };
    if (merged.userId) params.set("userId", merged.userId);
    if (merged.action) params.set("action", merged.action);
    if (merged.entity) params.set("entity", merged.entity);
    if (merged.search) params.set("search", merged.search);
    if (merged.dateFrom) params.set("dateFrom", merged.dateFrom);
    if (merged.dateTo) params.set("dateTo", merged.dateTo);
    if (merged.page && merged.page !== 1) params.set("page", String(merged.page));
    return `/log-aktivitas?${params.toString()}`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Log Aktivitas</h1>
        <p className="text-sm text-muted-foreground">
          {total} aktivitas tercatat. Log aktivitas tidak dapat dihapus atau diubah.
        </p>
      </div>

      <form className="flex flex-wrap items-end gap-3 rounded-lg border p-4" method="get">
        <div className="space-y-1">
          <Label htmlFor="search">Cari</Label>
          <Input
            id="search"
            name="search"
            placeholder="Cari deskripsi..."
            defaultValue={filter.search}
            className="w-56"
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="userId">Pengguna</Label>
          <Select name="userId" defaultValue={filter.userId ?? ""}>
            <SelectTrigger id="userId" className="w-44">
              <SelectValue placeholder="Semua Pengguna" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Semua Pengguna</SelectItem>
              {userOptions.map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {user.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label htmlFor="action">Aksi</Label>
          <Select name="action" defaultValue={filter.action ?? ""}>
            <SelectTrigger id="action" className="w-44">
              <SelectValue placeholder="Semua Aksi" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Semua Aksi</SelectItem>
              {AUDIT_ACTIONS.map((action) => (
                <SelectItem key={action} value={action}>
                  {ACTION_LABEL[action]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label htmlFor="entity">Entitas</Label>
          <Select name="entity" defaultValue={filter.entity ?? ""}>
            <SelectTrigger id="entity" className="w-40">
              <SelectValue placeholder="Semua Entitas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Semua Entitas</SelectItem>
              {entityOptions.map((entity) => (
                <SelectItem key={entity} value={entity}>
                  {ENTITY_LABEL[entity] ?? entity}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label htmlFor="dateFrom">Dari Tanggal</Label>
          <Input id="dateFrom" type="date" name="dateFrom" defaultValue={filter.dateFrom} />
        </div>

        <div className="space-y-1">
          <Label htmlFor="dateTo">Sampai Tanggal</Label>
          <Input id="dateTo" type="date" name="dateTo" defaultValue={filter.dateTo} />
        </div>

        <Button type="submit" variant="outline">
          Terapkan Filter
        </Button>
        {(filter.userId ||
          filter.action ||
          filter.entity ||
          filter.search ||
          filter.dateFrom ||
          filter.dateTo) && (
          <Button type="button" variant="ghost" render={<Link href="/log-aktivitas" />}>
            Reset
          </Button>
        )}
      </form>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-44">Waktu</TableHead>
              <TableHead>Pengguna</TableHead>
              <TableHead>Aksi</TableHead>
              <TableHead>Entitas</TableHead>
              <TableHead>Deskripsi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  Tidak ada aktivitas yang cocok dengan filter.
                </TableCell>
              </TableRow>
            )}
            {logs.map((log) => (
              <TableRow key={log.id}>
                <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                  {new Intl.DateTimeFormat("id-ID", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                    timeZone: "Asia/Jakarta",
                  }).format(log.createdAt)}
                </TableCell>
                <TableCell>
                  {log.user ? (
                    <div>
                      <p className="font-medium text-foreground">{log.user.name}</p>
                      <p className="text-xs text-muted-foreground">{log.user.role}</p>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">Sistem</span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge className={ACTION_BADGE_CLASS[log.action] ?? ""}>
                    {ACTION_LABEL[log.action] ?? log.action}
                  </Badge>
                </TableCell>
                <TableCell>{ENTITY_LABEL[log.entity] ?? log.entity}</TableCell>
                <TableCell className="max-w-md text-sm">
                  {log.description ?? <span className="text-muted-foreground">-</span>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            disabled={page <= 1}
            render={<Link href={query({ page: page - 1 })} />}
          >
            Sebelumnya
          </Button>
          <span className="text-sm text-muted-foreground">
            Halaman {page} dari {totalPages}
          </span>
          <Button
            variant="outline"
            disabled={page >= totalPages}
            render={<Link href={query({ page: page + 1 })} />}
          >
            Berikutnya
          </Button>
        </div>
      )}
    </div>
  );
}