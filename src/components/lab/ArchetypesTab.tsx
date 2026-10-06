import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Info } from "lucide-react";
import { Card, Skeleton } from "../ui.tsx";
import { EmptyPanel, ErrorPanel } from "../analytics/Controls.tsx";
import ArchetypeBadge, { archetypeGroupLabel } from "../archetypes/ArchetypeBadge.tsx";
import PositionArchetypeFilter from "../archetypes/PositionArchetypeFilter.tsx";
import type { ArchetypeFilterValue } from "../../hooks/useArchetypeFilter.ts";
import { archetypeOptionsForPosition, optionsFromAvailable, type ArchetypeOption } from "../../utils/archetypeFilters.ts";
import type { ArchetypeSummary, ArchetypeSummaryPlayer, ArchetypeSummaryRow } from "../../types/archetypes.ts";
import type { ResourceError } from "../../hooks/useApiResource.ts";
import { fmtNum, fmtPct, plural } from "../../utils/analyticsFormat.ts";

const th = "px-2 py-2 text-right font-semibold whitespace-nowrap";

function overallText(r: ArchetypeSummaryRow): string {
  if (r.avgProOverall == null) return "—";
  const range =
    r.minProOverall != null && r.maxProOverall != null
      ? r.minProOverall === r.maxProOverall
        ? ""
        : ` (${fmtNum(r.minProOverall)}–${fmtNum(r.maxProOverall)})`
      : "";
  return `${fmtNum(r.avgProOverall, 1)}${range}`;
}

function topPlayersText(r: ArchetypeSummaryRow): string {
  return r.topPlayers.map((p) => p.name).join(", ");
}

/** Cartões (mobile): um por arquétipo, com os mesmos números da tabela. */
function ArchetypeCard({ r }: { r: ArchetypeSummaryRow }) {
  const group = archetypeGroupLabel(r.archetype.positionGroup);
  const items: Array<[string, string]> = [
    ["Jogos", fmtNum(r.matches)],
    ["Jogadores", fmtNum(r.players)],
    ["Nota média", fmtNum(r.avgRating, 2)],
    ["Overall", overallText(r)],
    ["Gols/jogo", fmtNum(r.goalsPerMatch, 2)],
    ["Assist./jogo", fmtNum(r.assistsPerMatch, 2)],
    ["% vitórias", fmtPct(r.winPct, 0)],
    ["% passes", fmtPct(r.passAccuracyPct, 0)],
    ["% finalização", fmtPct(r.shotAccuracyPct, 0)],
    ["% desarmes", fmtPct(r.tackleAccuracyPct, 0)],
  ];
  return (
    <li>
      <Card className="p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <ArchetypeBadge archetype={r.archetype} emphasis />
          {group && <span className="text-[11px] text-fg-subtle">{group}</span>}
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
          {items.map(([k, v]) => (
            <div key={k} className="flex items-baseline justify-between gap-2 min-w-0">
              <dt className="text-fg-subtle">{k}</dt>
              <dd className="font-semibold tabular-nums text-fg-secondary text-right">{v}</dd>
            </div>
          ))}
        </dl>
        {r.topPlayers.length > 0 && (
          <p className="text-xs text-fg-muted border-t border-border pt-2">
            <span className="text-fg-subtle">Quem usa: </span>
            {r.topPlayers.map((p, i) => (
              <React.Fragment key={p.playerEntityId}>
                {i > 0 && ", "}
                <Link to={`/player/${p.playerEntityId}`} className="hover:text-accent">
                  {p.name}
                </Link>{" "}
                <span className="text-fg-subtle">({p.matches})</span>
              </React.Fragment>
            ))}
          </p>
        )}
      </Card>
    </li>
  );
}

