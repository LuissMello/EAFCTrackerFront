import React, { useMemo, useState } from 'react';

import {
  ClubEventAggregatesDto,
  EventColumn,
  EventDefinitionDto,
  MatchEventAggregatesResponseDto,
} from '../types/matchEventAggregates.ts';
import {
  countUnknownIds,
  getColumnsForCategory,
  getEventValue,
  getUnknownColumns,
} from '../utils/parseMatchAggregates.ts';
import { crestUrl, FALLBACK_LOGO } from '../config/urls.ts';

// ─────────────────────────────────────────────────────────────────────────────
// MatchStatsTabs — navegação por abas (categorias vêm do backend)
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
    <div className="flex overflow-x-auto gap-1 p-1 bg-gray-100 rounded-xl">
      {allTabs.map((tab) => (
        <button
          key={tab}
          onClick={() => onChange(tab)}
          className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
            activeTab === tab
              ? 'bg-white text-gray-900 shadow-sm font-semibold'
              : 'text-gray-500 hover:text-gray-800 hover:bg-white/60'
          }`}
        >
          {tab}
          {tab === UNKNOWN_TAB && unknownCount > 0 && (
            <span className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-gray-300 text-gray-600 text-[9px] font-bold">
              {unknownCount > 99 ? '99+' : unknownCount}
            </span>
          )}
        </button>
      ))}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// PlayerEventTable — tabela de jogadores × colunas de eventos
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
      <p className="text-xs text-gray-400 italic py-3 px-2">
        Sem dados de jogadores para este clube.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-100">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="sticky left-0 z-10 bg-gray-50 text-left px-3 py-2 font-semibold text-gray-600 whitespace-nowrap min-w-[110px]">
              Jogador
            </th>
            {columns.map((col) => (
              <th
                key={col.id}
                className="px-3 py-2 text-center font-semibold text-gray-600 whitespace-nowrap"
                title={`ID ${col.id}`}
              >
                <div className="leading-tight">{col.label}</div>
                <div className="text-[9px] font-normal text-gray-400 mt-0.5">ID {col.id}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {club.players.map((player, rowIdx) => (
            <tr
              key={player.playerId}
              className={`border-b border-gray-100 last:border-0 ${
                rowIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'
              } hover:bg-blue-50/30 transition-colors`}
            >
              <td
                className={`sticky left-0 z-10 px-3 py-2 font-medium text-gray-800 whitespace-nowrap ${
                  rowIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'
                }`}
              >
                {player.playerName}
              </td>
              {columns.map((col) => {
                const val = getEventValue(player.events, col.id);
                const isMax = val > 0 && val === maxByCol[col.id];
                return (
                  <td key={col.id} className="px-3 py-2 text-center tabular-nums">
                    <span
                      className={`inline-block min-w-[24px] px-1.5 py-0.5 rounded font-semibold ${
                        isMax
                          ? 'bg-emerald-100 text-emerald-700'
                          : val > 0
                          ? 'text-gray-700'
                          : 'text-gray-300'
                      }`}
                    >
                      {val}
                    </span>
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
// ClubSection — cabeçalho do clube + tabela
// ─────────────────────────────────────────────────────────────────────────────

interface ClubSectionProps {
  club: ClubEventAggregatesDto;
  columns: EventColumn[];
}

const ClubSection: React.FC<ClubSectionProps> = ({ club, columns }) => (
  <div className="flex flex-col gap-2">
    <div className="flex items-center gap-2">
      <img
        src={crestUrl(club.crestAssetId)}
        onError={(e) => (e.currentTarget.src = FALLBACK_LOGO)}
        alt={club.clubName}
        className="w-6 h-6 object-contain"
      />
      <span className="text-sm font-semibold text-gray-700 truncate">{club.clubName}</span>
    </div>
    <PlayerEventTable club={club} columns={columns} />
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// MatchEaPostGameStats — componente principal exportado
// ─────────────────────────────────────────────────────────────────────────────

export interface MatchEaPostGameStatsProps {
  /** Resposta completa do endpoint /event-aggregates (definições vêm do backend) */
  data: MatchEventAggregatesResponseDto | null;
  loading?: boolean;
  error?: string | null;
}

export const MatchEaPostGameStats: React.FC<MatchEaPostGameStatsProps> = ({
  data,
  loading = false,
  error = null,
}) => {
  const [activeTab, setActiveTab] = useState<string>('');

  // Inicializa a aba ativa com a primeira categoria do backend
  const resolvedTab = activeTab || data?.categories?.[0] || UNKNOWN_TAB;

  const definitions: EventDefinitionDto[] = data?.eventDefinitions ?? [];
  const clubs: ClubEventAggregatesDto[] = data?.clubs ?? [];
  const categories: string[] = data?.categories ?? [];

  const unknownCount = useMemo(() => countUnknownIds(clubs, definitions), [clubs, definitions]);

  const activeColumns = useMemo<EventColumn[]>(() => {
    if (resolvedTab === UNKNOWN_TAB) return getUnknownColumns(clubs, definitions);
    return getColumnsForCategory(definitions, resolvedTab);
  }, [resolvedTab, clubs, definitions]);

  // ── Skeleton ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="bg-white shadow-sm rounded-xl border overflow-hidden">
        <div className="bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 px-4 py-3 h-14 animate-pulse" />
        <div className="p-4 space-y-3">
          <div className="h-9 rounded-xl bg-gray-100 animate-pulse" />
          <div className="h-40 rounded-lg bg-gray-50 animate-pulse" />
        </div>
      </div>
    );
  }

  // ── Erro ──────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="bg-white shadow-sm rounded-xl border p-4">
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">{error}</p>
      </div>
    );
  }

  // ── Sem dados ─────────────────────────────────────────────────────────────
  if (!data || clubs.length === 0) return null;

  return (
    <div className="bg-white shadow-sm rounded-xl border overflow-hidden">
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            {clubs.map((club) => (
              <div key={club.clubId} className="flex items-center gap-1.5">
                <img
                  src={crestUrl(club.crestAssetId)}
                  onError={(e) => (e.currentTarget.src = FALLBACK_LOGO)}
                  alt={club.clubName}
                  className="w-6 h-6 object-contain"
                />
                <span className="text-white text-sm font-semibold">{club.clubName}</span>
              </div>
            ))}
          </div>
          <span className="text-gray-400 text-[10px] uppercase tracking-widest font-medium whitespace-nowrap">
            Eventos — Por jogador
          </span>
        </div>
      </div>

      {/* ── Abas ─────────────────────────────────────────────────────────── */}
      <div className="px-3 pt-3 pb-2">
        <MatchStatsTabs
          categories={categories}
          activeTab={resolvedTab}
          onChange={setActiveTab}
          unknownCount={unknownCount}
        />
      </div>

      {/* ── Tabelas por clube ─────────────────────────────────────────────── */}
      {resolvedTab === UNKNOWN_TAB && activeColumns.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-gray-400">
          Todos os eventos desta partida estão mapeados. ✓
        </div>
      ) : (
        <div
          className={`px-3 pb-3 grid gap-4 ${clubs.length >= 2 ? 'lg:grid-cols-2' : 'grid-cols-1'}`}
        >
          {clubs.map((club) => (
            <ClubSection key={club.clubId} club={club} columns={activeColumns} />
          ))}
        </div>
      )}
    </div>
  );
};
