import React, { useId, useState } from "react";
import { ChevronDown, Table2 } from "lucide-react";
import { fmtScore, scoreOrNull } from "../../utils/playerCards.ts";

export interface RadarSeries {
  id: string;
  label: string;
  /** Mesma ordem de `axes`; null = sem nota (o vértice fica no centro e não recebe marcador) */
  values: Array<number | null>;
  /** Token CSS de cor (ex.: "--color-accent") */
  cssVar: string;
  /** Traço tracejado + marcador quadrado (distingue a série B sem depender só da cor) */
  alt?: boolean;
}

export interface RadarAxis {
  key: string;
  short: string;
  name: string;
}

const SIZE_W = 320;
const SIZE_H = 292;
const CX = SIZE_W / 2;
const CY = 146;
const R = 96;
const MAX = 99;
const RINGS = [25, 50, 75, 99];

const angleFor = (i: number, n: number) => (Math.PI * 2 * i) / n - Math.PI / 2;
const point = (r: number, a: number) => ({ x: CX + r * Math.cos(a), y: CY + r * Math.sin(a) });

function radiusFor(v: number | null): number {
  const n = scoreOrNull(v);
  return n === null ? 0 : (Math.max(0, Math.min(MAX, n)) / MAX) * R;
}

/** Radar em SVG (notas 0–99, escala fixa), com cores do tema. Uma ou duas séries. */
export const RadarChart = React.memo(function RadarChart({
  axes,
  series,
  ariaLabel,
  showValues = false,
}: {
  axes: RadarAxis[];
  series: RadarSeries[];
  ariaLabel: string;
  /** Escreve a nota de cada eixo junto ao rótulo (uma série só) */
  showValues?: boolean;
}) {
  const n = axes.length;
  if (n < 3) return null;

  const ringPath = (frac: number) =>
    axes
      .map((_, i) => {
        const p = point(R * frac, angleFor(i, n));
        return `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`;
      })
      .join(" ") + " Z";

  return (
    <svg viewBox={`0 0 ${SIZE_W} ${SIZE_H}`} role="img" aria-label={ariaLabel} className="mx-auto block h-auto w-full max-w-md">
      <g fill="none" style={{ stroke: "rgb(var(--color-border-strong))" }} strokeWidth={1}>
        {RINGS.map((v) => (
          <path key={v} d={ringPath(v / MAX)} strokeDasharray={v === 99 ? undefined : "2 3"} />
        ))}
        {axes.map((_, i) => {
          const p = point(R, angleFor(i, n));
          return <line key={i} x1={CX} y1={CY} x2={p.x} y2={p.y} />;
        })}
      </g>
      <text x={CX + 3} y={CY - R * (50 / MAX) - 2} fontSize={9} style={{ fill: "rgb(var(--color-fg-subtle))" }}>
        50
      </text>

      {series.map((s) => {
        const pts = s.values.map((v, i) => {
          const p = point(radiusFor(v), angleFor(i, n));
          return { ...p, has: scoreOrNull(v) !== null };
        });
        const d = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ") + " Z";
        const color = `rgb(var(${s.cssVar}))`;
        return (
          <g key={s.id}>
            <path
              d={d}
              strokeWidth={2.25}
              strokeLinejoin="round"
              strokeDasharray={s.alt ? "7 4" : undefined}
              style={{ fill: color, fillOpacity: s.alt ? 0.1 : 0.22, stroke: color }}
            />
            {pts.map((p, i) =>
              !p.has ? null : s.alt ? (
                <rect key={i} x={p.x - 3.5} y={p.y - 3.5} width={7} height={7} style={{ fill: color, stroke: "rgb(var(--color-surface))" }} strokeWidth={1.5} />
              ) : (
                <circle key={i} cx={p.x} cy={p.y} r={3.75} style={{ fill: color, stroke: "rgb(var(--color-surface))" }} strokeWidth={1.5} />
              )
            )}
          </g>
        );
      })}

      {axes.map((a, i) => {
        const ang = angleFor(i, n);
        const p = point(R + 18, ang);
        const cos = Math.cos(ang);
        const anchor = Math.abs(cos) < 0.25 ? "middle" : cos > 0 ? "start" : "end";
        const single = showValues && series.length === 1 ? series[0].values[i] : undefined;
        return (
          <text key={a.key} x={p.x} y={p.y} textAnchor={anchor} dominantBaseline="middle" fontSize={12} fontWeight={700} style={{ fill: "rgb(var(--color-fg-secondary))" }}>
            {a.short}
            {single !== undefined && (
              <tspan x={p.x} dy="1.25em" fontSize={13} fontWeight={800} style={{ fill: "rgb(var(--color-fg))" }}>
                {fmtScore(single)}
              </tspan>
            )}
          </text>
        );
      })}
    </svg>
  );
});

