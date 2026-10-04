import React, { useMemo } from "react";
import { CategoryScale, Chart as ChartJS, Legend, LinearScale, LineElement, PointElement, Tooltip } from "chart.js";
import { Line } from "react-chartjs-2";
import { useTheme } from "../../hooks/useTheme.tsx";
import { chartTheme, cssVar } from "../../utils/themeColors.ts";
import { parseTimestamp } from "../../utils/date.ts";
import { fmtNum } from "../../utils/analyticsFormat.ts";
import { SERIES_COLORS } from "../../utils/playerCards.ts";
import type { RatingSeriesPoint } from "../../types/playerCards";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

const pad = (n: number) => String(n).padStart(2, "0");

/** "dd/MM" no fuso do navegador (rótulo do eixo). */
export function shortDay(ts: string): string {
  const d = parseTimestamp(ts);
  return d ? `${pad(d.getDate())}/${pad(d.getMonth() + 1)}` : "—";
}

/** "dd/MM/aaaa HH:mm" (tooltip / tabela). */
export function dayTime(ts: string): string {
  const d = parseTimestamp(ts);
  return d ? `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}` : "—";
}

const finite = (v: number | null | undefined): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/**
 * Notas por partida dos dois jogadores (últimas 20). Quando um deles não jogou, o valor é null:
 * a linha quebra (não liga pontos através de partidas em que o jogador ficou de fora).
 */
export const RatingSeriesChart = React.memo(function RatingSeriesChart({
  series,
  nameA,
  nameB,
}: {
  series: RatingSeriesPoint[];
  nameA: string;
  nameB: string;
}) {
  const { resolvedTheme } = useTheme();

  const labels = useMemo(() => series.map((p) => shortDay(p.timestamp)), [series]);

  const data = useMemo(() => {
    const t = chartTheme();
    const colorA = cssVar(SERIES_COLORS.a);
    const colorB = cssVar(SERIES_COLORS.b);
    return {
      labels,
      datasets: [
        {
          label: nameA,
          data: series.map((p) => finite(p.a)),
          borderColor: colorA,
          backgroundColor: colorA,
          borderWidth: 2.5,
          tension: 0.2,
          pointStyle: "circle" as const,
          pointRadius: 4.5,
          pointHoverRadius: 7,
          pointBorderColor: t.surface,
          spanGaps: false,
        },
        {
          label: nameB,
          data: series.map((p) => finite(p.b)),
          borderColor: colorB,
          backgroundColor: colorB,
          borderWidth: 2.5,
          borderDash: [7, 4],
          tension: 0.2,
          pointStyle: "rect" as const,
          pointRadius: 4.5,
          pointHoverRadius: 7,
          pointBorderColor: t.surface,
          spanGaps: false,
        },
      ],
    };
    // resolvedTheme: relê as cores do tema quando ele troca
  }, [labels, series, nameA, nameB, resolvedTheme]);

  const options = useMemo(() => {
    const t = chartTheme();
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: false as const,
      interaction: { mode: "index" as const, intersect: false },
      layout: { padding: { top: 8, right: 8 } },
      plugins: {
        legend: { display: true, position: "bottom" as const, labels: { color: t.fg, boxWidth: 14, usePointStyle: true } },
        tooltip: {
          backgroundColor: t.surface,
          titleColor: t.fg,
          bodyColor: t.fg,
          borderColor: t.border,
          borderWidth: 1,
          padding: 10,
          callbacks: {
            title: (items: Array<{ dataIndex: number }>) => {
              const p = series[items[0]?.dataIndex ?? 0];
              return p ? dayTime(p.timestamp) : "";
            },
            label: (ctx: { dataset: { label?: string }; raw: unknown }) =>
              `${ctx.dataset.label ?? ""}: ${typeof ctx.raw === "number" ? fmtNum(ctx.raw, 1) : "não jogou"}`,
          },
        },
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: t.fgMuted, autoSkip: true, maxRotation: 0 } },
        y: {
          suggestedMin: 5,
          suggestedMax: 10,
          grid: { color: t.grid },
          border: { display: false },
          ticks: { color: t.fgMuted, callback: (v: number | string) => fmtNum(Number(v), 0) },
        },
      },
    };
  }, [series, resolvedTheme]);

  const avg = (key: "a" | "b") => {
    const vals = series.map((p) => finite(p[key])).filter((v): v is number => v !== null);
    return vals.length ? fmtNum(vals.reduce((s, v) => s + v, 0) / vals.length, 2) : "—";
  };

  return (
    <div
      data-no-swipe
      className="relative h-64 w-full sm:h-72"
      role="img"
      aria-label={`Notas por partida nas últimas ${series.length} partidas. Média de ${nameA}: ${avg("a")}. Média de ${nameB}: ${avg("b")}. A tabela abaixo traz todos os valores.`}
    >
      <Line key={resolvedTheme} data={data as any} options={options as any} />
    </div>
  );
});
