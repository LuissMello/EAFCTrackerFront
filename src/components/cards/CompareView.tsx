import React, { useMemo } from "react";
import { ArrowLeftRight, Info, X } from "lucide-react";
import { Card, Skeleton } from "../ui.tsx";
import { ErrorPanel, VedChip } from "../analytics/Controls.tsx";
import type { ResourceError } from "../../hooks/useApiResource.ts";
import type { CompareStats, PlayerCard, PlayerCompareResponse, RatingSeriesPoint } from "../../types/playerCards";
import { fmtNum, fmtPct, plural } from "../../utils/analyticsFormat.ts";
import { SERIES_COLORS, axisEntries, compareAxisKeys, fmtScore, splitMetrics } from "../../utils/playerCards.ts";
import { CardFace } from "./PlayerCard.tsx";
import { MetricRows } from "./MetricRows.tsx";
import { RadarWithTable, type RadarSeries } from "./RadarChart.tsx";
import { RatingSeriesChart, dayTime } from "./RatingSeriesChart.tsx";
import { ArchetypeBadge } from "../archetypes/ArchetypeBadge.tsx";
import { PlayerArchetype } from "../archetypes/PlayerArchetype.tsx";
import { fallbackArchetypeLabel } from "../../utils/archetypeFilters.ts";

const SELECT_CLASS =
  "h-11 w-full min-w-0 rounded-lg border border-border bg-surface-sunken px-3 text-sm font-medium text-fg outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/40";

export interface PlayerOption {
  /** Chave única da opção: `<jogador>-<arquétipo|0>` (o mesmo jogador pode aparecer com arquétipos diferentes). */
  key: string;
  id: number;
  /** Arquétipo do lado (só na visão por arquétipo); null = jogador inteiro. */
  arq: number | null;
  /** Texto exibido: "Jogador" ou "Jogador · Arquétipo". */
  name: string;
}

/** Os dois selects (A e B), trocar e limpar. Funciona junto com a escolha pela grade. */
export function ComparePickers({
  options,
  a,
  b,
  onChangeA,
  onChangeB,
  onSwap,
  onClear,
}: {
  options: PlayerOption[];
  a: string | null;
  b: string | null;
  onChangeA: (opt: PlayerOption | null) => void;
  onChangeB: (opt: PlayerOption | null) => void;
  onSwap: () => void;
  onClear: () => void;
}) {
  const sel = (label: string, slot: "A" | "B", value: string | null, other: string | null, onChange: (opt: PlayerOption | null) => void) => (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={`cmp-${slot}`} className="text-xs font-medium uppercase tracking-wide text-fg-muted">
        {label}
      </label>
      <select
        id={`cmp-${slot}`}
        className={SELECT_CLASS}
        value={value ?? ""}
        onChange={(e) => onChange(options.find((o) => o.key === e.target.value) ?? null)}
      >
        <option value="">Escolher jogador…</option>
        {options.map((o) => (
          <option key={o.key} value={o.key} disabled={o.key === other}>
            {o.name}
            {o.key === other ? " (já é o outro)" : ""}
          </option>
        ))}
      </select>
    </div>
  );
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2 sm:gap-3">
      {sel("Jogador A", "A", a, b, onChangeA)}
      <button type="button" onClick={onSwap} disabled={a === null && b === null} aria-label="Trocar A e B de lugar" title="Trocar A e B" className="btn btn-secondary h-11 w-11 !p-0">
        <ArrowLeftRight size={18} aria-hidden="true" />
      </button>
      {sel("Jogador B", "B", b, a, onChangeB)}
      <div className="col-span-3 flex justify-end">
        <button type="button" onClick={onClear} disabled={a === null && b === null} className="btn btn-secondary min-h-[44px]">
          <X size={16} aria-hidden="true" />
          Limpar comparação
        </button>
      </div>
    </div>
  );
}

