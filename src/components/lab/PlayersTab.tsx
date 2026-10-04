import React, { useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowDown, ArrowUp } from "lucide-react";
import { Card, Skeleton } from "../ui.tsx";
import { SelectField } from "../match/SelectField.tsx";
import { EmptyPanel, ErrorPanel } from "../analytics/Controls.tsx";
import LabChart, { type LabChartSeries } from "./LabChart.tsx";
import {
  METRIC_OPTIONS,
  RELIABILITY_ALPHA,
  ReliabilityBadge,
  formatDelta,
  formatMetric,
  metricShort,
  metricValue,
  statsLine,
  type LabMetric,
} from "./labShared.tsx";
import type { LabStats, PlayerImpactResponse, PlayerImpactRow } from "../../types/lab";
import type { ResourceError } from "../../hooks/useApiResource.ts";
import { fmtNum, fmtPct } from "../../utils/analyticsFormat.ts";

type View = "delta" | "withwithout";
type SortKey = "name" | "with" | "without" | "dWin" | "dPts" | "dGd" | "reliability";

const REL_ORDER = { low: 0, medium: 1, high: 2 } as const;

function deltaOf(r: PlayerImpactRow, m: LabMetric): number | null {
  if (!r.delta) return null;
  if (m === "win") return r.delta.winRatePct;
  if (m === "points") return r.delta.pointsPerMatch;
  return r.delta.goalDiffPerMatch;
}

function SortableTh({
  label,
  col,
  sortKey,
  dir,
  onSort,
  align = "right",
}: {
  label: string;
  col: SortKey;
  sortKey: SortKey;
  dir: "asc" | "desc";
  onSort: (c: SortKey) => void;
  align?: "left" | "right";
}) {
  const active = sortKey === col;
  return (
    <th
      scope="col"
      aria-sort={active ? (dir === "desc" ? "descending" : "ascending") : "none"}
      className={`px-2.5 py-2 font-semibold whitespace-nowrap ${align === "left" ? "text-left" : "text-right"}`}
    >
      <button
        type="button"
        onClick={() => onSort(col)}
        className="inline-flex items-center gap-1 font-semibold hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded"
      >
        {label}
        {active ? dir === "desc" ? <ArrowDown size={12} aria-hidden="true" /> : <ArrowUp size={12} aria-hidden="true" /> : null}
      </button>
    </th>
  );
}

function DeltaCell({ v, kind }: { v: number | null; kind: LabMetric }) {
  if (v === null) return <span className="text-fg-subtle">—</span>;
  const tone = v > 0 ? "text-positive-fg" : v < 0 ? "text-negative-fg" : "text-fg-muted";
  const Icon = v > 0 ? ArrowUp : v < 0 ? ArrowDown : null;
  return (
    <span className={`inline-flex items-center gap-0.5 font-semibold tabular-nums whitespace-nowrap ${tone}`}>
      {Icon && <Icon size={11} aria-hidden="true" />}
      {formatDelta(kind, v)}
    </span>
  );
}

function sortRows(rows: PlayerImpactRow[], key: SortKey, dir: "asc" | "desc"): PlayerImpactRow[] {
  const val = (r: PlayerImpactRow): number | string | null => {
    switch (key) {
      case "name":
        return r.name.toLowerCase();
      case "with":
        return r.with.matches;
      case "without":
        return r.without?.matches ?? null;
      case "dWin":
        return r.delta?.winRatePct ?? null;
      case "dPts":
        return r.delta?.pointsPerMatch ?? null;
      case "dGd":
        return r.delta?.goalDiffPerMatch ?? null;
      default:
        return REL_ORDER[r.reliability];
    }
  };
  const mul = dir === "desc" ? -1 : 1;
  return [...rows].sort((a, b) => {
    const av = val(a);
    const bv = val(b);
    if (av === null && bv === null) return 0;
    if (av === null) return 1; // nulos sempre por último
    if (bv === null) return -1;
    if (typeof av === "string" && typeof bv === "string") return av.localeCompare(bv, "pt-BR") * mul;
    return ((av as number) - (bv as number)) * mul;
  });
}

