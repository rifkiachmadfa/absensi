"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Chart,
  LineController,
  LineElement,
  PointElement,
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
  CardContent,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ClassAttendanceTrendPayload } from "@/lib/services/report-service";

Chart.register(LineController, LineElement, PointElement, CategoryScale, LinearScale, Tooltip);

// Context yang diterima callback `animation.delay`; sama seperti pola resmi
// Chart.js yang sudah dipakai di attendance-trend-chart.tsx (§UI_RULES anim
// 150-250ms per elemen -- di sini delay dipakai untuk "gambar garis satu per
// satu", bukan durasi tunggal, jadi tetap terasa cepat & tidak lebay).
type DelayAnimationContext = {
  type?: string;
  mode?: string;
  dataIndex: number;
  datasetIndex?: number;
  dropped?: boolean;
};

// Palet kategorikal untuk membedakan tiap kelas. Bukan warna status
// (Hijau/Amber/Merah di §5 sudah punya makna "Hadir/Terlambat/Alpha" di
// chart lain), jadi di sini pakai set warna terpisah yang tetap profesional
// & tidak neon/rainbow (§4 & §8), dimulai dari brand primary/deep teal lalu
// diperluas dengan warna netral-profesional agar tiap kelas mudah dibedakan.
const CLASS_COLOR_PALETTE = [
  "#22949E", // Yadika Teal (brand primary)
  "#D97706", // Warning amber
  "#DC2626", // Danger red
  "#16A34A", // Success green
  "#17586F", // Deep Teal (brand)
  "#0EA5E9", // Sky (biru terang, bukan generic #2563EB)
  "#CA8A04", // Gold gelap
  "#059669", // Emerald
  "#B45309", // Coklat oranye
  "#0F766E", // Teal gelap kedua
  "#475569", // Slate
  "#65A30D", // Lime gelap
];

function colorForIndex(index: number) {
  return CLASS_COLOR_PALETTE[index % CLASS_COLOR_PALETTE.length];
}

