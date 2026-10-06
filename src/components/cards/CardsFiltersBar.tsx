import React, { useId, useState } from "react";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { Card } from "../ui.tsx";
import { DateRangeBar } from "../DateRangeBar.tsx";
import { SelectField } from "../match/SelectField.tsx";
import { VersionSelect } from "../analytics/Controls.tsx";
import { gameVersionLabel, type GameVersion } from "../../hooks/useGameVersions.tsx";
import type { DateRange } from "../../utils/dateRanges.ts";
import { fmtYmdShort } from "../../utils/analyticsFormat.ts";
import type { CardSortKey } from "../../types/playerCards";
import { SORT_OPTIONS } from "../../utils/playerCards.ts";
import { ModeToggle, type CardsMode } from "./ModeToggle.tsx";
import { ViewToggle, type CardsView } from "./ViewToggle.tsx";
import { PositionArchetypeFilter } from "../archetypes/PositionArchetypeFilter.tsx";
import type { ArchetypeFilterValue } from "../../hooks/useArchetypeFilter.ts";
import { POSITION_FILTER_OPTIONS, type ArchetypeOption } from "../../utils/archetypeFilters.ts";
import type { AvailablePlayer } from "../../types/playerCards";

export const MIN_MATCH_OPTIONS = [1, 2, 3, 5, 8, 10, 15, 20];

/**
 * Filtros das cartas. No celular ficam recolhidos atrás de um botão "Filtros" (com resumo do que está ativo),
 * para a primeira tela já mostrar as cartas; de sm para cima ficam sempre visíveis.
 */