function ArchetypeTable({ rows }: { rows: ArchetypeSummaryRow[] }) {
  return (
    <Card className="overflow-hidden">
      <table className="w-full text-sm">
        <caption className="sr-only">Estatísticas por arquétipo</caption>
        <thead className="text-xs text-fg-muted bg-surface-raised">
          <tr>
            <th scope="col" className="px-3 py-2 text-left font-semibold">Arquétipo</th>
            <th scope="col" className={th}>Jogos</th>
            <th scope="col" className={th} title="Jogadores diferentes que usaram o arquétipo">Jog.</th>
            <th scope="col" className={th}>Nota</th>
            <th scope="col" className={th} title="Overall médio (mín–máx)">Overall</th>
            <th scope="col" className={th}>Gols/j</th>
            <th scope="col" className={th}>Ast/j</th>
            <th scope="col" className={th}>% vit.</th>
            <th scope="col" className={th} title="Precisão de passes">% pass.</th>
            <th scope="col" className={th} title="Precisão de finalização">% fin.</th>
            <th scope="col" className={th} title="Precisão de desarmes">% des.</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r) => (
            <tr key={r.archetype.id}>
              <th scope="row" className="px-3 py-2 text-left font-medium text-fg">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <ArchetypeBadge archetype={r.archetype} emphasis />
                  {archetypeGroupLabel(r.archetype.positionGroup) && (
                    <span className="text-[11px] font-normal text-fg-subtle">{archetypeGroupLabel(r.archetype.positionGroup)}</span>
                  )}
                </div>
                {r.topPlayers.length > 0 && (
                  <div className="mt-0.5 text-[11px] font-normal text-fg-subtle truncate max-w-[14rem]" title={`Quem usa: ${topPlayersText(r)}`}>
                    {topPlayersText(r)}
                  </div>
                )}
              </th>
              <td className="px-2 py-2 text-right tabular-nums">{fmtNum(r.matches)}</td>
              <td className="px-2 py-2 text-right tabular-nums">{fmtNum(r.players)}</td>
              <td className="px-2 py-2 text-right tabular-nums">{fmtNum(r.avgRating, 2)}</td>
              <td className="px-2 py-2 text-right tabular-nums whitespace-nowrap">{overallText(r)}</td>
              <td className="px-2 py-2 text-right tabular-nums">{fmtNum(r.goalsPerMatch, 2)}</td>
              <td className="px-2 py-2 text-right tabular-nums">{fmtNum(r.assistsPerMatch, 2)}</td>
              <td className="px-2 py-2 text-right tabular-nums">{fmtPct(r.winPct, 0)}</td>
              <td className="px-2 py-2 text-right tabular-nums">{fmtPct(r.passAccuracyPct, 0)}</td>
              <td className="px-2 py-2 text-right tabular-nums">{fmtPct(r.shotAccuracyPct, 0)}</td>
              <td className="px-2 py-2 text-right tabular-nums">{fmtPct(r.tackleAccuracyPct, 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function PlayersGrid({ players }: { players: ArchetypeSummaryPlayer[] }) {
  return (
    <Card className="overflow-hidden">
      <table className="w-full text-sm">
        <caption className="sr-only">Arquétipos usados por jogador</caption>
        <thead className="text-xs text-fg-muted bg-surface-raised">
          <tr>
            <th scope="col" className="px-3 py-2 text-left font-semibold">Jogador</th>
            <th scope="col" className="px-2 py-2 text-right font-semibold whitespace-nowrap" title="Quantas vezes trocou de arquétipo">Trocas</th>
            <th scope="col" className="px-3 py-2 text-left font-semibold">Arquétipos usados (jogos · %)</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {players.map((p) => (
            <tr key={p.playerEntityId} className="align-top">
              <th scope="row" className="px-3 py-2 text-left font-medium text-fg">
                <Link to={`/player/${p.playerEntityId}`} className="hover:text-accent">
                  {p.name}
                </Link>
              </th>
              <td className="px-2 py-2 text-right tabular-nums">{p.switches}</td>
              <td className="px-3 py-2">
                {p.archetypes.length === 0 ? (
                  <span className="text-fg-subtle">sem arquétipo registrado</span>
                ) : (
                  <ul className="flex flex-wrap gap-x-3 gap-y-1.5">
                    {p.archetypes.map((u) => (
                      <li key={u.archetype.id} className="inline-flex items-center gap-1.5">
                        <ArchetypeBadge archetype={u.archetype} emphasis={u === p.archetypes[0]} />
                        <span className="text-xs tabular-nums text-fg-muted whitespace-nowrap">
                          {fmtNum(u.matches)} · {fmtPct(u.pct, 0)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function ArchetypesBody({
  data,
  loading,
  error,
  onRetry,
  filterActive,
  onClear,
}: {
  data: ArchetypeSummary | null;
  loading: boolean;
  error: ResourceError | null;
  onRetry: () => void;
  filterActive: boolean;
  onClear: () => void;
}) {
  if (error) return <ErrorPanel message={error.message} onRetry={onRetry} />;
  if (loading || !data) {
    return (
      <div className="space-y-4" role="status" aria-busy="true">
        <span className="sr-only">Carregando arquétipos…</span>
        <Skeleton className="h-64 rounded-2xl" />
        <Skeleton className="h-40 rounded-2xl" />
      </div>
    );
  }
  const rows = data.archetypes ?? [];
  const players = (data.byPlayer ?? []).filter((p) => p.archetypes.length > 0 || p.switches > 0);
  if (rows.length === 0) {
    return (
      <EmptyPanel
        icon="🧬"
        title={filterActive ? "Nenhum jogo com este filtro" : "Nenhum arquétipo registrado neste recorte"}
        message={
          filterActive
            ? "Nenhuma atuação neste período bate com a posição/arquétipo escolhidos. Troque o filtro ou amplie o período."
            : data.totalPlayerMatches > 0
              ? "As partidas deste período não trazem o arquétipo dos jogadores (partidas antigas). Amplie o período."
              : "Não há partidas neste período."
        }
        action={
          filterActive ? (
            <button type="button" className="btn btn-secondary min-h-[44px]" onClick={onClear}>
              Limpar filtro
            </button>
          ) : undefined
        }
      />
    );
  }
  const withPct = data.totalPlayerMatches > 0 ? (data.withoutArchetype / data.totalPlayerMatches) * 100 : 0;
  return (
    <div className="space-y-6">
      <div
        role="note"
        className="flex items-start gap-2.5 rounded-xl border border-border bg-surface-raised px-3 py-2.5 text-sm text-fg-secondary"
      >
        <Info size={18} aria-hidden="true" className="mt-0.5 flex-shrink-0 text-fg-muted" />
        <p>
          Cada arquétipo distribui os pontos de atributos de um jeito, então notas e overall de arquétipos diferentes não são
          diretamente comparáveis. Ids sem nome aparecem como "Arquétipo #id" até serem nomeados no Admin.
          {data.withoutArchetype > 0 && (
            <>
              {" "}
              <strong className="text-fg">{fmtNum(data.withoutArchetype)}</strong>{" "}
              {plural(data.withoutArchetype, "registro", "registros")} de {fmtNum(data.totalPlayerMatches)} ({fmtPct(withPct, 0)}) sem
              arquétipo (partidas antigas) ficaram de fora.
            </>
          )}
        </p>
      </div>

      <section aria-labelledby="lab-arch-title" className="space-y-3">
        <h3 id="lab-arch-title" className="font-display font-bold text-lg uppercase tracking-wide text-fg">
          Desempenho por arquétipo
        </h3>
        <div className="hidden md:block">
          <ArchetypeTable rows={rows} />
        </div>
        <ul className="md:hidden space-y-2.5">
          {rows.map((r) => (
            <ArchetypeCard key={r.archetype.id} r={r} />
          ))}
        </ul>
        <p className="text-xs text-fg-subtle">Esta aba ignora "Mín. jogos"; vale o período e a versão escolhidos acima.</p>
      </section>

      {players.length > 0 && (
        <section aria-labelledby="lab-arch-players-title" className="space-y-3">
          <div>
            <h3 id="lab-arch-players-title" className="font-display font-bold text-lg uppercase tracking-wide text-fg">
              Jogadores × arquétipos
            </h3>
            <p className="text-xs text-fg-muted">Quem joga com qual arquétipo e quantas vezes trocou de um para outro.</p>
          </div>
          <PlayersGrid players={players} />
        </section>
      )}
    </div>
  );
}

export default function ArchetypesTab({
  data,
  loading,
  error,
  onRetry,
  filter,
  onFilter,
}: {
  data: ArchetypeSummary | null;
  loading: boolean;
  error: ResourceError | null;
  onRetry: () => void;
  filter: ArchetypeFilterValue;
  onFilter: (next: ArchetypeFilterValue) => void;
}) {
  // Opções do 2º filtro: `availableArchetypes` (já com a posição aplicada e sem o arquétipo). A última lista fica guardada
  // para o select não esvaziar enquanto a nova resposta carrega.
  const fresh = useMemo<ArchetypeOption[] | null>(() => {
    if (!data) return null;
    if (data.availableArchetypes) return optionsFromAvailable(data.availableArchetypes);
    // backend sem `availableArchetypes`: deriva das linhas (só vale sem filtro de arquétipo)
    if (filter.archetypeId !== null) return null;
    return archetypeOptionsForPosition(
      (data.archetypes ?? []).map((r) => ({ id: r.archetype.id, label: r.archetype.label, count: r.matches, positionGroup: r.archetype.positionGroup })),
      filter.positionGroup
    );
  }, [data, filter]);
  const [options, setOptions] = useState<ArchetypeOption[]>([]);
  useEffect(() => {
    if (fresh) setOptions(fresh);
  }, [fresh]);
  const shown = archetypeOptionsForPosition(options, filter.positionGroup);
  const filterActive = filter.positionGroup !== null || filter.archetypeId !== null;
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <PositionArchetypeFilter value={filter} onChange={onFilter} archetypeOptions={shown} showCount countUnit={["jogo", "jogos"]} />
        <p className="text-xs text-fg-muted">
          {filterActive
            ? "Mostrando só as atuações (jogador × partida) na posição/arquétipo escolhidos; tudo abaixo é recalculado com elas."
            : "Posição → arquétipo: escolha uma posição para ver só os arquétipos dela, ou um arquétipo para recalcular as tabelas com ele."}
        </p>
      </div>
      <ArchetypesBody
        data={data}
        loading={loading}
        error={error}
        onRetry={onRetry}
        filterActive={filterActive}
        onClear={() => onFilter({ positionGroup: null, archetypeId: null })}
      />
    </div>
  );
}
