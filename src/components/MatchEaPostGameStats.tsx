import React, { useMemo, useState } from 'react';

import {
  ClubEventAggregatesDto,
  EventColumn,
  EventConfidence,
  EventDefinitionDto,
  MatchEventAggregatesResponseDto,
} from '../types/matchEventAggregates.ts';
import {
  countUnknownIds,
  getColumnsForCategory,
  getEventValue,
  getUnknownColumns,
} from '../utils/parseMatchAggregates.ts';
import { crestUrl } from '../config/urls.ts';
import { Crest } from './ui.tsx';

// ─────────────────────────────────────────────────────────────────────────────
// Confidence helpers
// ─────────────────────────────────────────────────────────────────────────────

const CONFIDENCE_BADGE: Record<EventConfidence, { symbol: string; label: string; headerCls: string; dotCls: string }> = {
  confirmed: { symbol: '✓', label: 'Confirmado',  headerCls: 'text-fg-secondary',       dotCls: 'text-positive' },
  probable:  { symbol: '~', label: 'Provável',    headerCls: 'text-fg-muted',       dotCls: 'text-warning'  },
  ambiguous: { symbol: '✗', label: 'Incerto',     headerCls: 'text-fg-subtle italic', dotCls: 'text-negative'    },
};

// ─────────────────────────────────────────────────────────────────────────────
// ConfidenceFilter — toggle para mostrar/ocultar eventos por confiança
// ─────────────────────────────────────────────────────────────────────────────

type ConfidenceFilter = 'all' | 'confirmed+probable' | 'confirmed';

interface ConfidenceFilterProps {
  value: ConfidenceFilter;
  onChange: (v: ConfidenceFilter) => void;
  counts: { confirmed: number; probable: number; ambiguous: number };
}