/** Legenda com amostra de linha (sólida x tracejada) + nome. */
export function RadarLegend({ series }: { series: RadarSeries[] }) {
  return (
    <ul className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 text-sm font-semibold text-fg-secondary">
      {series.map((s) => (
        <li key={s.id} className="inline-flex min-w-0 items-center gap-2">
          <svg width="28" height="10" viewBox="0 0 28 10" aria-hidden="true" className="flex-shrink-0">
            <line x1="1" y1="5" x2="27" y2="5" strokeWidth={3} strokeDasharray={s.alt ? "6 3" : undefined} style={{ stroke: `rgb(var(${s.cssVar}))` }} />
            {s.alt ? (
              <rect x="10" y="1.5" width="7" height="7" style={{ fill: `rgb(var(${s.cssVar}))` }} />
            ) : (
              <circle cx="14" cy="5" r="3.5" style={{ fill: `rgb(var(${s.cssVar}))` }} />
            )}
          </svg>
          <span className="truncate">{s.label}</span>
        </li>
      ))}
    </ul>
  );
}

/** Tabela com as mesmas notas do radar (alternativa em texto). */
export function RadarTable({ axes, series, caption }: { axes: RadarAxis[]; series: RadarSeries[]; caption: string }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-surface-raised text-xs uppercase tracking-wide text-fg-muted">
          <tr>
            <th scope="col" className="px-3 py-2 text-left font-semibold">Eixo</th>
            {series.map((s) => (
              <th key={s.id} scope="col" className="px-3 py-2 text-right font-semibold">
                {s.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {axes.map((a, i) => (
            <tr key={a.key}>
              <th scope="row" className="px-3 py-1.5 text-left font-medium text-fg-secondary">
                {a.name} <span className="text-fg-subtle">({a.short})</span>
              </th>
              {series.map((s) => (
                <td key={s.id} className="px-3 py-1.5 text-right font-semibold tabular-nums text-fg">
                  {fmtScore(s.values[i])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Radar + legenda + botão "Ver números" (tabela) — usado no detalhe e no comparador. */
export function RadarWithTable({
  axes,
  series,
  ariaLabel,
  showValues = false,
  showLegend = false,
}: {
  axes: RadarAxis[];
  series: RadarSeries[];
  ariaLabel: string;
  showValues?: boolean;
  showLegend?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  return (
    <div className="space-y-3">
      <RadarChart axes={axes} series={series} ariaLabel={ariaLabel} showValues={showValues} />
      {showLegend && <RadarLegend series={series} />}
      <div className="flex justify-center">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((v) => !v)}
          className="btn btn-secondary min-h-[44px]"
        >
          <Table2 size={16} aria-hidden="true" />
          {open ? "Ocultar números" : "Ver números"}
          <ChevronDown size={14} aria-hidden="true" className={open ? "rotate-180" : ""} />
        </button>
      </div>
      <div id={panelId} hidden={!open}>
        {open && <RadarTable axes={axes} series={series} caption={`Notas por eixo (0 a 99): ${series.map((s) => s.label).join(" e ")}`} />}
      </div>
    </div>
  );
}
