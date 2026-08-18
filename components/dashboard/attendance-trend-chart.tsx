"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Chart,
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  type ChartConfiguration,
} from "chart.js";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
  CardContent,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type {
  AttendanceTrendPoint,
  TrendMode,
  TrendStatus,
} from "@/lib/services/report-service";

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip);

// Context yang diterima callback `animation.delay`; Chart.js tidak meng-export
// tipe ini secara langsung, dan properti `dropped` adalah flag custom yang
// ditempel sendiri (bukan bagian dari tipe bawaan Chart.js).
type DelayAnimationContext = {
  type?: string;
  mode?: string;
  dataIndex: number;
  datasetIndex?: number;
  dropped?: boolean;
};

// Modern School — UI_RULES §9 (statistik: 24–32px / 600–700), §16 (button/pill),
// §34 (animation 150–250ms per interaksi UI).
const MODE_TABS: { value: TrendMode; label: string }[] = [
  { value: "daily", label: "Harian" },
  { value: "monthly", label: "Bulanan" },
];

// Warna mengikuti UI_RULES §5 (Status Colors): Hadir = success green,
// Alpha = danger red. Sakit & Izin memakai dua warna teal brand yang
// berbeda (§5: "Izin/Sakit: gunakan neutral/teal") supaya tetap bisa
// dibedakan satu sama lain tanpa keluar dari keluarga warna brand.
const STATUS_TABS: {
  value: TrendStatus;
  label: string;
  color: string;
  hoverColor: string;
  percentageKey: "persentaseHadir" | "persentaseSakit" | "persentaseIzin" | "persentaseAlpha";
  countLabel: (p: AttendanceTrendPoint) => string;
}[] = [
  {
    value: "HADIR",
    label: "Hadir",
    color: "#16A34A",
    hoverColor: "#15803D",
    percentageKey: "persentaseHadir",
    countLabel: (p) => `Hadir + Terlambat: ${p.hadir + p.terlambat}/${p.totalSiswa}`,
  },
  {
    value: "SAKIT",
    label: "Sakit",
    color: "#22949E",
    hoverColor: "#1C7F88",
    percentageKey: "persentaseSakit",
    countLabel: (p) => `Sakit: ${p.sakit}/${p.totalSiswa}`,
  },
  {
    value: "IZIN",
    label: "Izin",
    color: "#17586F",
    hoverColor: "#123F50",
    percentageKey: "persentaseIzin",
    countLabel: (p) => `Izin: ${p.izin}/${p.totalSiswa}`,
  },
  {
    value: "ALPHA",
    label: "Alpha",
    color: "#DC2626",
    hoverColor: "#B91C1C",
    percentageKey: "persentaseAlpha",
    countLabel: (p) => `Alpha: ${p.alpha}/${p.totalSiswa}`,
  },
];

