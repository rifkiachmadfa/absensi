"use client";

import type { CSSProperties } from "react";
import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";

// Toast notifikasi global (mis. hasil scan absensi). Warna dipetakan ke
// token semantic yang sama dengan sisa aplikasi (UI_RULES Section 5 & 36):
// success/warning/danger, bukan warna sonner default, supaya konsisten
// dengan Badge status kehadiran di tabel /absensi.
function Toaster({ ...props }: ToasterProps) {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      position="top-center"
      richColors={false}
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--success-bg": "var(--success-bg)",
          "--success-text": "var(--success)",
          "--success-border": "var(--success)",
          "--warning-bg": "var(--warning-bg)",
          "--warning-text": "var(--warning)",
          "--warning-border": "var(--warning)",
          "--error-bg": "var(--danger-bg)",
          "--error-text": "var(--danger)",
          "--error-border": "var(--danger)",
        } as CSSProperties
      }
      {...props}
    />
  );
}

export { Toaster };
