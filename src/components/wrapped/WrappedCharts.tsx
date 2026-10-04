import React, { useMemo } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Bar, Line } from "react-chartjs-2";
import { useTheme } from "../../hooks/useTheme.tsx";
import { chartTheme, cssVar } from "../../utils/themeColors.ts";
import type { WrappedMonth } from "../../types/wrapped";
import { fmtMonthLong, fmtMonthShort, fmtNum, fmtYmd, fmtYmdShort } from "../../utils/analyticsFormat.ts";

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, Tooltip, Legend, Filler);

/** Jogos por mês, empilhado em vitórias / empates / derrotas. */
export function MonthlyChart({ months }: { months: WrappedMonth[] }) {
  const { resolvedTheme } = useTheme();

  const data = useMemo(
    () => ({
      labels: months.map((m) => fmtMonthShort(m.month)),
      datasets: [
        { label: "Vitórias", data: months.map((m) => m.wins), backgroundColor: cssVar("--color-positive", 0.9) },
        { label: "Empates", data: months.map((m) => m.draws), backgroundColor: cssVar("--color-warning", 0.9) },
        { label: "Derrotas", data: months.map((m) => m.losses), backgroundColor: cssVar("--color-negative", 0.9) },
      ].map((d) => ({ ...d, borderRadius: 3, maxBarThickness: 36 })),
    }),
    // resolvedTheme: relê as cores do tema quando ele troca
    [months, resolvedTheme]
  );

  const options = useMemo(() => {
    const t = chartTheme();
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: false as const,
      interaction: { mode: "index" as const, intersect: false },
      plugins: {
        legend: { display: true, position: "bottom" as const, labels: { color: t.fg, boxWidth: 12 } },
        tooltip: {
          backgroundColor: t.surface,
          titleColor: t.fg,
          bodyColor: t.fg,
          borderColor: t.border,
          borderWidth: 1,
          callbacks: {
            title: (items: Array<{ dataIndex: number }>) => fmtMonthLong(months[items[0]?.dataIndex ?? 0]?.month),
            footer: (items: Array<{ dataIndex: number }>) => `Total: ${months[items[0]?.dataIndex ?? 0]?.matches ?? 0} jogos`,
          },
        },
      },
      scales: {
        x: { stacked: true, grid: { display: false }, ticks: { color: t.fgMuted, autoSkip: true, maxRotation: 0 } },
        y: { stacked: true, grid: { color: t.grid }, ticks: { color: t.fgMuted, precision: 0 }, beginAtZero: true },
      },
    };
  }, [months, resolvedTheme]);

  const total = months.reduce((a, m) => a + m.matches, 0);
  return (
    <div>
      <div
        data-no-swipe
        className="h-56 sm:h-64"
        role="img"
        aria-label={`Gráfico de barras empilhadas: ${total} jogos em ${months.length} meses, divididos em vitórias, empates e derrotas. Os números por mês estão na tabela.`}
      >
        <Bar key={resolvedTheme} data={data} options={options as any} />
      </div>
      <details className="mt-3 rounded-lg border border-border bg-surface-raised">
        <summary className="cursor-pointer select-none px-3 py-2 text-sm font-semibold text-fg-secondary rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
          Ver números por mês
        </summary>
        <div className="overflow-x-auto border-t border-border" data-no-swipe>
          <table className="w-full text-sm">
            <caption className="sr-only">Jogos por mês</caption>
            <thead className="text-xs text-fg-muted bg-surface-raised">
              <tr>
                <th scope="col" className="px-3 py-2 text-left font-semibold">Mês</th>
                <th scope="col" className="px-2 py-2 text-right font-semibold">Jogos</th>
                <th scope="col" className="px-2 py-2 text-right font-semibold">V</th>
                <th scope="col" className="px-2 py-2 text-right font-semibold">E</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">D</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {months.map((m) => (
                <tr key={m.month}>
                  <th scope="row" className="px-3 py-1.5 text-left font-medium text-fg">{fmtMonthLong(m.month)}</th>
                  <td className="px-2 py-1.5 text-right tabular-nums">{m.matches}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{m.wins}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{m.draws}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{m.losses}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

/** Série de SR ao longo do período. */
export function SrSeriesChart({
  series,
  peak,
  low,
}: {
  series: Array<{ date: string; value: number }>;
  peak: { value: number; date: string } | null;
  low: { value: number; date: string } | null;
}) {
  const { resolvedTheme } = useTheme();

  const data = useMemo(() => {
    const t = chartTheme();
    return {
      labels: series.map((p) => fmtYmdShort(p.date)),
      datasets: [
        {
          data: series.map((p) => p.value),
          borderColor: t.accent,
          backgroundColor: cssVar("--color-accent", 0.12),
          fill: true,
          borderWidth: 2,
          tension: 0.25,
          pointRadius: series.length > 60 ? 0 : 3,
          pointHoverRadius: 5,
        },
      ],
    };
    // resolvedTheme: relê as cores do tema quando ele troca
  }, [series, resolvedTheme]);

  const options = useMemo(() => {
    const t = chartTheme();
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: false as const,
      interaction: { mode: "nearest" as const, axis: "x" as const, intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: t.surface,
          titleColor: t.fg,
          bodyColor: t.fg,
          borderColor: t.border,
          borderWidth: 1,
          callbacks: {
            title: (items: Array<{ dataIndex: number }>) => fmtYmd(series[items[0]?.dataIndex ?? 0]?.date),
            label: (ctx: { raw: unknown }) => `SR ${fmtNum(typeof ctx.raw === "number" ? ctx.raw : null)}`,
          },
        },
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: t.fgMuted, autoSkip: true, maxTicksLimit: 7, maxRotation: 0 } },
        y: { grace: "10%", grid: { color: t.grid }, ticks: { color: t.fgMuted, precision: 0 } },
      },
    };
  }, [series, resolvedTheme]);

  const first = series[0];
  const last = series[series.length - 1];
  const alt = `Gráfico de linha do skill rating: de ${fmtNum(first?.value)} em ${fmtYmd(first?.date)} para ${fmtNum(
    last?.value
  )} em ${fmtYmd(last?.date)}${peak ? `; pico de ${fmtNum(peak.value)} em ${fmtYmd(peak.date)}` : ""}${
    low ? `; ponto mais baixo de ${fmtNum(low.value)} em ${fmtYmd(low.date)}` : ""
  }.`;

  return (
    <div data-no-swipe className="h-52 sm:h-64" role="img" aria-label={alt}>
      <Line key={resolvedTheme} data={data} options={options as any} />
    </div>
  );
}
