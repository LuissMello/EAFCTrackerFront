import React from "react";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import type { LabStats, Reliability } from "../../types/lab";
import { fmtNum, fmtPct, fmtSigned } from "../../utils/analyticsFormat.ts";

/** Métricas comparáveis entre os recortes do Laboratório. */
export type LabMetric = "win" | "points" | "goalDiff";

export const METRIC_OPTIONS: Array<{ value: LabMetric; label: string; short: string }> = [
  { value: "win", label: "Aproveitamento (% de vitórias)", short: "% vitórias" },
  { value: "points", label: "Pontos por jogo", short: "pontos/jogo" },
  { value: "goalDiff", label: "Saldo de gols por jogo", short: "saldo/jogo" },
];

export function metricValue(s: LabStats, m: LabMetric): number {
  if (m === "win") return s.winRatePct;
  if (m === "points") return s.pointsPerMatch;
  return s.goalsForPerMatch - s.goalsAgainstPerMatch;
}

/** Valor absoluto formatado (ex.: "54%", "1,85", "+0,40"). */
export function formatMetric(m: LabMetric, v: number): string {
  if (m === "win") return fmtPct(v, 0);
  if (m === "points") return fmtNum(v, 2);
  return fmtSigned(v, 2);
}

/** Diferença formatada (ex.: "+6,5 p.p.", "−0,30"). */
export function formatDelta(m: LabMetric, v: number): string {
  if (m === "win") return `${fmtSigned(v, 1)} p.p.`;
  return fmtSigned(v, 2);
}

export function metricShort(m: LabMetric): string {
  return METRIC_OPTIONS.find((o) => o.value === m)?.short ?? "";
}

/** Mesma regra do backend (por tamanho da menor amostra): < 5 pequena, < 12 média, senão boa. */
export function reliabilityOf(matches: number): Reliability {
  return matches < 5 ? "low" : matches < 12 ? "medium" : "high";
}

export const RELIABILITY_TEXT: Record<Reliability, string> = {
  low: "amostra pequena",
  medium: "amostra média",
  high: "amostra boa",
};

/** Opacidade das barras: amostras pequenas ficam mais "apagadas" (além do rótulo em texto). */
export const RELIABILITY_ALPHA: Record<Reliability, number> = { low: 0.4, medium: 0.7, high: 1 };

export function ReliabilityBadge({ value, className = "" }: { value: Reliability; className?: string }) {
  const cfg =
    value === "low"
      ? { cls: "bg-warning-soft text-warning-fg border-warning/30", Icon: AlertTriangle }
      : value === "medium"
        ? { cls: "bg-surface-sunken text-fg-secondary border-border-strong", Icon: Info }
        : { cls: "bg-positive-soft text-positive-fg border-positive/30", Icon: CheckCircle2 };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-semibold whitespace-nowrap ${cfg.cls} ${className}`}
    >
      <cfg.Icon size={12} aria-hidden="true" />
      {RELIABILITY_TEXT[value]}
    </span>
  );
}

/** Linha de texto com os números de um bloco de estatísticas. */
export function statsLine(s: LabStats | null | undefined): string {
  if (!s) return "sem jogos";
  return `${s.matches} ${s.matches === 1 ? "jogo" : "jogos"} · ${fmtPct(s.winRatePct, 0)} V · ${fmtNum(s.pointsPerMatch, 2)} pts/jogo · saldo ${fmtSigned(
    s.goalsForPerMatch - s.goalsAgainstPerMatch,
    2
  )}`;
}

/** Tabela genérica (recurso de texto para os gráficos): rótulo + números principais. */
export function StatsTable({
  caption,
  rows,
  baseline,
}: {
  caption: string;
  rows: Array<{ key: string | number; label: string; stats: LabStats; extra?: string }>;
  baseline?: LabStats;
}) {
  return (
    <div className="overflow-x-auto scroll-touch-x" data-no-swipe>
      <table className="w-full text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="text-xs text-fg-muted bg-surface-raised">
          <tr>
            <th scope="col" className="px-3 py-2 text-left font-semibold">Grupo</th>
            <th scope="col" className="px-2 py-2 text-right font-semibold">Jogos</th>
            <th scope="col" className="px-2 py-2 text-right font-semibold">V-E-D</th>
            <th scope="col" className="px-2 py-2 text-right font-semibold">% V</th>
            <th scope="col" className="px-2 py-2 text-right font-semibold">Pts/jogo</th>
            <th scope="col" className="px-2 py-2 text-right font-semibold">Saldo/jogo</th>
            <th scope="col" className="px-3 py-2 text-left font-semibold">Amostra</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r) => (
            <tr key={r.key}>
              <th scope="row" className="px-3 py-2 text-left font-medium text-fg whitespace-nowrap">
                {r.label}
                {r.extra && <span className="ml-1.5 text-[11px] font-normal text-fg-subtle">{r.extra}</span>}
              </th>
              <td className="px-2 py-2 text-right tabular-nums">{r.stats.matches}</td>
              <td className="px-2 py-2 text-right tabular-nums whitespace-nowrap">
                {r.stats.wins}-{r.stats.draws}-{r.stats.losses}
              </td>
              <td className="px-2 py-2 text-right tabular-nums">{fmtPct(r.stats.winRatePct, 0)}</td>
              <td className="px-2 py-2 text-right tabular-nums">{fmtNum(r.stats.pointsPerMatch, 2)}</td>
              <td className="px-2 py-2 text-right tabular-nums">
                {fmtSigned(r.stats.goalsForPerMatch - r.stats.goalsAgainstPerMatch, 2)}
              </td>
              <td className="px-3 py-2">
                <ReliabilityBadge value={reliabilityOf(r.stats.matches)} />
              </td>
            </tr>
          ))}
          {baseline && (
            <tr className="bg-surface-raised">
              <th scope="row" className="px-3 py-2 text-left font-semibold text-fg-secondary">Time em geral</th>
              <td className="px-2 py-2 text-right tabular-nums">{baseline.matches}</td>
              <td className="px-2 py-2 text-right tabular-nums whitespace-nowrap">
                {baseline.wins}-{baseline.draws}-{baseline.losses}
              </td>
              <td className="px-2 py-2 text-right tabular-nums">{fmtPct(baseline.winRatePct, 0)}</td>
              <td className="px-2 py-2 text-right tabular-nums">{fmtNum(baseline.pointsPerMatch, 2)}</td>
              <td className="px-2 py-2 text-right tabular-nums">
                {fmtSigned(baseline.goalsForPerMatch - baseline.goalsAgainstPerMatch, 2)}
              </td>
              <td className="px-3 py-2 text-fg-subtle">referência</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
