// components/publik/public-student-profile-card.tsx
"use client";

import { useState } from "react";
import { TrendingUp } from "lucide-react";
import { getMajorTheme } from "@/lib/kartu-siswa/major-theme";
import { getStudentAvatarUrl } from "@/lib/kartu-siswa/avatar";

export type PctTone = {
  text: string;
  bg: string;
  border: string;
};

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Header profil pada halaman publik cek-kehadiran ("kartu identitas
 * digital" murid). Mengikuti bahasa visual kartu siswa fisik
 * (components/kartu-siswa/student-id-card.tsx) -- header band bertema
 * jurusan, avatar overlap -- tapi:
 *  - nama TIDAK pernah dipotong (boleh 2 baris, tidak ada `truncate`)
 *  - avatar memakai DiceBear "clay" yang sama dengan kartu fisik
 *    (seed = NIS, jadi konsisten di kedua tempat), dengan fallback
 *    inisial bila avatar gagal dimuat
 *  - kotak QR/barcode pada kartu fisik digantikan kotak persentase
 *    kehadiran periode berjalan, sesuai permintaan: tetap tampilkan
 *    persentase, bukan kode batang, di halaman publik ini
 */
export function PublicStudentProfileCard({
  name,
  nis,
  nisn,
  className,
  major,
  attendancePct,
  periodLabel,
  pctTone,
}: {
  name: string;
  nis: string;
  nisn: string | null;
  className: string;
  major: string | null;
  attendancePct: number;
  periodLabel: string;
  pctTone: PctTone;
}) {
  const theme = getMajorTheme(major);
  const avatarSrc = getStudentAvatarUrl(nis, "svg");
  const badgeLabel = major?.trim() || theme.label;
  const [avatarFailed, setAvatarFailed] = useState(false);

  return (
    <div className="overflow-hidden rounded-[18px] border border-[#DCE7E9] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
      {/* Header band -- warna tema jurusan, sama seperti kartu siswa fisik */}
      <div
        className="relative h-20 sm:h-16"
        style={{
          backgroundImage: `linear-gradient(135deg, ${theme.gradientFrom}, ${theme.gradientTo})`,
        }}
      >
        <div className="pointer-events-none absolute -right-6 -top-10 size-28 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute right-10 top-3 size-10 rounded-full bg-white/10" />
        <span
          className="absolute right-4 top-4 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide"
          style={{
            color: theme.bandText,
            borderColor: theme.bandTextMuted,
            backgroundColor: "rgba(255,255,255,0.14)",
          }}
        >
          {badgeLabel}
        </span>
      </div>

      <div className="flex flex-col gap-5 px-5 pb-5 sm:flex-row sm:items-end sm:justify-between">
        {/* Avatar + identitas -- nama diberi ruang penuh, boleh melipat ke
            baris kedua, tidak pernah dipotong dengan ellipsis. */}
        <div className="-mt-10 flex flex-col items-center gap-3 text-center sm:flex-row sm:items-end sm:text-left">
          <div className="relative size-20 shrink-0 overflow-hidden rounded-full border-4 border-white bg-[#F1F5F5] shadow-md sm:size-[76px]">
            {!avatarFailed ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarSrc}
                alt={`Avatar ${name}`}
                width={76}
                height={76}
                className="h-full w-full object-cover"
                onError={() => setAvatarFailed(true)}
              />
            ) : (
              <div
                className="flex h-full w-full items-center justify-center text-xl font-bold"
                style={{ backgroundColor: theme.badgeBg, color: theme.badgeText }}
              >
                {getInitials(name)}
              </div>
            )}
          </div>

          <div className="min-w-0 pb-1">
            <h1 className="break-words text-[20px] font-bold leading-snug tracking-tight text-[#17313A] sm:text-[26px]">
              {name}
            </h1>
            <div className="mt-1.5 flex flex-wrap justify-center gap-1.5 sm:justify-start">
              <span className="rounded-full bg-[#F1F5F5] px-2.5 py-1 text-[11px] font-medium text-[#48616A]">
                NIS {nis}
              </span>
              <span className="rounded-full bg-[#F1F5F5] px-2.5 py-1 text-[11px] font-medium text-[#48616A]">
                NISN {nisn ?? "-"}
              </span>
              <span
                className="rounded-full px-2.5 py-1 text-[11px] font-medium"
                style={{ backgroundColor: theme.badgeBg, color: theme.badgeText }}
              >
                {className}
              </span>
            </div>
          </div>
        </div>

        {/* Blok persentase kehadiran -- menempati posisi yang setara dengan
            kotak QR/barcode pada kartu fisik, tapi berisi angka persentase
            karena halaman ini bukan kartu identitas (tidak perlu dipindai). */}
        <div
          className={`flex shrink-0 items-center gap-3 rounded-[14px] border px-4 py-3 ${pctTone.bg} ${pctTone.border}`}
        >
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/70">
            <TrendingUp className={`size-4 ${pctTone.text}`} strokeWidth={2.5} />
          </div>
          <div>
            <p className={`text-xl font-bold leading-none tabular-nums ${pctTone.text}`}>
              {attendancePct}%
            </p>
            <p className="mt-1 text-[11px] font-medium text-[#71858C]">
              Kehadiran &bull; {periodLabel}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}