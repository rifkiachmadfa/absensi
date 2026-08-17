// app/(protected)/guru/page.tsx
import Link from "next/link";
import { requireRole } from "@/lib/auth/guard";
import { listGuru } from "@/lib/services/guru-service";
import { guruFilterSchema, ROLE_LABEL, ROLE_VALUES } from "@/lib/validations/guru";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

export default async function GuruPage({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string;
    role?: string;
    status?: string;
    page?: string;
  }>;
}) {
  await requireRole(["SUPERADMIN", "ADMIN"]);
  const rawParams = await searchParams;

  const filter = guruFilterSchema.parse({
    search: rawParams.search || undefined,
    role: ROLE_VALUES.includes(rawParams.role as (typeof ROLE_VALUES)[number])
      ? (rawParams.role as (typeof ROLE_VALUES)[number])
      : undefined,
    status:
      rawParams.status === "ACTIVE" || rawParams.status === "INACTIVE"
        ? rawParams.status
        : undefined,
  });
  const page = Number(rawParams.page) || 1;

  const { data: users, total, totalPages } = await listGuru(filter, page);

  const query = (overrides: Record<string, string | number | undefined>) => {
    const params = new URLSearchParams();
    const merged = { ...filter, page, ...overrides };
    if (merged.search) params.set("search", merged.search);
    if (merged.role) params.set("role", merged.role);
    if (merged.status) params.set("status", merged.status);
    if (merged.page && merged.page !== 1) params.set("page", String(merged.page));
    return `/guru?${params.toString()}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Guru &amp; Pengguna</h1>
          <p className="text-sm text-muted-foreground">{total} akun terdaftar.</p>
        </div>
        <Button render={<Link href="/guru/tambah" />}>+ Tambah Pengguna</Button>
      </div>

      <form className="flex flex-wrap items-end gap-3" method="get">
        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="search">
            Cari
          </label>
          <Input
            id="search"
            name="search"
            placeholder="Nama / Email..."
            defaultValue={filter.search}
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="role">
            Role
          </label>
          <Select name="role" defaultValue={filter.role ?? ""}>
            <SelectTrigger id="role" className="w-44">
              <SelectValue placeholder="Semua" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Semua</SelectItem>
              {ROLE_VALUES.map((role) => (
                <SelectItem key={role} value={role}>
                  {ROLE_LABEL[role]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="status">
            Status
          </label>
          <Select name="status" defaultValue={filter.status ?? ""}>
            <SelectTrigger id="status" className="w-36">
              <SelectValue placeholder="Semua" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Semua</SelectItem>
              <SelectItem value="ACTIVE">Aktif</SelectItem>
              <SelectItem value="INACTIVE">Nonaktif</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button type="submit" variant="outline">
          Terapkan Filter
        </Button>
      </form>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Wali Kelas Dari</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  Belum ada data pengguna.
                </TableCell>
              </TableRow>
            )}
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell>
                  <Link href={`/guru/${user.id}`} className="font-medium hover:underline">
                    {user.name}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">{user.email}</TableCell>
                <TableCell>
                  <Badge variant="outline">{ROLE_LABEL[user.role]}</Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {user.homeroomClasses.length > 0
                    ? user.homeroomClasses.map((k) => k.name).join(", ")
                    : "-"}
                </TableCell>
                <TableCell>
                  <Badge variant={user.isActive ? "default" : "outline"}>
                    {user.isActive ? "Aktif" : "Nonaktif"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="ghost" render={<Link href={`/guru/${user.id}`} />}>
                    Detail
                  </Button>
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