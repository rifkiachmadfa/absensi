// components/kartu-siswa/student-id-card.tsx
"use client";

import { useState } from "react";
import { getMajorTheme } from "@/lib/kartu-siswa/major-theme";
import { getStudentAvatarUrl } from "@/lib/kartu-siswa/avatar";
import { SCHOOL_LOGO_URL } from "@/lib/kartu-siswa/constants";

export type StudentIdCardData = {
  id: string;
  name: string;
  nis: string;
  nisn: string | null;
  className: string;
  /** Class.major — dipakai untuk menentukan tema warna kartu (TKR/TKJ/MPLB/dll). */
  major: string | null;
  qrCodeDataUrl: string;
};

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function StudentIdCard({
  student,
  schoolName,
}: {
  student: StudentIdCardData;
  schoolName: string;
}) {
  const theme = getMajorTheme(student.major);
  const avatarSrc = getStudentAvatarUrl(student.nis, "svg");
  const badgeLabel = student.major?.trim() || theme.label;

  // Fallback ke inisial bila avatar DiceBear gagal dimuat (offline, rate
  // limit, dsb), supaya layout kartu tidak pernah rusak/tabrakan.
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);

  return (
    <div className="relative flex aspect-[8/5] w-full max-w-[400px] flex-col overflow-hidden rounded-[18px] border border-black/5 bg-white text-black shadow-[0_8px_24px_rgba(15,23,42,0.08)] print:break-inside-avoid print:rounded-none print:border-black/20 print:shadow-none">
      {/* Header band — warna sesuai tema jurusan */}
      <div
        className="relative flex items-start justify-between gap-2 px-4 pb-8 pt-4"
        style={{
          backgroundImage: `linear-gradient(135deg, ${theme.gradientFrom}, ${theme.gradientTo})`,
        }}
      >
        {/* Decorative shapes — opacity rendah (UI_RULES §27) */}
        <div className="pointer-events-none absolute -right-6 -top-10 h-28 w-28 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute right-8 top-4 h-12 w-12 rounded-full bg-white/10" />

        <div className="relative flex min-w-0 items-center gap-2">
          <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full border border-white/50 bg-white">
            {!logoFailed ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={SCHOOL_LOGO_URL}
                alt={`Logo ${schoolName}`}
                width={32}
                height={32}
                className="h-full w-full object-cover"
                onError={() => setLogoFailed(true)}
              />
            ) : (
              <div
                className="flex h-full w-full items-center justify-center text-[9px] font-bold"
                style={{ color: theme.gradientTo }}
              >
                {getInitials(schoolName)}
              </div>
            )}
          </div>
          <div className="min-w-0">
            <p
              className="truncate text-[11px] font-bold uppercase tracking-wide"
              style={{ color: theme.bandText }}
            >
              {schoolName}
            </p>
            <p
              className="truncate text-[8px] font-medium uppercase tracking-wider"
              style={{ color: theme.bandTextMuted }}
            >
              Kartu Tanda Murid
            </p>
          </div>
        </div>

        <span
          className="relative shrink-0 rounded-full border px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wide"
          style={{
            color: theme.bandText,
            borderColor: theme.bandTextMuted,
            backgroundColor: "rgba(255,255,255,0.14)",
          }}
        >
          {badgeLabel}
        </span>
      </div>

      {/* Avatar — overlap ke header band ala kartu modern */}
      <div className="flex items-end gap-3 px-4 -mt-7">
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full border-[3px] border-white bg-[#F1F5F5] shadow-md">
          {!avatarFailed ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarSrc}
              alt={`Avatar ${student.name}`}
              width={64}
              height={64}
              className="h-full w-full object-cover"
              onError={() => setAvatarFailed(true)}
            />
          ) : (
            <div
              className="flex h-full w-full items-center justify-center text-base font-bold"
              style={{ backgroundColor: theme.badgeBg, color: theme.badgeText }}
            >
              {getInitials(student.name)}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1 pb-0.5">
          <p className="truncate text-[13px] font-bold leading-tight text-[#17313A]">
            {student.name}
          </p>
          <p className="truncate text-[9px] text-[#48616A]">
            NIS {student.nis} &bull; NISN {student.nisn ?? "-"}
          </p>
        </div>
      </div>

      {/* Body: kelas + barcode/QR */}
      <div className="flex flex-1 items-center justify-between gap-3 px-4 pb-4 pt-2">
        <div className="min-w-0 space-y-1.5">
          <span
            className="inline-block truncate rounded-full px-2.5 py-1 text-[10px] font-semibold"
            style={{ backgroundColor: theme.badgeBg, color: theme.badgeText }}
          >
            {student.className}
          </span>
          <p className="text-[7.5px] leading-snug text-[#71858C]">
            Kartu ini adalah identitas resmi
            <br />
            absensi murid {schoolName}.
          </p>
        </div>

        <div className="shrink-0 rounded-lg border border-[#DCE7E9] bg-white p-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={student.qrCodeDataUrl}
            alt={`Barcode QR ${student.name}`}
            width={56}
            height={56}
            className="h-14 w-14"
          />
        </div>
      </div>
    </div>
  );
}