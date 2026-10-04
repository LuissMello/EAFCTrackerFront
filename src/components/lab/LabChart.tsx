import React, { useMemo, useRef } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar, Line } from "react-chartjs-2";
import { useTheme } from "../../hooks/useTheme.tsx";
import { chartTheme, cssVar } from "../../utils/themeColors.ts";

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, Tooltip, Legend);

export type SeriesColor = "sign" | "accent" | "muted";

export interface LabChartSeries {
  label: string;
  values: Array<number | null>;
  /** "sign": verde/vermelho conforme o sinal do valor; "accent"/"muted": cor única */
  color: SeriesColor;
}

function toneColor(kind: "positive" | "negative" | "accent" | "muted", alpha: number): string {
  switch (kind) {
    case "positive":
      return cssVar("--color-positive", alpha);
    case "negative":
      return cssVar("--color-negative", alpha);
    case "accent":
      return cssVar("--color-accent", alpha);
    default:
      return cssVar("--color-fg-subtle", alpha);
  }
}

// ---- plugins locais (configurados via chart.options.plugins.*) ----

/**
 * Escreve o valor na ponta de cada barra (sinal e número em texto: a cor não é o único sinal).
 * O formatador vem por ref: o Chart.js trata funções dentro das opções como "scriptable" e as executaria.
 */
function makeValueLabelsPlugin(formatRef: { current: (v: number) => string }) {
  return {
    id: "labValueLabels",
    afterDatasetsDraw(chart: any) {
      const opt = chart.options?.plugins?.labValueLabels;
      if (!opt?.enabled || chart.config.type !== "bar") return;
      const { ctx } = chart;
      const horizontal = chart.options.indexAxis === "y";
      ctx.save();
      ctx.font = "600 11px sans-serif";
      ctx.fillStyle = opt.color;
      chart.data.datasets.forEach((ds: any, di: number) => {
        const meta = chart.getDatasetMeta(di);
        if (meta.hidden) return;
        meta.data.forEach((el: any, i: number) => {
          const v = ds.data[i];
          if (v === null || v === undefined || !Number.isFinite(v)) return;
          const text: string = formatRef.current(v);
          if (horizontal) {
            ctx.textBaseline = "middle";
            ctx.textAlign = v >= 0 ? "left" : "right";
            ctx.fillText(text, el.x + (v >= 0 ? 5 : -5), el.y);
          } else {
            ctx.textAlign = "center";
            ctx.textBaseline = v >= 0 ? "bottom" : "top";
            ctx.fillText(text, el.x, el.y + (v >= 0 ? -3 : 3));
          }
        });
      });
      ctx.restore();
    },
  };
}

