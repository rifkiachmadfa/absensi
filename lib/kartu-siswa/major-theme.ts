// lib/kartu-siswa/major-theme.ts

/**
 * Tema warna kartu murid berdasarkan jurusan (Class.major).
 * Sesuai UI_RULES: brand color (teal/yellow) tetap dominan untuk kondisi
 * default, sementara TKR/MPLB memakai warna identitas jurusan yang
 * eksplisit diminta (merah/biru) — dipakai terbatas hanya di kartu ini,
 * bukan di seluruh UI aplikasi.
 */
export type MajorTheme = {
  key: string;
  /** Label singkat yang tampil di badge jurusan pada kartu. */
  label: string;
  gradientFrom: string;
  gradientTo: string;
  /** Warna teks utama di atas header band (gradient). */
  bandText: string;
  /** Warna teks sekunder/caption di atas header band. */
  bandTextMuted: string;
  /** Background badge kelas (soft tint). */
  badgeBg: string;
  /** Warna teks badge kelas. */
  badgeText: string;
};

const THEMES: Record<string, MajorTheme> = {
  TKR: {
    key: "TKR",
    label: "TKR",
    gradientFrom: "#7F1D1D",
    gradientTo: "#DC2626",
    bandText: "#FFFFFF",
    bandTextMuted: "rgba(255,255,255,0.78)",
    badgeBg: "#FEF2F2",
    badgeText: "#B91C1C",
  },
  TKJ: {
    key: "TKJ",
    label: "TKJ",
    gradientFrom: "#E6B800",
    gradientTo: "#FFCC31",
    bandText: "#3A2E00",
    bandTextMuted: "rgba(58,46,0,0.75)",
    badgeBg: "#FFF8D9",
    badgeText: "#8A6D00",
  },
  MPLB: {
    key: "MPLB",
    label: "MPLB",
    gradientFrom: "#1E3A8A",
    gradientTo: "#3B82F6",
    bandText: "#FFFFFF",
    bandTextMuted: "rgba(255,255,255,0.78)",
    badgeBg: "#EFF6FF",
    badgeText: "#1D4ED8",
  },
};

/** Tema default (brand teal) untuk jurusan lain / major kosong. */
const DEFAULT_THEME: MajorTheme = {
  key: "DEFAULT",
  label: "UMUM",
  gradientFrom: "#17586F",
  gradientTo: "#22949E",
  bandText: "#FFFFFF",
  bandTextMuted: "rgba(255,255,255,0.78)",
  badgeBg: "#EAF7F8",
  badgeText: "#17586F",
};

export function getMajorTheme(major?: string | null): MajorTheme {
  if (!major) return DEFAULT_THEME;
  const normalized = major.trim().toUpperCase();
  const matchKey = Object.keys(THEMES).find((key) => normalized.includes(key));
  return matchKey ? THEMES[matchKey] : DEFAULT_THEME;
}