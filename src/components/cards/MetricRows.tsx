import React from "react";
import { Check, Equal } from "lucide-react";
import type { CompareMetric } from "../../types/playerCards";
import { SERIES_COLORS, formatMetricValue, isScoreMetric } from "../../utils/playerCards.ts";

type Side = "a" | "b";

function SeriesMark({ side }: { side: Side }) {
  const color = `rgb(var(${SERIES_COLORS[side]}))`;
  return (
    <svg width="22" height="10" viewBox="0 0 22 10" aria-hidden="true" className="flex-shrink-0">
      <line x1="1" y1="5" x2="21" y2="5" strokeWidth={3} strokeDasharray={side === "b" ? "5 3" : undefined} style={{ stroke: color }} />
      {side === "b" ? <rect x="7.5" y="1.5" width="7" height="7" style={{ fill: color }} /> : <circle cx="11" cy="5" r="3.5" style={{ fill: color }} />}
    </svg>
  );
}

function ValueCell({
  side,
  metric,
  className = "",
}: {
  side: Side;
  metric: CompareMetric;
  className?: string;
}) {
  const v = metric[side];
  const won = metric.winner === side;
  const tied = metric.winner === "tie" && v !== null;
  const color = `rgb(var(${SERIES_COLORS[side]}))`;
  const showBar = isScoreMetric(metric.key) && v !== null && Number.isFinite(v);
  return (
    <div
      className={`flex min-w-0 flex-col items-center gap-1 rounded-lg px-2 py-1.5 ${
        won ? "bg-positive-soft text-positive-fg ring-1 ring-positive/40" : "text-fg"
      } ${className}`}
    >
      <div className="flex items-center gap-1.5">
        {won && <Check size={15} strokeWidth={3} aria-hidden="true" className="flex-shrink-0" />}
        {tied && <Equal size={14} strokeWidth={3} aria-hidden="true" className="flex-shrink-0 text-fg-muted" />}
        <span className={`text-lg tabular-nums leading-none ${won ? "font-black" : "font-semibold"}`}>{formatMetricValue(metric.key, v)}</span>
        {won && <span className="sr-only"> (melhor)</span>}
        {tied && <span className="sr-only"> (empate)</span>}
      </div>
      {showBar && (
        <span aria-hidden="true" className="block h-1.5 w-full max-w-[9rem] overflow-hidden rounded-full bg-surface-sunken">
          <span className="block h-full rounded-full" style={{ width: `${Math.max(2, Math.min(100, ((v as number) / 99) * 100))}%`, background: color }} />
        </span>
      )}
    </div>
  );
}

/** Linhas de métricas lado a lado: vencedor com ícone + texto para leitores de tela (nunca só cor). */
export const MetricRows = React.memo(function MetricRows({
  title,
  metrics,
  nameA,
  nameB,
}: {
  title: string;
  metrics: CompareMetric[];
  nameA: string;
  nameB: string;
}) {
  if (metrics.length === 0) return null;
  return (
    <section aria-label={title}>
      <h3 className="mb-2 font-display text-sm font-bold uppercase tracking-widest text-fg-subtle">{title}</h3>
      <div className="mb-1 grid grid-cols-2 gap-2 px-2 text-xs font-semibold text-fg-secondary sm:grid-cols-[1fr_minmax(9rem,auto)_1fr]">
        <span className="inline-flex min-w-0 items-center justify-center gap-1.5 sm:order-1">
          <SeriesMark side="a" />
          <span className="truncate">{nameA}</span>
        </span>
        <span aria-hidden="true" className="hidden sm:order-2 sm:block" />
        <span className="inline-flex min-w-0 items-center justify-center gap-1.5 sm:order-3">
          <SeriesMark side="b" />
          <span className="truncate">{nameB}</span>
        </span>
      </div>
      <ul className="divide-y divide-border rounded-xl border border-border">
        {metrics.map((m) => (
          <li
            key={m.key}
            className="grid grid-cols-2 items-center gap-x-2 gap-y-0.5 px-1 py-1.5 sm:grid-cols-[1fr_minmax(9rem,auto)_1fr]"
          >
            <span className="col-span-2 px-1 text-center text-xs font-semibold uppercase tracking-wide text-fg-muted sm:order-2 sm:col-span-1">
              {m.label}
              {!m.higherIsBetter && <span className="block text-[10px] font-medium normal-case tracking-normal text-fg-subtle">menos é melhor</span>}
              {m.winner === "tie" && <span className="block text-[10px] font-medium normal-case tracking-normal text-fg-subtle">empate</span>}
              {m.winner === null && <span className="sr-only"> (sem comparação)</span>}
            </span>
            <ValueCell side="a" metric={m} className="sm:order-1" />
            <ValueCell side="b" metric={m} className="sm:order-3" />
          </li>
        ))}
      </ul>
    </section>
  );
});
