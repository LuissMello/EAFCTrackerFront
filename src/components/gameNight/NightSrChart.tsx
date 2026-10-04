import React, { useMemo } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { Card } from "../ui.tsx";
import { useTheme } from "../../hooks/useTheme.tsx";
import { chartTheme } from "../../utils/themeColors.ts";
import type { GameNightDetail } from "../../types/gameNight";
import { RESULT_TEXT, fmtNum, fmtSigned } from "../../utils/analyticsFormat.ts";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler);

interface Pt {
  label: string;
  value: number | null;
  tip: string;
  result: "W" | "D" | "L" | null;
}

/** Evolução do SR ao longo da noite (um ponto por partida; forma do ponto = resultado). */
export default function NightSrChart({ night }: { night: GameNightDetail }) {
  const { resolvedTheme } = useTheme();

  const points = useMemo<Pt[]>(() => {
    const out: Pt[] = [];
    if (night.skillRating.start != null) {
      out.push({ label: "Início", value: night.skillRating.start, tip: "Antes do 1º jogo", result: null });
    }
    night.matches.forEach((m, i) => {
      out.push({
        label: `J${i + 1}`,
        value: m.skillRatingAfter,
        tip: `${RESULT_TEXT[m.result]} ${m.goalsFor}–${m.goalsAgainst} vs ${m.opponentName ?? "Adversário"}`,
        result: m.result,
      });
    });
    return out;
  }, [night]);

  const known = useMemo(() => points.filter((p) => p.value !== null) as Array<Pt & { value: number }>, [points]);

  const summary = useMemo(() => {
    if (known.length < 2) return null;
    const first = known[0].value;
    const last = known[known.length - 1].value;
    return `SR de ${fmtNum(first)} para ${fmtNum(last)} (${fmtSigned(last - first)}) ao longo de ${night.matches.length} ${
      night.matches.length === 1 ? "partida" : "partidas"
    }.`;
  }, [known, night.matches.length]);

  const data = useMemo(() => {
    const t = chartTheme();
    const colorOf = (r: Pt["result"]) =>
      r === "W" ? t.positive : r === "L" ? t.negative : r === "D" ? t.warning : t.fgMuted;
    const styleOf = (r: Pt["result"]) => (r === "W" ? "circle" : r === "L" ? "triangle" : r === "D" ? "rect" : "rectRot");
    return {
      labels: points.map((p) => p.label),
      datasets: [
        {
          data: points.map((p) => p.value),
          borderColor: t.accent,
          backgroundColor: t.accent,
          borderWidth: 2,
          tension: 0.1,
          spanGaps: false,
          pointRadius: 6,
          pointHoverRadius: 8,
          pointStyle: points.map((p) => styleOf(p.result)),
          pointBackgroundColor: points.map((p) => colorOf(p.result)),
          pointBorderColor: t.surface,
          pointBorderWidth: 1.5,
        },
      ],
    };
    // resolvedTheme: relê as cores do tema quando ele troca
  }, [points, resolvedTheme]);

  const options = useMemo(() => {
    const t = chartTheme();
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: false as const,
      interaction: { mode: "nearest" as const, intersect: false },
      layout: { padding: { top: 8, right: 8 } },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: t.surface,
          titleColor: t.fg,
          bodyColor: t.fg,
          borderColor: t.border,
          borderWidth: 1,
          callbacks: {
            title: (items: Array<{ dataIndex: number }>) => points[items[0]?.dataIndex ?? 0]?.label ?? "",
            label: (ctx: { dataIndex: number; raw: unknown }) => {
              const p = points[ctx.dataIndex];
              return [`SR ${fmtNum(typeof ctx.raw === "number" ? ctx.raw : null)}`, p?.tip ?? ""];
            },
          },
        },
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: t.fgMuted } },
        y: {
          grace: "12%",
          grid: { color: t.grid },
          ticks: { color: t.fgMuted, precision: 0 },
        },
      },
    };
  }, [points, resolvedTheme]);

  return (
    <Card className="p-3 sm:p-4" data-testid="night-sr-chart">
      <div className="flex items-baseline justify-between gap-2 mb-2">
        <h3 className="text-sm font-semibold text-fg-muted uppercase tracking-wide">SR ao longo da noite</h3>
        <span className="text-[11px] text-fg-subtle">● vitória · ■ empate · ▲ derrota</span>
      </div>
      {known.length < 2 ? (
        <p className="text-sm text-fg-muted py-6 text-center">Sem dados de SR suficientes para desenhar o gráfico.</p>
      ) : (
        <>
          <div
            data-no-swipe
            className="h-44 sm:h-56"
            role="img"
            aria-label={`Gráfico de linha. ${summary ?? ""}`}
          >
            <Line key={resolvedTheme} data={data} options={options} />
          </div>
          <ul className="sr-only">
            {points.map((p, i) => (
              <li key={i}>
                {p.label}: SR {fmtNum(p.value)} — {p.tip}
              </li>
            ))}
          </ul>
          {summary && <p className="mt-2 text-xs text-fg-muted">{summary}</p>}
        </>
      )}
    </Card>
  );
}