const ConfidenceFilterBar: React.FC<ConfidenceFilterProps> = ({ value, onChange, counts }) => {
  const options: { key: ConfidenceFilter; label: string }[] = [
    { key: 'all',               label: `Todos (${counts.confirmed + counts.probable + counts.ambiguous})` },
    { key: 'confirmed+probable', label: `✓ + ~ (${counts.confirmed + counts.probable})` },
    { key: 'confirmed',          label: `✓ apenas (${counts.confirmed})` },
  ];
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-[10px] text-fg-subtle font-medium uppercase tracking-wide mr-0.5">Mostrar:</span>
      {options.map((opt) => (
        <button
          key={opt.key}
          onClick={() => onChange(opt.key)}
          className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all border ${
            value === opt.key
              ? 'bg-accent text-accent-fg border-accent'
              : 'bg-surface text-fg-muted border-border hover:border-border-strong hover:text-fg-secondary'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
};

function applyConfidenceFilter(columns: EventColumn[], filter: ConfidenceFilter): EventColumn[] {
  if (filter === 'all') return columns;
  if (filter === 'confirmed+probable') return columns.filter((c) => c.confidence !== 'ambiguous');
  return columns.filter((c) => c.confidence === 'confirmed');
}

// ─────────────────────────────────────────────────────────────────────────────
// MatchStatsTabs — navegação por abas
// ─────────────────────────────────────────────────────────────────────────────

const UNKNOWN_TAB = 'Desconhecidos';

interface MatchStatsTabsProps {
  categories: string[];
  activeTab: string;
  onChange: (tab: string) => void;
  unknownCount: number;
}

const MatchStatsTabs: React.FC<MatchStatsTabsProps> = ({
  categories,
  activeTab,
  onChange,
  unknownCount,
}) => {
  const allTabs = [...categories, UNKNOWN_TAB];

  return (
    <div className="flex overflow-x-auto gap-1 p-1 bg-surface-sunken rounded-xl">
      {allTabs.map((tab) => (
        <button
          key={tab}
          onClick={() => onChange(tab)}
          className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
            activeTab === tab
              ? 'bg-surface text-fg shadow-sm font-semibold'
              : 'text-fg-muted hover:text-fg hover:bg-surface-raised'
          }`}
        >
          {tab}
          {tab === UNKNOWN_TAB && unknownCount > 0 && (
            <span className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-border text-fg-muted text-[9px] font-bold">
              {unknownCount > 99 ? '99+' : unknownCount}
            </span>
          )}
        </button>
      ))}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// PlayerEventTable — tabela jogadores × colunas
// ─────────────────────────────────────────────────────────────────────────────

interface PlayerEventTableProps {
  club: ClubEventAggregatesDto;
  columns: EventColumn[];
}

const PlayerEventTable: React.FC<PlayerEventTableProps> = ({ club, columns }) => {
  const maxByCol = useMemo(() => {
    const map: Record<string, number> = {};
    for (const col of columns) {
      map[col.id] = Math.max(0, ...club.players.map((p) => getEventValue(p.events, col.id)));
    }
    return map;
  }, [club.players, columns]);

  if (club.players.length === 0) {
    return (
      <p className="text-xs text-fg-subtle italic py-3 px-2">
        Sem dados de jogadores para este clube.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="bg-surface-raised border-b border-border">
            <th className="sticky left-0 z-10 bg-surface-raised text-left px-3 py-2 font-semibold text-fg-muted whitespace-nowrap min-w-[110px]">
              Jogador
            </th>
            {columns.map((col) => {
              const badge = CONFIDENCE_BADGE[col.confidence];
              return (
                <th
                  key={col.id}
                  className={`px-2 py-2 text-center font-semibold whitespace-nowrap ${badge.headerCls}`}
                  title={`ID ${col.id} · ${badge.label}`}
                >
                  <div className="flex items-center justify-center gap-0.5 leading-tight">
                    <span className={`text-[9px] font-bold leading-none shrink-0 ${badge.dotCls}`}>
                      {badge.symbol}
                    </span>
                    <span className="text-[11px]">{col.label}</span>
                  </div>
                  <div className="text-[9px] font-normal text-fg-subtle mt-0.5">ID {col.id}</div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {club.players.map((player, rowIdx) => (
            <tr
              key={player.playerId}
              className={`border-b border-border last:border-0 ${
                rowIdx % 2 === 0 ? 'bg-surface' : 'bg-surface-raised/40'
              } hover:bg-surface-raised transition-colors`}
            >
              <td
                className={`sticky left-0 z-10 px-3 py-2 font-medium text-fg whitespace-nowrap ${
                  rowIdx % 2 === 0 ? 'bg-surface' : 'bg-surface-raised/40'
                }`}
              >
                {player.playerName}
              </td>
              {columns.map((col) => {
                const val = getEventValue(player.events, col.id);
                const isMax = val > 0 && val === maxByCol[col.id];
                const isAmbiguous = col.confidence === 'ambiguous';
                return (
                  <td key={col.id} className="px-2 py-2 text-center tabular-nums">
                    {val > 0 ? (
                      <span
                        className={`inline-block min-w-[22px] px-1 py-0.5 rounded font-semibold ${
                          isMax
                            ? 'bg-positive-soft text-positive-fg'
                            : isAmbiguous
                            ? 'text-fg-subtle'
                            : 'text-fg-secondary'
                        }`}
                      >
                        {val}
                      </span>
                    ) : (
                      <span className="text-fg-subtle text-[10px]">–</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// ClubSection
// ─────────────────────────────────────────────────────────────────────────────

interface ClubSectionProps {
  club: ClubEventAggregatesDto;
  columns: EventColumn[];
}

const ClubSection: React.FC<ClubSectionProps> = ({ club, columns }) => (
  <div className="flex flex-col gap-2">
    <div className="flex items-center gap-2">
      <Crest src={crestUrl(club.crestAssetId)} alt={club.clubName} size={24} />
      <span className="text-sm font-semibold text-fg-secondary truncate">{club.clubName}</span>
    </div>
    <PlayerEventTable club={club} columns={columns} />
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// MatchEaPostGameStats — componente principal
// ─────────────────────────────────────────────────────────────────────────────

export interface MatchEaPostGameStatsProps {
  data: MatchEventAggregatesResponseDto | null;
  loading?: boolean;
  error?: string | null;
}

export const MatchEaPostGameStats: React.FC<MatchEaPostGameStatsProps> = ({
  data,
  loading = false,
  error = null,
}) => {
  const [activeTab, setActiveTab]     = useState<string>('');
  const [confFilter, setConfFilter]   = useState<ConfidenceFilter>('confirmed+probable');

  const resolvedTab  = activeTab || data?.categories?.[0] || UNKNOWN_TAB;
  const definitions: EventDefinitionDto[] = data?.eventDefinitions ?? [];
  const clubs: ClubEventAggregatesDto[]   = data?.clubs ?? [];
  const categories: string[]              = data?.categories ?? [];

  const unknownCount = useMemo(() => countUnknownIds(clubs, definitions), [clubs, definitions]);

  // Colunas brutas (sem filtro de confiança)
  const rawColumns = useMemo<EventColumn[]>(() => {
    if (resolvedTab === UNKNOWN_TAB) return getUnknownColumns(clubs, definitions);
    return getColumnsForCategory(definitions, resolvedTab);
  }, [resolvedTab, clubs, definitions]);

  // Contagem por confiança (para o filtro)
  const confidenceCounts = useMemo(() => {
    const counts = { confirmed: 0, probable: 0, ambiguous: 0 };
    for (const col of rawColumns) {
      if (col.confidence in counts) counts[col.confidence as EventConfidence]++;
    }
    return counts;
  }, [rawColumns]);

  // Colunas após filtro
  const activeColumns = useMemo(
    () => resolvedTab === UNKNOWN_TAB ? rawColumns : applyConfidenceFilter(rawColumns, confFilter),
    [rawColumns, confFilter, resolvedTab],
  );

  // ── Skeleton ────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="bg-surface shadow-sm rounded-xl border overflow-hidden">
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 px-4 py-3 h-14 animate-pulse" />
        <div className="p-4 space-y-3">
          <div className="h-9 rounded-xl bg-surface-sunken animate-pulse" />
          <div className="h-40 rounded-lg bg-surface-raised animate-pulse" />
        </div>
      </div>
    );
  }

  // ── Erro ────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="bg-surface shadow-sm rounded-xl border p-4">
        <p className="text-sm text-negative-fg bg-negative-soft border border-negative/30 rounded p-2">{error}</p>
      </div>
    );
  }

  if (!data || clubs.length === 0) return null;

  return (
    <div className="bg-surface shadow-sm rounded-xl border overflow-hidden">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            {clubs.map((club) => (
              <div key={club.clubId} className="flex items-center gap-1.5">
                <Crest src={crestUrl(club.crestAssetId)} alt={club.clubName} size={24} />
                <span className="text-white text-sm font-semibold">{club.clubName}</span>
              </div>
            ))}
          </div>
          <span className="text-fg-subtle text-[10px] uppercase tracking-widest font-medium whitespace-nowrap">
            Eventos — Por jogador
          </span>
        </div>
      </div>

      {/* ── Abas ────────────────────────────────────────────────────────── */}
      <div className="px-3 pt-3 pb-1">
        <MatchStatsTabs
          categories={categories}
          activeTab={resolvedTab}
          onChange={(tab) => { setActiveTab(tab); }}
          unknownCount={unknownCount}
        />
      </div>

      {/* ── Filtro de confiança (oculto na aba Desconhecidos) ─────────────── */}
      {resolvedTab !== UNKNOWN_TAB && (
        <div className="px-3 pt-1.5 pb-2 flex items-center justify-between gap-2 flex-wrap border-b border-border">
          <ConfidenceFilterBar
            value={confFilter}
            onChange={setConfFilter}
            counts={confidenceCounts}
          />
          {/* Legenda inline */}
          <div className="flex items-center gap-3 text-[10px] text-fg-subtle">
            <span><span className="text-positive font-bold">✓</span> confirmado</span>
            <span><span className="text-warning font-bold">~</span> provável</span>
            <span><span className="text-negative font-bold">✗</span> incerto</span>
          </div>
        </div>
      )}

      {/* ── Aviso: aba Desconhecidos ──────────────────────────────────────── */}
      {resolvedTab === UNKNOWN_TAB && activeColumns.length > 0 && (
        <div className="px-4 py-2 bg-warning-soft border-b border-warning/30">
          <p className="text-[11px] text-warning-fg">
            <span className="font-semibold">IDs sem mapeamento</span> — eventos presentes nesta partida
            que ainda não foram identificados. Valores mais altos e recorrentes ajudam no mapeamento.
          </p>
        </div>
      )}

      {/* ── Tabelas ─────────────────────────────────────────────────────── */}
      {resolvedTab === UNKNOWN_TAB && activeColumns.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-fg-subtle">
          Todos os eventos desta partida estão mapeados. ✓
        </div>
      ) : activeColumns.length === 0 ? (
        <div className="px-4 py-6 text-center text-xs text-fg-subtle italic">
          Nenhum evento com o nível de confiança selecionado nesta categoria.
        </div>
      ) : (
        <div
          className={`px-3 pb-3 pt-2 grid gap-4 ${clubs.length >= 2 ? 'lg:grid-cols-2' : 'grid-cols-1'}`}
        >
          {clubs.map((club) => (
            <ClubSection key={club.clubId} club={club} columns={activeColumns} />
          ))}
        </div>
      )}
    </div>
  );
};