function StatBlock({ s }: { s: LabStats | null }) {
  if (!s) return <span className="text-fg-subtle">nunca ficou de fora</span>;
  return (
    <span className="tabular-nums whitespace-nowrap">
      <span className="font-semibold text-fg">{s.matches}</span> j · {fmtPct(s.winRatePct, 0)} · {fmtNum(s.pointsPerMatch, 2)} pts
    </span>
  );
}

export default function PlayersTab({
  data,
  loading,
  error,
  onRetry,
  minMatches,
}: {
  data: PlayerImpactResponse | null;
  loading: boolean;
  error: ResourceError | null;
  onRetry: () => void;
  minMatches: number;
}) {
  const [metric, setMetric] = useState<LabMetric>("points");
  const [view, setView] = useState<View>("delta");
  const [sortKey, setSortKey] = useState<SortKey>("dPts");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const onSort = useCallback((c: SortKey) => {
    setSortKey((prev) => {
      if (prev === c) {
        setSortDir((d) => (d === "desc" ? "asc" : "desc"));
        return prev;
      }
      setSortDir(c === "name" ? "asc" : "desc");
      return c;
    });
  }, []);

  const players = data?.players;
  const sorted = useMemo(() => (players ? sortRows(players, sortKey, sortDir) : []), [players, sortKey, sortDir]);

  // Gráfico: jogadores com diferença calculável, ordenados pela métrica escolhida (maior primeiro)
  const chartRows = useMemo(() => {
    const rows = (players ?? []).filter((p) => p.delta !== null);
    if (view === "delta") {
      return [...rows].sort((a, b) => (deltaOf(b, metric) ?? 0) - (deltaOf(a, metric) ?? 0));
    }
    return [...rows].sort((a, b) => metricValue(b.with, metric) - metricValue(a.with, metric));
  }, [players, metric, view]);

  const labels = useMemo(
    () => chartRows.map((p) => (p.reliability === "low" ? `${p.name} ⚠` : p.name)),
    [chartRows]
  );
  const alphas = useMemo(() => chartRows.map((p) => RELIABILITY_ALPHA[p.reliability]), [chartRows]);

  const series = useMemo<LabChartSeries[]>(() => {
    if (view === "delta") {
      return [{ label: `Diferença (${metricShort(metric)})`, color: "sign", values: chartRows.map((p) => deltaOf(p, metric)) }];
    }
    return [
      { label: "Com o jogador", color: "accent", values: chartRows.map((p) => metricValue(p.with, metric)) },
      {
        label: "Sem o jogador",
        color: "muted",
        values: chartRows.map((p) => (p.without ? metricValue(p.without, metric) : null)),
      },
    ];
  }, [chartRows, metric, view]);

  const format = useCallback(
    (v: number) => (view === "delta" ? formatDelta(metric, v) : formatMetric(metric, v)),
    [metric, view]
  );

  const tooltip = useCallback(
    (_s: number, i: number) => {
      const p = chartRows[i];
      if (!p) return [];
      const lines = [`Com: ${statsLine(p.with)}`, `Sem: ${p.without ? statsLine(p.without) : "nunca ficou de fora"}`, `Amostra: ${p.reliability === "low" ? "pequena" : p.reliability === "medium" ? "média" : "boa"}`];
      if (p.note) lines.push(p.note);
      return lines;
    },
    [chartRows]
  );

  const baseline = useMemo(() => {
    if (!data) return null;
    if (view === "delta") return null; // a linha 0 já é a referência
    return { value: metricValue(data.baseline, metric), label: `Time em geral: ${formatMetric(metric, metricValue(data.baseline, metric))}` };
  }, [data, view, metric]);

  const ariaLabel = useMemo(() => {
    if (chartRows.length === 0) return "Sem jogadores para comparar.";
    const top = chartRows[0];
    return `Gráfico de barras com ${chartRows.length} jogadores (${view === "delta" ? "diferença com e sem o jogador" : "com e sem o jogador"}, ${metricShort(metric)}). Primeiro: ${top.name}. Os números completos estão na tabela abaixo.`;
  }, [chartRows, metric, view]);

  if (error) return <ErrorPanel message={error.message} onRetry={onRetry} />;
  if (loading || !data) {
    return (
      <div className="space-y-3" role="status" aria-busy="true">
        <span className="sr-only">Carregando jogadores…</span>
        <Skeleton className="h-64 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
      </div>
    );
  }
  if (data.totalMatches === 0) {
    return <EmptyPanel icon="🧪" title="Sem partidas neste período" message="Ajuste o período ou a versão do jogo nos filtros." />;
  }
  if (data.players.length === 0) {
    return (
      <EmptyPanel
        icon="🧪"
        title="Nenhum jogador com jogos suficientes"
        message={`Ninguém tem ${minMatches}+ partidas neste recorte. Diminua o mínimo de jogos ou amplie o período.`}
      />
    );
  }

  return (
    <div className="space-y-4">
      <Card className="p-3 sm:p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label="Tipo de gráfico" className="inline-flex rounded-lg border border-border-strong overflow-hidden">
            {([
              ["delta", "Diferença"],
              ["withwithout", "Com e sem"],
            ] as Array<[View, string]>).map(([v, label]) => (
              <button
                key={v}
                type="button"
                aria-pressed={view === v}
                onClick={() => setView(v)}
                className={`px-3 h-9 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent ${
                  view === v ? "bg-accent text-accent-fg" : "bg-surface text-fg-secondary hover:bg-surface-sunken"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <SelectField label="Métrica" value={metric} onChange={(e) => setMetric(e.target.value as LabMetric)}>
            {METRIC_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </SelectField>
        </div>

        <p className="text-xs text-fg-muted">
          {view === "delta"
            ? `Quanto o time rende a mais (+) ou a menos (−) nas partidas em que o jogador joga, comparado às partidas sem ele (${metricShort(metric)}).`
            : `${metricShort(metric)} do time nas partidas com e sem o jogador; a linha tracejada é o desempenho geral do time.`}{" "}
          <span className="whitespace-nowrap">⚠ = amostra pequena; barras mais claras = menos jogos.</span>
        </p>

        {chartRows.length > 0 ? (
          <LabChart
            horizontal
            labels={labels}
            series={series}
            alphas={view === "delta" ? alphas : undefined}
            baseline={baseline}
            format={format}
            tooltip={tooltip}
            legend={view === "withwithout"}
            ariaLabel={ariaLabel}
          />
        ) : (
          <p className="text-sm text-fg-muted py-4 text-center">
            Todos os jogadores participaram de todas as partidas do recorte, então não há "sem" para comparar.
          </p>
        )}

        <div className="text-xs text-fg-muted border-t border-border pt-2">
          <span className="font-semibold text-fg-secondary">Time em geral:</span> {statsLine(data.baseline)} (
          {data.totalMatches} {data.totalMatches === 1 ? "partida" : "partidas"} no recorte)
        </div>
      </Card>

      {/* Tabela (desktop) */}
      <Card className="hidden sm:block overflow-hidden">
        <div className="overflow-x-auto scroll-touch-x" data-no-swipe>
          <table className="w-full text-sm">
            <caption className="sr-only">
              Impacto de cada jogador: desempenho do time com e sem ele, diferenças e confiabilidade da amostra.
            </caption>
            <thead className="bg-surface-raised text-xs text-fg-muted">
              <tr>
                <SortableTh label="Jogador" col="name" sortKey={sortKey} dir={sortDir} onSort={onSort} align="left" />
                <SortableTh label="Com" col="with" sortKey={sortKey} dir={sortDir} onSort={onSort} />
                <SortableTh label="Sem" col="without" sortKey={sortKey} dir={sortDir} onSort={onSort} />
                <SortableTh label="Δ % V" col="dWin" sortKey={sortKey} dir={sortDir} onSort={onSort} />
                <SortableTh label="Δ pts/jogo" col="dPts" sortKey={sortKey} dir={sortDir} onSort={onSort} />
                <SortableTh label="Δ saldo/jogo" col="dGd" sortKey={sortKey} dir={sortDir} onSort={onSort} />
                <SortableTh label="Amostra" col="reliability" sortKey={sortKey} dir={sortDir} onSort={onSort} align="left" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sorted.map((p) => (
                <tr key={p.playerEntityId} className="align-top hover:bg-surface-raised">
                  <th scope="row" className="px-3 py-2 text-left font-medium text-fg">
                    <Link to={`/player/${p.playerEntityId}`} className="hover:text-accent transition-colors">
                      {p.name}
                    </Link>
                    {p.note && <div className="mt-0.5 max-w-[16rem] text-[11px] font-normal text-fg-subtle">{p.note}</div>}
                  </th>
                  <td className="px-2.5 py-2 text-right text-xs"><StatBlock s={p.with} /></td>
                  <td className="px-2.5 py-2 text-right text-xs"><StatBlock s={p.without} /></td>
                  <td className="px-2.5 py-2 text-right"><DeltaCell v={p.delta?.winRatePct ?? null} kind="win" /></td>
                  <td className="px-2.5 py-2 text-right"><DeltaCell v={p.delta?.pointsPerMatch ?? null} kind="points" /></td>
                  <td className="px-2.5 py-2 text-right"><DeltaCell v={p.delta?.goalDiffPerMatch ?? null} kind="goalDiff" /></td>
                  <td className="px-2.5 py-2"><ReliabilityBadge value={p.reliability} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Cartões (mobile) */}
      <div className="sm:hidden space-y-2.5">
        <SelectField
          label="Ordenar"
          value={`${sortKey}:${sortDir}`}
          onChange={(e) => {
            const [k, d] = e.target.value.split(":");
            setSortKey(k as SortKey);
            setSortDir(d as "asc" | "desc");
          }}
        >
          <option value="dPts:desc">Δ pontos (maior)</option>
          <option value="dPts:asc">Δ pontos (menor)</option>
          <option value="dWin:desc">Δ % vitórias (maior)</option>
          <option value="dGd:desc">Δ saldo (maior)</option>
          <option value="with:desc">Mais jogos</option>
          <option value="name:asc">Nome</option>
        </SelectField>
        <ul className="space-y-2.5">
          {sorted.map((p) => (
            <li key={p.playerEntityId}>
              <Card className="p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Link to={`/player/${p.playerEntityId}`} className="font-semibold text-fg truncate hover:text-accent">
                    {p.name}
                  </Link>
                  <ReliabilityBadge value={p.reliability} />
                </div>
                <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                  <dt className="text-fg-subtle">Com</dt>
                  <dd className="text-right"><StatBlock s={p.with} /></dd>
                  <dt className="text-fg-subtle">Sem</dt>
                  <dd className="text-right"><StatBlock s={p.without} /></dd>
                  <dt className="text-fg-subtle">Δ % vitórias</dt>
                  <dd className="text-right"><DeltaCell v={p.delta?.winRatePct ?? null} kind="win" /></dd>
                  <dt className="text-fg-subtle">Δ pontos/jogo</dt>
                  <dd className="text-right"><DeltaCell v={p.delta?.pointsPerMatch ?? null} kind="points" /></dd>
                  <dt className="text-fg-subtle">Δ saldo/jogo</dt>
                  <dd className="text-right"><DeltaCell v={p.delta?.goalDiffPerMatch ?? null} kind="goalDiff" /></dd>
                </dl>
                {p.note && <p className="text-[11px] text-fg-subtle">{p.note}</p>}
              </Card>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
