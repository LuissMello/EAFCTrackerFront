import React, { useCallback, useMemo } from "react";
import { Card, Skeleton } from "../ui.tsx";
import { EmptyPanel, ErrorPanel } from "../analytics/Controls.tsx";
import LabChart from "./LabChart.tsx";
import {
  RELIABILITY_ALPHA,
  RELIABILITY_TEXT,
  StatsTable,
  formatMetric,
  metricShort,
  metricValue,
  reliabilityOf,
  statsLine,
  type LabMetric,
} from "./labShared.tsx";
import type { LabContextResponse, LabStats } from "../../types/lab";
import type { ResourceError } from "../../hooks/useApiResource.ts";
import { WEEKDAYS_LONG, WEEKDAYS_SHORT } from "../../utils/analyticsFormat.ts";

interface Row {
  key: string | number;
  label: string | string[];
  /** rótulo em texto simples (tabela/tooltip) */
  plain: string;
  extra?: string;
  stats: LabStats;
}

/** Gráfico + "ver números" para uma lista de recortes. */
function ContextBlock({
  title,
  description,
  rows,
  baseline,
  metric,
  type = "bar",
  horizontal = false,
  caption,
}: {
  title: string;
  description?: string;
  rows: Row[];
  baseline: LabStats;
  metric: LabMetric;
  type?: "bar" | "line";
  horizontal?: boolean;
  caption: string;
}) {
  const labels = useMemo(() => rows.map((r) => r.label), [rows]);
  const series = useMemo(
    () => [{ label: metricShort(metric), color: "accent" as const, values: rows.map((r) => metricValue(r.stats, metric)) }],
    [rows, metric]
  );
  const alphas = useMemo(() => rows.map((r) => RELIABILITY_ALPHA[reliabilityOf(r.stats.matches)]), [rows]);
  const format = useCallback((v: number) => formatMetric(metric, v), [metric]);
  const tooltip = useCallback(
    (_s: number, i: number) => {
      const r = rows[i];
      return r ? [statsLine(r.stats), `Amostra: ${RELIABILITY_TEXT[reliabilityOf(r.stats.matches)].replace("amostra ", "")}`] : [];
    },
    [rows]
  );
  const tooltipTitle = useCallback((i: number) => rows[i]?.plain ?? "", [rows]);
  const base = useMemo(
    () => ({ value: metricValue(baseline, metric), label: `Time em geral: ${formatMetric(metric, metricValue(baseline, metric))}` }),
    [baseline, metric]
  );
  const total = rows.reduce((a, r) => a + r.stats.matches, 0);
  const best = rows.reduce<Row | null>((b, r) => (b === null || metricValue(r.stats, metric) > metricValue(b.stats, metric) ? r : b), null);

  return (
    <Card className="p-3 sm:p-4 space-y-3">
      <div>
        <h3 className="font-display font-bold text-lg uppercase tracking-wide text-fg">{title}</h3>
        {description && <p className="text-xs text-fg-muted mt-0.5">{description}</p>}
      </div>
      <LabChart
        type={type}
        horizontal={horizontal}
        labels={labels}
        series={series}
        alphas={alphas}
        baseline={base}
        format={format}
        tooltip={tooltip}
        tooltipTitle={tooltipTitle}
        ariaLabel={`${title}: gráfico de ${type === "line" ? "linha" : "barras"} com ${rows.length} grupos (${metricShort(metric)}, ${total} partidas)${
          best ? `. Maior valor: ${best.plain}` : ""
        }. Os números completos estão na tabela em "Ver números".`}
      />
      <p className="text-[11px] text-fg-subtle">Barras mais claras = menos partidas no grupo; linha tracejada = desempenho geral do time.</p>
      <details className="group rounded-lg border border-border bg-surface-raised">
        <summary className="cursor-pointer select-none px-3 py-2 text-sm font-semibold text-fg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-lg">
          Ver números
        </summary>
        <div className="border-t border-border">
          <StatsTable
            caption={caption}
            baseline={baseline}
            rows={rows.map((r) => ({ key: r.key, label: r.plain, extra: r.extra, stats: r.stats }))}
          />
        </div>
      </details>
    </Card>
  );
}

function Shell({
  data,
  loading,
  error,
  onRetry,
  children,
}: {
  data: LabContextResponse | null;
  loading: boolean;
  error: ResourceError | null;
  onRetry: () => void;
  children: (d: LabContextResponse) => React.ReactNode;
}) {
  if (error) return <ErrorPanel message={error.message} onRetry={onRetry} />;
  if (loading || !data) {
    return (
      <div className="space-y-3" role="status" aria-busy="true">
        <span className="sr-only">Carregando…</span>
        <Skeleton className="h-72 rounded-2xl" />
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    );
  }
  if (data.baseline.matches === 0) {
    return <EmptyPanel icon="🧪" title="Sem partidas neste período" message="Ajuste o período ou a versão do jogo nos filtros." />;
  }
  return <div className="space-y-4">{children(data)}</div>;
}