function ResultBlock({
  title,
  stats,
  emptyText,
  lead,
}: {
  title: string;
  stats: CompareStats | null;
  emptyText: string;
  lead: (s: CompareStats) => string;
}) {
  const has = stats !== null && stats.matches > 0;
  return (
    <Card className="min-w-0 p-3 sm:p-4">
      <h4 className="font-display text-sm font-bold uppercase tracking-widest text-fg-subtle">{title}</h4>
      {has && stats ? (
        <>
          <p className="mt-1.5 text-sm font-semibold text-fg">{lead(stats)}</p>
          <div className="mt-2 flex items-center gap-2">
            <VedChip wins={stats.wins} draws={stats.draws} losses={stats.losses} />
          </div>
          <dl className="mt-2 grid grid-cols-3 gap-2 text-center">
            <div>
              <dd className="text-base font-bold tabular-nums text-fg">{fmtNum(stats.pointsPerMatch, 2)}</dd>
              <dt className="text-[11px] text-fg-muted">pontos/jogo</dt>
            </div>
            <div>
              <dd className="text-base font-bold tabular-nums text-fg">{fmtNum(stats.goalsForPerMatch, 2)}</dd>
              <dt className="text-[11px] text-fg-muted">gols pró/jogo</dt>
            </div>
            <div>
              <dd className="text-base font-bold tabular-nums text-fg">{fmtNum(stats.goalsAgainstPerMatch, 2)}</dd>
              <dt className="text-[11px] text-fg-muted">gols contra/jogo</dt>
            </div>
          </dl>
        </>
      ) : (
        <p className="mt-1.5 text-sm text-fg-muted">{emptyText}</p>
      )}
    </Card>
  );
}

function matchesText(n: number): string {
  return `${n} ${plural(n, "jogo", "jogos")}`;
}

function TogetherBlocks({ data }: { data: PlayerCompareResponse }) {
  const nameA = data.a.name;
  const nameB = data.b.name;
  return (
    <section aria-label="Resultados do clube com e sem os dois">
      <h3 className="mb-2 font-display text-sm font-bold uppercase tracking-widest text-fg-subtle">Resultados do clube</h3>
      <div className="grid gap-3 md:grid-cols-3">
        <ResultBlock
          title="Com os dois em campo"
          stats={data.together}
          emptyText="Os dois ainda não jogaram juntos neste período."
          lead={(s) => `Com os dois em campo: ${fmtPct(s.winRatePct, 0)} de vitórias em ${matchesText(s.matches)}`}
        />
        <ResultBlock
          title={`Só ${nameA}`}
          stats={data.onlyA}
          emptyText={`Nenhum jogo só com ${nameA} em campo.`}
          lead={(s) => `Só ${nameA}: ${fmtPct(s.winRatePct, 0)} de vitórias em ${matchesText(s.matches)}`}
        />
        <ResultBlock
          title={`Só ${nameB}`}
          stats={data.onlyB}
          emptyText={`Nenhum jogo só com ${nameB} em campo.`}
          lead={(s) => `Só ${nameB}: ${fmtPct(s.winRatePct, 0)} de vitórias em ${matchesText(s.matches)}`}
        />
      </div>
    </section>
  );
}

