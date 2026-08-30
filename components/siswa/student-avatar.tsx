// components/siswa/student-avatar.tsx
"use client";

import { useState } from "react";
import { getStudentAvatarUrl } from "@/lib/kartu-siswa/avatar";
import { cn } from "@/lib/utils";

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Avatar murid yang dipakai berulang di luar Kartu Siswa (leaderboard
 * dashboard, dsb) -- disatukan di sini supaya SERAGAM dengan avatar
 * DiceBear "clay" pada kartu siswa fisik/digital
 * (components/kartu-siswa/student-id-card.tsx &
 * components/publik/public-student-profile-card.tsx), bukan lagi
 * lingkaran inisial polos per komponen.
 *
 * Seed avatar SELALU dari NIS (bukan nama/id) -- ini yang membuat avatar
 * murid yang sama konsisten tampil sama persis di kartu siswa, dashboard,
 * maupun halaman lain, sesuai lib/kartu-siswa/avatar.ts.
 *
 * Fallback ke inisial bila avatar DiceBear gagal dimuat (offline, rate
 * limit, dsb), supaya layout tidak pernah rusak/tabrakan -- pola yang
 * sama seperti pada StudentIdCard & PublicStudentProfileCard.
 */
export function StudentAvatar({
  nis,
  name,
  size = 36,
  className,
}: {
  nis: string;
  name: string;
  /** Diameter avatar dalam px. Default 36px (ukuran baris leaderboard). */
  size?: number;
  className?: string;
}) {
  const avatarSrc = getStudentAvatarUrl(nis, "svg");
  const [avatarFailed, setAvatarFailed] = useState(false);

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#EAF7F8]",
        className
      )}
      style={{ width: size, height: size }}
    >
      {!avatarFailed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatarSrc}
          alt={`Avatar ${name}`}
          width={size}
          height={size}
          className="h-full w-full object-cover"
          onError={() => setAvatarFailed(true)}
        />
      ) : (
        <span
          className="font-semibold text-[#17586F]"
          style={{ fontSize: Math.max(10, Math.round(size * 0.36)) }}
        >
          {getInitials(name)}
        </span>
      )}
    </div>
  );
}