type TabProps = {
  data: LabContextResponse | null;
  loading: boolean;
  error: ResourceError | null;
  onRetry: () => void;
  metric: LabMetric;
};

/** "Quando jogamos": dia da semana, hora do dia e posição na noite. */
export function WhenTab({ data, loading, error, onRetry, metric }: TabProps) {
  return (
    <Shell data={data} loading={loading} error={error} onRetry={onRetry}>
      {(d) => {
        const weekday: Row[] = d.byWeekday.map((r) => ({
          key: r.weekday,
          label: WEEKDAYS_SHORT[r.weekday] ?? String(r.weekday),
          plain: WEEKDAYS_LONG[r.weekday] ?? String(r.weekday),
          stats: r,
        }));
        const hour: Row[] = d.byHour.map((r) => ({
          key: r.hour,
          label: `${r.hour}h`,
          plain: `${String(r.hour).padStart(2, "0")}h`,
          stats: r,
        }));
        const position: Row[] = d.bySessionPosition.map((r) => ({
          key: r.position,
          label: r.position >= 8 ? "8º+" : `${r.position}º`,
          plain: r.position >= 8 ? "8º jogo ou mais" : `${r.position}º jogo da noite`,
          stats: r,
        }));
        return (
          <>
            <ContextBlock
              title="Dia da semana"
              description="Como o time rende em cada dia (horário local do clube)."
              rows={weekday}
              baseline={d.baseline}
              metric={metric}
              caption="Desempenho por dia da semana"
            />
            <ContextBlock
              title="Hora do dia"
              description="Como o time rende em cada hora (horário local do clube)."
              rows={hour}
              baseline={d.baseline}
              metric={metric}
              caption="Desempenho por hora do dia"
            />
            <ContextBlock
              title="O cansaço pesa?"
              description="Desempenho conforme a posição do jogo dentro da noite (1º, 2º, 3º…). Se a linha cai, o time rende menos no fim da noite."
              rows={position}
              baseline={d.baseline}
              metric={metric}
              type="line"
              caption="Desempenho por posição do jogo na noite"
            />
          </>
        );
      }}
    </Shell>
  );
}

/** "Formação": quantidade de jogadores do nosso time e do adversário. */
export function FormationTab({ data, loading, error, onRetry, metric }: TabProps) {
  return (
    <Shell data={data} loading={loading} error={error} onRetry={onRetry}>
      {(d) => {
        const mk = (r: LabStats & { players: number }): Row => ({
          key: r.players,
          label: `${r.players} ${r.players === 1 ? "jogador" : "jogadores"}`,
          plain: `${r.players} ${r.players === 1 ? "jogador" : "jogadores"}`,
          stats: r,
        });
        return (
          <>
            <ContextBlock
              title="Quantos jogamos"
              description="Desempenho conforme o número de jogadores do nosso time em campo."
              rows={d.byOurPlayers.map(mk)}
              baseline={d.baseline}
              metric={metric}
              caption="Desempenho por número de jogadores do nosso time"
            />
            <ContextBlock
              title="Quantos o adversário tinha"
              description="Desempenho conforme o número de jogadores do adversário em campo."
              rows={d.byOpponentPlayers.map(mk)}
              baseline={d.baseline}
              metric={metric}
              caption="Desempenho por número de jogadores do adversário"
            />
          </>
        );
      }}
    </Shell>
  );
}

const BAND_ORDER = ["mais fraco", "parecido", "mais forte"];

function gapText(min: number | null, max: number | null): string | undefined {
  const f = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "0");
  if (min !== null && max !== null) return `dif. de SR ${f(min)} a ${f(max)}`;
  if (max !== null) return `dif. de SR até ${f(max)}`;
  if (min !== null) return `dif. de SR a partir de ${f(min)}`;
  return undefined;
}

/** "Adversário": força do adversário pela diferença de SR. */
export function OpponentTab({ data, loading, error, onRetry, metric }: TabProps) {
  return (
    <Shell data={data} loading={loading} error={error} onRetry={onRetry}>
      {(d) => {
        const bands = [...(d.byOpponentStrength ?? [])].sort(
          (a, b) => BAND_ORDER.indexOf(a.band) - BAND_ORDER.indexOf(b.band)
        );
        if (bands.length === 0) {
          return (
            <EmptyPanel
              icon="📉"
              title="Sem dados de SR dos dois lados"
              message="Só entram partidas em que temos o skill rating do nosso time e do adversário."
            />
          );
        }
        const rows: Row[] = bands.map((b) => ({
          key: b.band,
          label: [b.band.charAt(0).toUpperCase() + b.band.slice(1)],
          plain: `Adversário ${b.band}`,
          extra: gapText(b.srGapMin, b.srGapMax),
          stats: b,
        }));
        return (
          <ContextBlock
            title="Força do adversário"
            description="Comparando o SR do adversário com o nosso: 60+ pontos acima = mais forte; 60+ abaixo = mais fraco; no meio = parecido."
            rows={rows}
            baseline={d.baseline}
            metric={metric}
            caption="Desempenho por força do adversário"
          />
        );
      }}
    </Shell>
  );
}
