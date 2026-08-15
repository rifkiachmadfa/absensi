// Ukuran mengikuti rasio kartu ID standar (CR80, ~85.6mm x 54mm),
// diperbesar sedikit agar QR tetap mudah dipindai kamera HP guru.
const CARD_WIDTH_MM = 85.6;
const CARD_HEIGHT_MM = 54;

export type StudentIdCardData = {
  id: string;
  name: string;
  nis: string;
  nisn: string | null;
  className: string;
  qrCodeDataUrl: string;
};

export function StudentIdCard({
  student,
  schoolName,
}: {
  student: StudentIdCardData;
  schoolName: string;
}) {
  return (
    <div
      className="flex flex-col justify-between overflow-hidden rounded-lg border bg-white p-3 text-black shadow-sm print:break-inside-avoid print:rounded-none print:border-black/60 print:shadow-none"
      style={{
        width: `${CARD_WIDTH_MM}mm`,
        height: `${CARD_HEIGHT_MM}mm`,
      }}
    >
      <div className="flex items-center gap-2 border-b border-black/10 pb-1">
        <div className="min-w-0">
          <p className="truncate text-[9px] font-semibold uppercase tracking-wide">
            {schoolName}
          </p>
          <p className="text-[7px] uppercase text-black/60">Kartu Tanda Siswa</p>
        </div>
      </div>

      <div className="flex flex-1 items-center gap-3 py-1">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={student.qrCodeDataUrl}
          alt={`QR Code ${student.name}`}
          width={70}
          height={70}
          className="h-[70px] w-[70px] shrink-0"
        />
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="truncate text-[11px] font-bold leading-tight">
            {student.name}
          </p>
          <p className="text-[8px] text-black/70">NIS: {student.nis}</p>
          <p className="text-[8px] text-black/70">
            NISN: {student.nisn ?? "-"}
          </p>
          <p className="text-[8px] text-black/70">Kelas: {student.className}</p>
        </div>
      </div>

      <p className="border-t border-black/10 pt-1 text-center text-[6px] text-black/50">
        Kartu ini adalah identitas resmi absensi siswa
      </p>
    </div>
  );
}