export function AttendanceTrendChart({
  dailyPoints,
  monthlyPoints,
}: {
  dailyPoints: AttendanceTrendPoint[];
  monthlyPoints: AttendanceTrendPoint[];
}) {
  const [mode, setMode] = useState<TrendMode>("daily");
  const [status, setStatus] = useState<TrendStatus>("HADIR");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<Chart | null>(null);

  const points = mode === "daily" ? dailyPoints : monthlyPoints;
  const statusConfig = useMemo(
    () => STATUS_TABS.find((t) => t.value === status) ?? STATUS_TABS[0],
    [status]
  );

  const latest = points.at(-1);
  const average =
    points.length > 0
      ? Math.round(
          points.reduce((sum, p) => sum + p[statusConfig.percentageKey], 0) / points.length
        )
      : 0;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Bar Chart — Border Radius + Animation Delay (pola resmi Chart.js:
    // https://www.chartjs.org/docs/latest/samples/animations/delay.html
    // "context.dropped" memastikan delay hanya berjalan sekali per bar,
    // bukan setiap kali chart re-render/resize).
    const config: ChartConfiguration<"bar"> = {
      type: "bar",
      data: {
        labels: points.map((p) => p.label),
        datasets: [
          {
            label: `Persentase ${statusConfig.label}`,
            data: points.map((p) => p[statusConfig.percentageKey]),
            backgroundColor: statusConfig.color,
            hoverBackgroundColor: statusConfig.hoverColor,
            borderRadius: 8,
            borderSkipped: false,
            maxBarThickness: 40,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          // Pola resmi Chart.js (lihat link di atas): `dropped` ditempel
          // langsung ke context sebagai penanda "delay sudah dipakai sekali"
          // supaya tidak berulang setiap resize/re-render.
          delay: (context: DelayAnimationContext) => {
            let delay = 0;
            if (context.type === "data" && context.mode === "default" && !context.dropped) {
              delay = context.dataIndex * 40 + (context.datasetIndex ?? 0) * 100;
              context.dropped = true;
            }
            return delay;
          },
        },
        scales: {
          x: {
            grid: { display: false },
            border: { color: "#DCE7E9" },
            ticks: { color: "#71858C", font: { size: 12 } },
          },
          y: {
            beginAtZero: true,
            max: 100,
            grid: { color: "#EAF7F8" },
            border: { display: false },
            ticks: {
              color: "#71858C",
              font: { size: 12 },
              callback: (value) => `${value}%`,
              stepSize: 25,
            },
          },
        },
        plugins: {
          tooltip: {
            backgroundColor: "#17313A",
            padding: 10,
            cornerRadius: 8,
            displayColors: false,
            callbacks: {
              label: (item) => {
                const p = points[item.dataIndex];
                return [`${statusConfig.label}: ${item.formattedValue}%`, statusConfig.countLabel(p)];
              },
            },
          },
        },
      },
    };

    chartRef.current?.destroy();
    chartRef.current = new Chart(canvas, config);

    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, [mode, points, statusConfig]);

  return (
    <Card className="rounded-xl border-[#DCE7E9] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
      <CardHeader>
        <CardTitle className="text-[18px] font-semibold text-[#17313A]">
          Persentase {statusConfig.label}
        </CardTitle>
        <CardDescription className="text-[13px] text-[#71858C]">
          {mode === "daily"
            ? `Rata-rata 14 hari sekolah terakhir: ${average}%`
            : `Rata-rata 6 bulan terakhir: ${average}%`}
          {latest ? ` · Terbaru (${latest.label}): ${latest[statusConfig.percentageKey]}%` : ""}
        </CardDescription>
        <CardAction>
          <div className="flex gap-1 rounded-[999px] border border-[#DCE7E9] bg-[#F1F5F5] p-1">
            {MODE_TABS.map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setMode(tab.value)}
                className={cn(
                  "min-h-8 rounded-[999px] px-3 text-[13px] font-medium transition-colors",
                  mode === tab.value
                    ? "bg-[#22949E] text-white"
                    : "text-[#48616A] hover:bg-white"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </CardAction>
      </CardHeader>

      {/* Filter status — tab kedua di dalam chart, mekanisme sama seperti
          toggle Harian/Bulanan di atas, hanya beda sumber data yang dipilih. */}
      <div className="flex flex-wrap gap-1.5 px-4">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setStatus(tab.value)}
            className={cn(
              "min-h-8 rounded-[999px] border px-3 text-[13px] font-medium transition-colors",
              status === tab.value
                ? "border-transparent text-white"
                : "border-[#DCE7E9] bg-white text-[#48616A] hover:bg-[#F1F5F5]"
            )}
            style={status === tab.value ? { backgroundColor: tab.color } : undefined}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <CardContent>
        {points.length === 0 ? (
          <p className="py-10 text-center text-sm text-[#71858C]">
            Belum ada data kehadiran untuk ditampilkan.
          </p>
        ) : (
          <div className="h-[240px] w-full sm:h-[280px]">
            <canvas
              ref={canvasRef}
              role="img"
              aria-label={`Grafik persentase ${statusConfig.label.toLowerCase()} siswa`}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}