/** Linha tracejada de referência (ex.: média do time) com rótulo em texto. */
const baselinePlugin = {
  id: "labBaseline",
  afterDatasetsDraw(chart: any) {
    const opt = chart.options?.plugins?.labBaseline;
    if (!opt?.enabled) return;
    const { ctx, chartArea } = chart;
    const horizontal = chart.options.indexAxis === "y";
    const scale = horizontal ? chart.scales.x : chart.scales.y;
    if (!scale) return;
    const pos = scale.getPixelForValue(opt.value);
    if (!Number.isFinite(pos)) return;
    ctx.save();
    ctx.strokeStyle = opt.color;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    if (horizontal) {
      ctx.moveTo(pos, chartArea.top);
      ctx.lineTo(pos, chartArea.bottom);
    } else {
      ctx.moveTo(chartArea.left, pos);
      ctx.lineTo(chartArea.right, pos);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = "600 10px sans-serif";
    ctx.fillStyle = opt.color;
    if (horizontal) {
      ctx.textAlign = pos > (chartArea.left + chartArea.right) / 2 ? "right" : "left";
      ctx.textBaseline = "top";
      ctx.fillText(opt.label, pos + (ctx.textAlign === "right" ? -4 : 4), chartArea.top + 2);
    } else {
      ctx.textAlign = "right";
      ctx.textBaseline = "bottom";
      ctx.fillText(opt.label, chartArea.right - 2, pos - 3);
    }
    ctx.restore();
  },
};


export interface LabChartProps {
  type?: "bar" | "line";
  labels: Array<string | string[]>;
  series: LabChartSeries[];
  /** Opacidade por índice (confiabilidade da amostra) */
  alphas?: number[];
  horizontal?: boolean;
  /** Linha de referência */
  baseline?: { value: number; label: string } | null;
  /** Formata o valor nos rótulos/eixo */
  format: (v: number) => string;
  /** Linhas extras do tooltip */
  tooltip?: (seriesIndex: number, index: number) => string[];
  /** Título do tooltip */
  tooltipTitle?: (index: number) => string;
  /** Descrição textual do gráfico (leitores de tela) */
  ariaLabel: string;
  /** Mostra legenda (útil com 2+ séries) */
  legend?: boolean;
  /** Altura fixa em px; senão calculada pelo número de barras */
  height?: number;
}

/** Gráfico (barras/linha) do Laboratório, com cores do tema, rótulos de valor e linha de referência. */
export default function LabChart({
  type = "bar",
  labels,
  series,
  alphas,
  horizontal = false,
  baseline = null,
  format,
  tooltip,
  tooltipTitle,
  ariaLabel,
  legend = false,
  height,
}: LabChartProps) {
  const { resolvedTheme } = useTheme();
  const isLine = type === "line";
  const formatRef = useRef(format);
  formatRef.current = format;
  const plugins = useMemo(() => [makeValueLabelsPlugin(formatRef), baselinePlugin], []);

  const data = useMemo(() => {
    const t = chartTheme();
    return {
      labels,
      datasets: series.map((s) => {
        const a = (i: number) => alphas?.[i] ?? 1;
        const base = (i: number) => {
          const v = s.values[i];
          if (s.color === "sign") return toneColor(v !== null && v < 0 ? "negative" : "positive", a(i));
          return toneColor(s.color, a(i));
        };
        if (isLine) {
          return {
            label: s.label,
            data: s.values,
            borderColor: toneColor(s.color === "sign" ? "accent" : s.color, 1),
            backgroundColor: toneColor(s.color === "sign" ? "accent" : s.color, 1),
            borderWidth: 2,
            tension: 0.2,
            pointRadius: 5,
            pointHoverRadius: 7,
            pointBackgroundColor: s.values.map((_, i) => base(i)),
            pointBorderColor: t.surface,
            spanGaps: false,
          };
        }
        return {
          label: s.label,
          data: s.values,
          backgroundColor: s.values.map((_, i) => base(i)),
          borderColor: s.values.map((_, i) => toneColor(
            s.color === "sign" ? ((s.values[i] ?? 0) < 0 ? "negative" : "positive") : s.color,
            1
          )),
          borderWidth: 1,
          borderRadius: 4,
          maxBarThickness: 28,
          categoryPercentage: 0.8,
        };
      }),
    };
    // resolvedTheme: relê as cores do tema quando ele troca
  }, [labels, series, alphas, isLine, resolvedTheme]);

  const options = useMemo(() => {
    const t = chartTheme();
    const valueAxis = {
      grid: { color: t.grid },
      border: { display: false },
      grace: "14%",
      ticks: { color: t.fgMuted, callback: (v: number | string) => format(Number(v)) },
    };
    const catAxis = {
      grid: { display: false },
      ticks: { color: t.fgMuted, autoSkip: true, maxRotation: 0 },
    };
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: false as const,
      indexAxis: horizontal && !isLine ? ("y" as const) : ("x" as const),
      interaction: { mode: "nearest" as const, axis: horizontal ? ("y" as const) : ("x" as const), intersect: false },
      layout: { padding: { top: horizontal ? 16 : 20, right: horizontal ? 36 : 8 } },
      plugins: {
        legend: { display: legend, position: "bottom" as const, labels: { color: t.fg, boxWidth: 12 } },
        tooltip: {
          backgroundColor: t.surface,
          titleColor: t.fg,
          bodyColor: t.fg,
          borderColor: t.border,
          borderWidth: 1,
          padding: 10,
          callbacks: {
            title: (items: Array<{ dataIndex: number }>) => {
              const i = items[0]?.dataIndex ?? 0;
              if (tooltipTitle) return tooltipTitle(i);
              const l = labels[i];
              return Array.isArray(l) ? l.join(" · ") : String(l ?? "");
            },
            label: (ctx: { datasetIndex: number; dataIndex: number; raw: unknown; dataset: { label?: string } }) => {
              const v = typeof ctx.raw === "number" ? format(ctx.raw) : "—";
              const head = series.length > 1 ? `${ctx.dataset.label ?? ""}: ${v}` : v;
              return [head, ...(tooltip ? tooltip(ctx.datasetIndex, ctx.dataIndex) : [])];
            },
          },
        },
        labValueLabels: { enabled: !isLine, color: t.fg },
        labBaseline: baseline
          ? { enabled: true, value: baseline.value, label: baseline.label, color: t.fgMuted }
          : { enabled: false },
      },
      scales: horizontal && !isLine ? { x: valueAxis, y: catAxis } : { x: catAxis, y: valueAxis },
    };
  }, [horizontal, isLine, legend, format, labels, series.length, tooltip, tooltipTitle, baseline, resolvedTheme]);

  const barCount = labels.length;
  const h =
    height ??
    (horizontal && !isLine ? Math.max(180, barCount * (series.length * 18 + 14) + 56) : 240);

  return (
    <div data-no-swipe className="relative w-full" style={{ height: h }} role="img" aria-label={ariaLabel}>
      {isLine ? (
        <Line key={resolvedTheme} data={data as any} options={options as any} plugins={plugins} />
      ) : (
        <Bar key={resolvedTheme} data={data as any} options={options as any} plugins={plugins} />
      )}
    </div>
  );
}