export function ClassComparisonTrendChart({
  data,
}: {
  data: ClassAttendanceTrendPayload;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<Chart | null>(null);

  // Default: 5 kelas pertama dicentang supaya chart tidak kosong saat
  // pertama dibuka, tapi juga tidak langsung penuh sesak jika kelas banyak.
  const [checkedIds, setCheckedIds] = useState<Set<string>>(
    () => new Set(data.series.slice(0, 5).map((s) => s.classId))
  );

  function toggleClass(classId: string) {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(classId)) next.delete(classId);
      else next.add(classId);
      return next;
    });
  }

  // Index warna diambil dari posisi kelas di `data.series` (bukan di
  // `activeSeries`) supaya warna tiap kelas TETAP KONSISTEN walau kelas
  // lain di-uncheck/checked bolak-balik.
  const colorByClassId = useMemo(() => {
    const map = new Map<string, string>();
    data.series.forEach((s, i) => map.set(s.classId, colorForIndex(i)));
    return map;
  }, [data.series]);

  const activeSeries = useMemo(
    () => data.series.filter((s) => checkedIds.has(s.classId)),
    [data.series, checkedIds]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (activeSeries.length === 0) {
      chartRef.current?.destroy();
      chartRef.current = null;
      return;
    }

    // Line Chart -- cubicInterpolationMode: "monotone" (garis melengkung
    // halus tapi tidak overshoot melewati titik data, cocok untuk data
    // persentase 0-100) + animation.delay per titik & per garis supaya tiap
    // kelas "digambar" bergiliran, bukan muncul serentak.
    const config: ChartConfiguration<"line"> = {
      type: "line",
      data: {
        labels: data.labels,
        datasets: activeSeries.map((s) => {
          const color = colorByClassId.get(s.classId) ?? "#22949E";
          return {
            label: s.className,
            data: s.points.map((p) => p.persentaseHadir),
            borderColor: color,
            backgroundColor: color,
            pointBackgroundColor: color,
            pointBorderColor: "#FFFFFF",
            pointBorderWidth: 1.5,
            pointRadius: 3,
            pointHoverRadius: 5,
            borderWidth: 2,
            tension: 0.4,
            cubicInterpolationMode: "monotone" as const,
            fill: false,
          };
        }),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        animation: {
          // Pola resmi Chart.js (animations/delay.html), sama seperti di
          // attendance-trend-chart.tsx: `dropped` mencegah delay berulang
          // setiap resize/re-render.
          delay: (context: DelayAnimationContext) => {
            let delay = 0;
            if (context.type === "data" && context.mode === "default" && !context.dropped) {
              delay = context.dataIndex * 30 + (context.datasetIndex ?? 0) * 120;
              context.dropped = true;
            }
            return delay;
          },
        },
        scales: {
          x: {
            grid: { display: false },
            border: { color: "#DCE7E9" },
            ticks: {
              color: "#71858C",
              font: { size: 11 },
              maxRotation: 0,
              autoSkip: true,
              maxTicksLimit: 7,
            },
          },
          y: {
            beginAtZero: true,
            max: 100,
            grid: { color: "#EAF7F8" },
            border: { display: false },
            ticks: {
              color: "#71858C",
              font: { size: 11 },
              callback: (value) => `${value}%`,
              stepSize: 25,
            },
          },
        },
        plugins: {
          // Legend bawaan Chart.js dimatikan karena sudah digantikan oleh
          // checkbox list di bawah judul (checkbox = legend + filter, tidak
          // perlu duplikasi info).
          legend: { display: false },
          tooltip: {
            backgroundColor: "#17313A",
            padding: 10,
            cornerRadius: 8,
            titleFont: { size: 12 },
            bodyFont: { size: 12 },
            callbacks: {
              label: (item) => `${item.dataset.label}: ${item.formattedValue}%`,
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
  }, [activeSeries, colorByClassId, data.labels]);

    return (
    <Card className="flex h-full flex-col rounded-xl border-[#DCE7E9] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
      <CardHeader>
        <CardTitle className="text-[18px] font-semibold text-[#17313A]">
          Perbandingan Kehadiran per Kelas
        </CardTitle>
        <CardDescription className="text-[13px] text-[#71858C]">
          Persentase hadir · 14 hari sekolah terakhir
        </CardDescription>
      </CardHeader>

      {data.series.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-2 px-4 pb-1">
          {data.series.map((s) => {
            const color = colorByClassId.get(s.classId) ?? "#22949E";
            const checked = checkedIds.has(s.classId);
            return (
              <label
                key={s.classId}
                className="flex min-h-6 cursor-pointer select-none items-center gap-1.5 text-[13px] text-[#48616A]"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleClass(s.classId)}
                  className="h-3.5 w-3.5 rounded-[4px] border-[#DCE7E9]"
                  style={{ accentColor: color }}
                />
                <span
                  className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: color }}
                  aria-hidden
                />
                <span className={cn(checked ? "font-medium text-[#17313A]" : undefined)}>
                  {s.className}
                </span>
              </label>
            );
          })}
        </div>
      )}

      {/* flex-1: mengisi sisa tinggi Card (Card sudah h-full mengikuti baris
          grid), supaya tinggi card ini sejajar dengan card Top 5 Murid Paling
          Disiplin di sebelahnya, bukan cuma setinggi konten. */}
      <CardContent className="flex flex-1 flex-col">
        {data.series.length === 0 ? (
          <p className="flex flex-1 items-center justify-center text-center text-sm text-[#71858C]">
            Belum ada data kelas untuk ditampilkan.
          </p>
        ) : activeSeries.length === 0 ? (
          <p className="flex flex-1 items-center justify-center text-center text-sm text-[#71858C]">
            Pilih minimal satu kelas untuk menampilkan grafik.
          </p>
        ) : (
          <div className="h-full min-h-[240px] w-full flex-1 sm:min-h-[260px]">
            <canvas
              ref={canvasRef}
              role="img"
              aria-label="Grafik perbandingan persentase kehadiran antar kelas"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}