export function CardsFiltersBar({
  range,
  onRange,
  versions,
  gameVersion,
  onVersion,
  minMatches,
  onMinMatches,
  sort,
  onSort,
  mode,
  onMode,
  archetypeOptions = [],
  archetypeFilter = { positionGroup: null, archetypeId: null },
  onArchetypeFilter,
  view = "archetype",
  onView,
  players = [],
  playerId = null,
  onPlayer,
  positionValues = null,
  onClearFilters,
}: {
  range: DateRange;
  onRange: (r: DateRange) => void;
  versions: GameVersion[];
  gameVersion: number | null;
  onVersion: (v: number | null) => void;
  minMatches: number;
  onMinMatches: (n: number) => void;
  sort: CardSortKey;
  onSort: (s: CardSortKey) => void;
  mode: CardsMode;
  onMode: (m: CardsMode) => void;
  /** Opções do filtro (vêm de `availableArchetypes` da resposta). Vazio e sem seleção = filtro oculto. */
  archetypeOptions?: ArchetypeOption[];
  archetypeFilter?: ArchetypeFilterValue;
  onArchetypeFilter?: (next: ArchetypeFilterValue) => void;
  /** Visão da grade: uma carta por jogador (padrão) ou por jogador+arquétipo. */
  view?: CardsView;
  onView?: (v: CardsView) => void;
  /** Jogadores do filtro "Jogador" (de `availablePlayers`). Sem `onPlayer` o filtro não aparece (ex.: no comparador). */
  players?: AvailablePlayer[];
  playerId?: number | null;
  onPlayer?: (id: number | null) => void;
  /** Grupos de posição disponíveis (de `availablePositionGroups`); null = todos. */
  positionValues?: string[] | null;
  /** Limpa Jogador, Posição e Arquétipo. */
  onClearFilters?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const sortLabel = SORT_OPTIONS.find((o) => o.value === sort)?.label ?? sort;
  const { positionGroup, archetypeId } = archetypeFilter;
  const showArchetype = !!onArchetypeFilter;
  const posLabel = positionGroup === null ? null : POSITION_FILTER_OPTIONS.find((o) => o.value === positionGroup)?.label ?? positionGroup;
  const arqLabel = archetypeId === null ? null : archetypeOptions.find((o) => o.id === archetypeId)?.label ?? `Arquétipo #${archetypeId}`;
  const playerName = playerId === null ? null : players.find((p) => p.playerEntityId === playerId)?.name ?? `Jogador #${playerId}`;
  const archetypeLabel = [playerName, posLabel, arqLabel].filter(Boolean).join(" · ") || null;
  const anyFilter = playerId !== null || positionGroup !== null || archetypeId !== null;
  const summary = `${fmtYmdShort(range.from)}–${fmtYmdShort(range.to)} · ${gameVersion === null ? "Todas as versões" : gameVersionLabel(gameVersion)} · mín. ${minMatches} · ${sortLabel}${view === "player" ? " · por jogador" : ""}${archetypeLabel ? ` · ${archetypeLabel}` : ""}`;

  return (
    <Card className="p-3 sm:p-4">
      {/* celular: modo + botão de filtros */}
      <div className="flex flex-wrap items-center justify-between gap-2 sm:hidden">
        <ModeToggle value={mode} onChange={onMode} />
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((v) => !v)}
          className="btn btn-secondary min-h-[44px]"
        >
          <SlidersHorizontal size={16} aria-hidden="true" />
          Filtros
          <ChevronDown size={14} aria-hidden="true" className={open ? "rotate-180" : ""} />
        </button>
      </div>
      {onView && (
        <div className="mt-2 sm:hidden">
          <ViewToggle value={view} onChange={onView} />
        </div>
      )}
      <p className="mt-2 text-xs text-fg-muted sm:hidden">{summary}</p>

      <div id={panelId} className={`${open ? "mt-3 block" : "hidden"} space-y-3 sm:mt-0 sm:block`}>
        <DateRangeBar from={range.from} to={range.to} onChange={onRange} idPrefix="cartas" />
        <div className="flex flex-wrap items-center gap-2">
          <VersionSelect versions={versions} value={gameVersion} onChange={onVersion} />
          <SelectField
            label="Mín. jogos"
            title="Mínimo de partidas no período para o jogador ganhar uma carta"
            active={minMatches !== 3}
            value={minMatches}
            onChange={(e) => onMinMatches(Number(e.target.value))}
          >
            {MIN_MATCH_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
            {!MIN_MATCH_OPTIONS.includes(minMatches) && <option value={minMatches}>{minMatches}</option>}
          </SelectField>
          <SelectField label="Ordenar" title="Ordem das cartas na grade" active={sort !== "overall"} value={sort} onChange={(e) => onSort(e.target.value as CardSortKey)}>
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </SelectField>
          {onPlayer && (
            <SelectField
              label="Jogador"
              title="Mostra só as cartas de um jogador; Posição e Arquétipo passam a listar só o que ele jogou"
              active={playerId !== null}
              value={playerId ?? ""}
              onChange={(e) => onPlayer(e.target.value === "" ? null : Number(e.target.value))}
            >
              <option value="">Todos</option>
              {players.map((p) => (
                <option key={p.playerEntityId} value={p.playerEntityId}>
                  {p.name}
                </option>
              ))}
              {playerId !== null && !players.some((p) => p.playerEntityId === playerId) && <option value={playerId}>{playerName}</option>}
            </SelectField>
          )}
          {showArchetype && (
            <PositionArchetypeFilter
              positionValues={positionValues}
              value={archetypeFilter}
              onChange={onArchetypeFilter!}
              archetypeOptions={archetypeOptions}
              showCount
              countUnit={["jogador", "jogadores"]}
            />
          )}
          {onClearFilters && anyFilter && (
            <button type="button" onClick={onClearFilters} className="btn btn-secondary min-h-[44px] text-xs">
              Limpar filtros
            </button>
          )}
          <div className="ml-auto hidden items-center gap-3 sm:flex">
            {onView && <ViewToggle value={view} onChange={onView} />}
            <ModeToggle value={mode} onChange={onMode} />
          </div>
        </div>
      </div>
    </Card>
  );
}