function SeriesSection({ series, nameA, nameB }: { series: RatingSeriesPoint[]; nameA: string; nameB: string }) {
  const rows = series;
  return (
    <section aria-label="Notas por partida">
      <h3 className="mb-2 font-display text-sm font-bold uppercase tracking-widest text-fg-subtle">Notas por partida</h3>
      {rows.length > 0 && (
        <p className="mb-2 text-xs text-fg-muted">
          {rows.length === 20 ? "Últimas 20 partidas" : `Últimas ${rows.length} ${plural(rows.length, "partida", "partidas")}`} em que pelo menos um dos dois jogou.
        </p>
      )}
      {rows.length === 0 ? (
        <p className="rounded-xl border border-border p-4 text-sm text-fg-muted">Nenhuma nota de partida de {nameA} ou {nameB} neste recorte.</p>
      ) : (
        <Card className="p-3 sm:p-4">
          <RatingSeriesChart series={rows} nameA={nameA} nameB={nameB} />
          <p className="mt-2 text-xs text-fg-muted">Quando o jogador não esteve na partida a linha se interrompe (sem nota).</p>
          <details className="mt-2">
            <summary className="flex min-h-[44px] cursor-pointer items-center text-sm font-semibold text-accent hover:underline">Ver notas em tabela</summary>
            <div className="mt-2 max-h-80 overflow-auto rounded-xl border border-border">
              <table className="w-full text-sm">
                <caption className="sr-only">Notas por partida de {nameA} e {nameB}</caption>
                <thead className="sticky top-0 bg-surface-raised text-xs uppercase tracking-wide text-fg-muted">
                  <tr>
                    <th scope="col" className="px-3 py-2 text-left font-semibold">Partida</th>
                    <th scope="col" className="px-3 py-2 text-right font-semibold">{nameA}</th>
                    <th scope="col" className="px-3 py-2 text-right font-semibold">{nameB}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((p) => (
                    <tr key={String(p.matchId)}>
                      <th scope="row" className="whitespace-nowrap px-3 py-1.5 text-left font-medium text-fg-secondary">{dayTime(p.timestamp)}</th>
                      <td className="px-3 py-1.5 text-right tabular-nums text-fg">{p.a === null ? <span className="text-fg-subtle">não jogou</span> : fmtNum(p.a, 1)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-fg">{p.b === null ? <span className="text-fg-subtle">não jogou</span> : fmtNum(p.b, 1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </Card>
      )}
    </section>
  );
}

/**
 * Arquétipo (principal) dos dois lados + aviso quando diferem. Sem filtro, a nota/atributos de cada carta misturam os
 * arquétipos que a pessoa usou; com arquétipos diferentes a comparação não é "na mesma base".
 */
function ArchetypeCompare({
  a,
  b,
  filterId,
  positionLabel,
  asArchetype = false,
}: {
  a: PlayerCard;
  b: PlayerCard;
  filterId: number | null;
  positionLabel: string | null;
  asArchetype?: boolean;
}) {
  const aa = a.archetype ?? null;
  const bb = b.archetype ?? null;
  // contrato antigo/sem campo: não mostra nada
  if (a.archetype === undefined && b.archetype === undefined) return null;
  const aMany = (a.archetypes?.length ?? 0) > 1;
  const bMany = (b.archetypes?.length ?? 0) > 1;
  const ids = (c: PlayerCard) => (c.archetypes && c.archetypes.length > 0 ? c.archetypes.map((u) => u.archetype.id) : c.archetype ? [c.archetype.id] : []);
  const idsA = ids(a).sort((x, y) => x - y).join(",");
  const idsB = ids(b).sort((x, y) => x - y).join(",");
  const differ = idsA !== idsB || (aa?.id ?? 0) !== (bb?.id ?? 0);
  const side = (label: "A" | "B", c: PlayerCard) => (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
      <span className="text-xs font-bold text-fg-muted">{label}</span>
      <PlayerArchetype archetype={c.archetype} archetypes={asArchetype ? undefined : c.archetypes} compact={false} hideEmpty={false} layout="responsive" />
    </div>
  );
  return (
    <section aria-label="Arquétipos dos jogadores" className="space-y-2">
      <div className="mx-auto grid max-w-lg grid-cols-2 gap-3 sm:gap-4">
        {side("A", a)}
        {side("B", b)}
      </div>
      {asArchetype ? (
        <p className="text-center text-xs text-fg-muted">
          Cada lado usa só os jogos no arquétipo escolhido, com as notas pelos pesos desse arquétipo
          {a.overallByPosition !== undefined && b.overallByPosition !== undefined
            ? ` (pela posição: A ${a.overallByPosition}, B ${b.overallByPosition})`
            : ""}
          .
        </p>
      ) : filterId !== null || positionLabel ? (
        <p className="text-center text-xs text-fg-muted">
          Filtro ativo: os dois lados usam só os jogos
          {positionLabel ? <> na posição <strong className="text-fg-secondary">{positionLabel}</strong></> : null}
          {filterId !== null ? (
            <>
              {" "}como{" "}
              <ArchetypeBadge archetype={aa ?? bb ?? { id: filterId, name: null, label: fallbackArchetypeLabel(filterId), shortName: null, positionGroup: null }} />
            </>
          ) : null}
          .
        </p>
      ) : differ ? (
        <div role="note" className="flex items-start gap-2 rounded-xl border border-gold/40 bg-gold-soft px-3 py-2 text-sm text-gold-fg">
          <Info size={16} aria-hidden="true" className="mt-0.5 flex-shrink-0" />
          <p>
            <strong>Arquétipos diferentes:</strong>{" "}
            {a.name} {aa ? `joga como ${aa.label}${aMany ? " (e outros)" : ""}` : "não tem arquétipo registrado"};{" "}
            {b.name} {bb ? `joga como ${bb.label}${bMany ? " (e outros)" : ""}` : "não tem arquétipo registrado"}. Notas e overall mudam
            com o arquétipo, então a comparação direta pode enganar. Use o filtro <strong>Arquétipo</strong> para comparar na mesma base.
          </p>
        </div>
      ) : aa ? (
        <p className="text-center text-xs text-fg-muted">Os dois jogam com o mesmo arquétipo principal: comparação na mesma base.</p>
      ) : null}
    </section>
  );
}

export function CompareSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-busy="true">
      <span className="sr-only">Comparando os jogadores…</span>
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-[17.5rem] rounded-2xl" />
        <Skeleton className="h-[17.5rem] rounded-2xl" />
      </div>
      <Skeleton className="h-72 rounded-2xl" />
      <Skeleton className="h-64 rounded-2xl" />
    </div>
  );
}

/** Resultado da comparação (radar sobreposto, métricas, com/sem os dois, notas por partida). */
export function CompareResult({
  data: data0,
  crestAssetId,
  clubName,
  archetypeFilterId = null,
  positionFilterLabel = null,
}: {
  data: PlayerCompareResponse;
  crestAssetId?: string | null;
  clubName?: string | null;
  archetypeFilterId?: number | null;
  positionFilterLabel?: string | null;
}) {
  // Comparando COMO um arquétipo específico em cada lado: o mesmo jogador pode ser A e B, então os nomes levam o arquétipo
  const explicit = data0.archetypeIdA != null || data0.archetypeIdB != null;
  const data = useMemo<PlayerCompareResponse>(() => {
    if (!explicit) return data0;
    const tag = (c: PlayerCard) => `${c.name} · ${c.archetype?.label ?? "sem arquétipo"}`;
    return { ...data0, a: { ...data0.a, name: tag(data0.a) }, b: { ...data0.b, name: tag(data0.b) } };
  }, [data0, explicit]);
  const { a, b } = data;
  const keys = useMemo(() => compareAxisKeys(a, b), [a, b]);
  const axes = useMemo(() => axisEntries(a, keys), [a, keys]);
  const series = useMemo<RadarSeries[]>(
    () => [
      { id: "a", label: a.name, values: axisEntries(a, keys).map((e) => e.value), cssVar: SERIES_COLORS.a },
      { id: "b", label: b.name, values: axisEntries(b, keys).map((e) => e.value), cssVar: SERIES_COLORS.b, alt: true },
    ],
    [a, b, keys]
  );
  const { scores, stats } = useMemo(() => splitMetrics(data.metrics), [data.metrics]);
  const tally = useMemo(() => {
    let wa = 0;
    let wb = 0;
    let ties = 0;
    for (const m of data.metrics ?? []) {
      if (m.winner === "a") wa++;
      else if (m.winner === "b") wb++;
      else if (m.winner === "tie") ties++;
    }
    return { wa, wb, ties };
  }, [data.metrics]);

  const radarLabel = `Radar sobreposto de ${a.name} e ${b.name}: ${axes
    .map((ax, i) => `${ax.name} ${fmtScore(series[0].values[i])} contra ${fmtScore(series[1].values[i])}`)
    .join("; ")}`;

  return (
    <div className="space-y-5">
      <div className="space-y-5 lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:items-start lg:gap-6 lg:space-y-0">
        <div className="space-y-5">
          <div className="mx-auto grid max-w-lg grid-cols-2 gap-3 pt-2 sm:gap-4">
            {([a, b] as PlayerCard[]).map((c, i) => (
              <div key={`${i}-${c.playerEntityId}`} className="relative min-w-0">
                <CardFace card={c} crestAssetId={crestAssetId} clubName={clubName} />
                <span
                  aria-hidden="true"
                  className="absolute -left-2 -top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full border-2 border-bg bg-surface font-display text-sm font-black text-fg shadow-raised"
                  style={{ boxShadow: `0 0 0 2px rgb(var(${i === 0 ? SERIES_COLORS.a : SERIES_COLORS.b}))` }}
                >
                  {i === 0 ? "A" : "B"}
                </span>
              </div>
            ))}
          </div>

          <ArchetypeCompare a={a} b={b} filterId={archetypeFilterId} positionLabel={positionFilterLabel} asArchetype={explicit} />

          {a.matches === 0 || b.matches === 0 ? (
            <p role="status" className="text-center text-sm text-fg-secondary">
              {a.matches === 0 && b.matches === 0 ? (
                <>
                  <strong className="text-fg">{a.name}</strong> e <strong className="text-fg">{b.name}</strong> não jogaram neste recorte.
                </>
              ) : (
                <>
                  <strong className="text-fg">{a.matches === 0 ? a.name : b.name}</strong> não jogou neste recorte; as notas ficam sem comparação.
                </>
              )}{" "}
              Amplie o período ou escolha outra versão do jogo.
            </p>
          ) : (
            <p role="status" className="text-center text-sm text-fg-secondary">
              <strong className="text-fg">{a.name}</strong> vence {tally.wa} {plural(tally.wa, "métrica", "métricas")},{" "}
              <strong className="text-fg">{b.name}</strong> vence {tally.wb}
              {tally.ties > 0 ? `, ${tally.ties} ${plural(tally.ties, "empate", "empates")}` : ""}.
            </p>
          )}

          <section aria-label="Radar comparativo">
            <h3 className="mb-2 font-display text-sm font-bold uppercase tracking-widest text-fg-subtle">Perfil comparado</h3>
            <Card className="p-3 sm:p-4">
              <RadarWithTable axes={axes} series={series} ariaLabel={radarLabel} showLegend />
            </Card>
          </section>
        </div>

        <div className="space-y-5">
          <MetricRows title="Notas (0 a 99)" metrics={scores} nameA={a.name} nameB={b.name} />
          <MetricRows title="Números no período" metrics={stats} nameA={a.name} nameB={b.name} />
        </div>
      </div>

      <TogetherBlocks data={data} />
      <SeriesSection series={data.ratingSeries ?? []} nameA={a.name} nameB={b.name} />
    </div>
  );
}

/** Estados do comparador: dica de escolha, carregando, erro (com retry) ou resultado. */
export function CompareView({
  ready,
  needHint,
  loading,
  error,
  data,
  onRetry,
  onClear,
  crestAssetId,
  clubName,
  archetypeFilterId = null,
  positionFilterLabel = null,
}: {
  ready: boolean;
  needHint: string;
  loading: boolean;
  error: ResourceError | null;
  data: PlayerCompareResponse | null;
  onRetry: () => void;
  onClear: () => void;
  crestAssetId?: string | null;
  clubName?: string | null;
  archetypeFilterId?: number | null;
  positionFilterLabel?: string | null;
}) {
  if (!ready) {
    return (
      <div role="status" className="flex items-start gap-2 rounded-xl border border-accent/30 bg-accent/10 px-3 py-2.5 text-sm text-fg-secondary">
        <Info size={16} aria-hidden="true" className="mt-0.5 flex-shrink-0 text-accent" />
        <span>{needHint}</span>
      </div>
    );
  }
  if (error) {
    if (error.status === 404) {
      // jogador que não existe/não é do clube (link antigo ou outro clube): retry não resolve, só escolher de novo
      return (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-negative/30 bg-negative-soft p-4 text-sm text-negative-fg">
          <span className="min-w-[12rem] flex-1">{error.message} Escolha os jogadores novamente.</span>
          <button type="button" className="btn btn-secondary" onClick={onClear}>
            Limpar comparação
          </button>
        </div>
      );
    }
    return <ErrorPanel message={error.message} onRetry={onRetry} />;
  }
  if (loading || !data) return <CompareSkeleton />;
  return <CompareResult data={data} crestAssetId={crestAssetId} clubName={clubName} archetypeFilterId={archetypeFilterId} positionFilterLabel={positionFilterLabel} />;
}
