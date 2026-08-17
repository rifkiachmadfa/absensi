import Link from "next/link";
import { requireRole } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import {
  getClassOptions,
  getStudentById,
  getStudentsForCardPrint,
  listStudents,
} from "@/lib/services/siswa-service";
import { generateQrDataUrl, generateQrDataUrlBatch } from "@/lib/qr";
import { type StudentIdCardData } from "@/components/kartu-siswa/student-id-card";
import { CardWithPreview } from "@/components/kartu-siswa/card-with-preview";
import { DownloadPdfButton } from "@/components/kartu-siswa/download-pdf-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// SESUDAH
async function getSchoolName() {
  const setting = await prisma.schoolSetting.findFirst({
    select: { schoolName: true },
  });
  return setting?.schoolName?.trim() || "SMK Yadika Sumedang";
}

export default async function KartuSiswaPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    studentId?: string;
    classId?: string;
    all?: string;
  }>;
}) {
  await requireRole(["SUPERADMIN", "ADMIN", "WALI_KELAS"]);
  const { q, studentId, classId, all } = await searchParams;

  const [classOptions, schoolName] = await Promise.all([
    getClassOptions(),
    getSchoolName(),
  ]);

  const search = q?.trim() || undefined;
  const showAll = all === "1";

  // Hasil pencarian cepat (untuk memilih satu murid), hanya ditampilkan
  // ketika belum ada pilihan cetak lain yang aktif.
  const searchResults =
    search && !studentId && !classId && !showAll
      ? (await listStudents({ search, classId: undefined, status: "ACTIVE" }, 1)).data
      : [];

  let cards: StudentIdCardData[] = [];
  let printTitle = "";
  let fileName = "kartu-murid.pdf";

  if (studentId) {
    const siswa = await getStudentById(studentId);
    if (siswa) {
      const qrCodeDataUrl = await generateQrDataUrl(siswa.qrToken);
      cards = [
        {
          id: siswa.id,
          name: siswa.name,
          nis: siswa.nis,
          nisn: siswa.nisn,
          className: siswa.class.name,
          major: siswa.class.major,
          qrCodeDataUrl,
        },
      ];
      printTitle = `Kartu Murid — ${siswa.name}`;
      fileName = `kartu-murid-${siswa.nis}.pdf`;
    }
  } else if (classId) {
    const students = await getStudentsForCardPrint({ classId });
    const qrMap = await generateQrDataUrlBatch(students.map((s) => s.qrToken));
    cards = students.map((s) => ({
      id: s.id,
      name: s.name,
      nis: s.nis,
      nisn: s.nisn,
      className: s.class.name,
      major: s.class.major,
      qrCodeDataUrl: qrMap.get(s.qrToken) ?? "",
    }));
    printTitle = `Kartu Murid — ${
      classOptions.find((c) => c.id === classId)?.name ?? "Kelas"
    }`;
    fileName = `kartu-murid-${
      (classOptions.find((c) => c.id === classId)?.name ?? "kelas")
        .replace(/\s+/g, "-")
        .toLowerCase()
    }.pdf`;
  } else if (showAll) {
    const students = await getStudentsForCardPrint({});
    const qrMap = await generateQrDataUrlBatch(students.map((s) => s.qrToken));
    cards = students.map((s) => ({
      id: s.id,
      name: s.name,
      nis: s.nis,
      nisn: s.nisn,
      className: s.class.name,
      major: s.class.major,
      qrCodeDataUrl: qrMap.get(s.qrToken) ?? "",
    }));
    printTitle = "Kartu Murid — Seluruh Murid Aktif";
    fileName = "kartu-murid-seluruh-murid.pdf";
  }

  const query = (overrides: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const merged = { q, studentId, classId, all, ...overrides };
    if (merged.q) params.set("q", merged.q);
    if (merged.studentId) params.set("studentId", merged.studentId);
    if (merged.classId) params.set("classId", merged.classId);
    if (merged.all) params.set("all", merged.all);
    return `/kartu-siswa?${params.toString()}`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Kartu Murid</h1>
        <p className="text-sm text-muted-foreground">
          Cari satu murid, atau cetak kartu untuk satu kelas / seluruh murid
          aktif sekaligus.
        </p>
      </div>

      {classOptions.length === 0 && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Belum ada Kelas. Buat kelas dan murid terlebih dahulu sebelum
          mencetak kartu.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <form className="space-y-2 rounded-lg border p-4" method="get">
          <label className="text-sm font-medium" htmlFor="q">
            Cari &amp; cetak satu murid
          </label>
          <div className="flex gap-2">
            <Input
              id="q"
              name="q"
              placeholder="Nama / NIS / NISN..."
              defaultValue={search}
            />
            <Button type="submit" variant="outline">
              Cari
            </Button>
          </div>
        </form>

        <form className="space-y-2 rounded-lg border p-4" method="get">
          <label className="text-sm font-medium" htmlFor="classId">
            Cetak satu kelas
          </label>
          <div className="flex gap-2">
            <Select name="classId" defaultValue={classId ?? ""}>
              <SelectTrigger id="classId" className="flex-1">
                <SelectValue placeholder="Pilih kelas..." />
              </SelectTrigger>
              <SelectContent>
                {classOptions.map((kelas) => (
                  <SelectItem key={kelas.id} value={kelas.id}>
                    {kelas.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="submit" variant="outline">
              Tampilkan
            </Button>
          </div>
        </form>
      </div>

      <div>
        <Button
          render={
            <Link
              href={query({
                all: "1",
                q: undefined,
                classId: undefined,
                studentId: undefined,
              })}
            />
          }
        >
          Cetak Seluruh Murid Aktif
        </Button>
      </div>

      {searchResults.length > 0 && (
        <div className="rounded-lg border">
          <p className="border-b px-3 py-2 text-sm font-medium">
            Hasil pencarian, pilih salah satu:
          </p>
          <ul className="divide-y">
            {searchResults.map((siswa) => (
              <li
                key={siswa.id}
                className="flex items-center justify-between px-3 py-2"
              >
                <div className="text-sm">
                  <span className="font-medium">{siswa.name}</span>{" "}
                  <span className="text-muted-foreground">
                    • NIS {siswa.nis} • {siswa.class.name}
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  render={
                    <Link href={query({ studentId: siswa.id, q: undefined })} />
                  }
                >
                  Pilih
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {search && !studentId && !classId && !showAll && searchResults.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Tidak ada murid aktif yang cocok dengan pencarian &quot;{search}
          &quot;.
        </p>
      )}

      {(studentId || classId || showAll) && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/30 p-3">
          <div className="text-sm">
            <p className="font-medium">{printTitle}</p>
            <p className="text-muted-foreground">
              {cards.length} kartu siap diunduh.
            </p>
          </div>
          <div className="flex gap-2">
            <DownloadPdfButton
              cards={cards}
              schoolName={schoolName}
              fileName={fileName}
            />
            <Button variant="outline" render={<Link href="/kartu-siswa" />}>
              Ganti Pilihan
            </Button>
          </div>
        </div>
      )}

      {(studentId || classId) && cards.length === 0 && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          Murid tidak ditemukan atau tidak ada murid aktif pada kelas ini.
        </div>
      )}

      {cards.length > 0 && (
        <div className="flex flex-wrap gap-4">
          {cards.map((card) => (
            <CardWithPreview key={card.id} card={card} schoolName={schoolName} />
          ))}
        </div>
      )}
    </div>
  );
}