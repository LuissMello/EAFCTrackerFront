import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../services/api.ts";
import { useClub } from "../hooks/useClub.tsx";
import { PlayerStats, ClubStats } from "../types/stats";
import { TeamStatsSection } from "../components/TeamStatsSection.tsx";
import { PlayerStatsTable } from "../components/PlayerStatsTable.tsx";

export default function PlayerStatisticsPage() {
  const { club } = useClub();
  const fallbackClubId = club?.clubId ?? null;

  const [searchParams, setSearchParams] = useSearchParams();

  // Lê os clubIds da URL (?clubIds=1,2,3). Se não houver, usa clubId único (back-compat).
  const groupClubIds = useMemo(() => {
    const raw = searchParams.get("clubIds");
    if (raw && raw.trim().length) {
      return raw
        .split(",")
        .map((s) => parseInt(s, 10))
        .filter((n) => !Number.isNaN(n));
    }
    return fallbackClubId ? [fallbackClubId] : [];
  }, [searchParams, fallbackClubId]);

  // estado
  const [players, setPlayers] = useState<PlayerStats[]>([]);
  const [clubStats, setClubStats] = useState<ClubStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // preferências
  const [matchCount, setMatchCount] = useState<number>(() => Number(localStorage.getItem("psp.matchCount")) || 10);
  const [minMatches, setMinMatches] = useState<number>(() => Number(localStorage.getItem("psp.minMatches")) || 1);
  const [search, setSearch] = useState<string>("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(() => Number(localStorage.getItem("psp.pageSize")) || 20);

  // filtro por quantidade de jogadores do adversário
  const initialOpp = (() => {
    const raw = localStorage.getItem("psp.opp");
    if (!raw || raw === "all") return "all" as const;
    const n = parseInt(raw, 10);
    return !Number.isNaN(n) && n >= 2 && n <= 11 ? (n as number) : ("all" as const);
  })();
  const [oppPlayers, setOppPlayers] = useState<number | "all">(initialOpp);

  type SortKey = keyof PlayerStats;
  type SortOrder = "asc" | "desc";
  const [sortKey, setSortKey] = useState<SortKey>(
    () => (localStorage.getItem("psp.sortKey") as SortKey) || "totalGoals"
  );
  const [sortOrder, setSortOrder] = useState<SortOrder>(
    () => (localStorage.getItem("psp.sortOrder") as SortOrder) || "desc"
  );

  const abortRef = useRef<AbortController | null>(null);

  // Persistência leve
  useEffect(() => {
    localStorage.setItem("psp.matchCount", String(matchCount));
  }, [matchCount]);
  useEffect(() => {
    localStorage.setItem("psp.minMatches", String(minMatches));
  }, [minMatches]);
  useEffect(() => {
    localStorage.setItem("psp.pageSize", String(pageSize));
  }, [pageSize]);
  useEffect(() => {
    localStorage.setItem("psp.sortKey", sortKey);
  }, [sortKey]);
  useEffect(() => {
    localStorage.setItem("psp.sortOrder", sortOrder);
  }, [sortOrder]);
  useEffect(() => {
    localStorage.setItem("psp.opp", oppPlayers === "all" ? "all" : String(oppPlayers));
  }, [oppPlayers]);

  // Atualiza URL quando o usuário muda a seleção via picker local da página (opcional)
  const handleClubIdsChange = (ids: number[]) => {
    const next = new URLSearchParams(searchParams);
    if (ids.length) next.set("clubIds", ids.join(","));
    else next.delete("clubIds");
    // manter também clubId quando houver somente 1 (back-compat)
    if (ids.length === 1) next.set("clubId", String(ids[0]));
    else next.delete("clubId");
    setSearchParams(next, { replace: true });
  };

  const fetchStats = useCallback(
    async (count: number) => {
      setError(null);
      setFetching(true);
      setLoading(true);

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const ids = groupClubIds;
        const isGrouped = ids.length > 1;
        if (!isGrouped) {
          const singleId = ids[0] ?? null;
          if (!singleId) {
            setPlayers([]);
            setClubStats(null);
            setLoading(false);
            return;
          }
          const params: Record<string, any> = { count };
          if (oppPlayers !== "all") params.opponentCount = oppPlayers;

          const { data } = await api.get(
            `https://eafctracker-cvadcceuerbgegdj.brazilsouth-01.azurewebsites.net/api/clubs/${singleId}/matches/statistics/limited`,
            { params, signal: controller.signal }
          );
          setPlayers(data.players ?? []);
          setClubStats(data.clubs?.[0] ?? null);
        } else {
          const params: Record<string, any> = {
            count,
            clubIds: ids.join(","),
          };
          if (oppPlayers !== "all") params.opponentCount = oppPlayers;

          const { data } = await api.get(
            "https://eafctracker-cvadcceuerbgegdj.brazilsouth-01.azurewebsites.net/api/clubs/grouped/matches/statistics/limited",
            { params, signal: controller.signal }
          );
          setPlayers(data.players ?? []);
          setClubStats(data.clubs?.[0] ?? null);
        }
      } catch (err: any) {
        if (err?.name === "CanceledError" || err?.message === "canceled") return;
        setError(err?.message ?? "Erro ao buscar estatísticas.");
      } finally {
        setLoading(false);
        setFetching(false);
      }
    },
    [groupClubIds, oppPlayers]
  );

  useEffect(() => {
    fetchStats(matchCount);
  }, [fetchStats, matchCount]);

  return (
    <div className="p-4 sm:p-6 max-w-[98vw] mx-auto">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 mb-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl sm:text-3xl font-bold">Estatísticas</h1>
          {fetching && (
            <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" /> Atualizando…
            </span>
          )}
        </div>
        <div className="text-sm text-gray-600">
          {groupClubIds.length > 1 ? (
            <>
              Agrupando clubes: <span className="font-semibold">{groupClubIds.join(", ")}</span>
            </>
          ) : (
            <>
              Clube atual: <span className="font-semibold">{groupClubIds[0] ?? "-"}</span>
            </>
          )}
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-4">
        <div className="flex gap-2 flex-wrap items-end">
          <div className="flex flex-col">
            <label htmlFor="matchCount" className="text-sm text-gray-600">
              Últimas partidas
            </label>
            <div className="flex items-center gap-2">
              <input
                id="matchCount"
                type="number"
                min={1}
                value={matchCount}
                onChange={(e) => setMatchCount(Math.max(1, Number(e.target.value) || 1))}
                className="border rounded-lg px-3 py-2 w-28"
              />
              <button
                onClick={() => fetchStats(matchCount)}
                className="px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
              >
                Atualizar
              </button>
            </div>
          </div>

          <div className="flex flex-col">
            <label htmlFor="search" className="text-sm text-gray-600">
              Buscar jogador
            </label>
            <input
              id="search"
              type="text"
              placeholder="Nome do jogador"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="border rounded-lg px-3 py-2 w-56"
            />
          </div>

          {/* Filtro por jogadores do adversário */}
          <div className="flex flex-col">
            <label htmlFor="oppPlayers" className="text-sm text-gray-600">
              Adversário (jogadores)
            </label>
            <select
              id="oppPlayers"
              className="border rounded-lg px-3 py-2 w-40"
              value={oppPlayers}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "all") setOppPlayers("all");
                else {
                  const n = parseInt(v, 10);
                  setOppPlayers(!Number.isNaN(n) ? Math.min(11, Math.max(2, n)) : "all");
                }
              }}
              title="Filtra as partidas consideradas nas estatísticas pela quantidade de jogadores do time adversário (2 a 11)."
            >
              <option value="all">Todos</option>
              {Array.from({ length: 10 }, (_, i) => i + 2).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col">
            <label htmlFor="pageSize" className="text-sm text-gray-600">
              Itens por página
            </label>
            <select
              id="pageSize"
              className="border rounded-lg px-3 py-2 w-36"
              value={pageSize}
              onChange={(e) => setPageSize(Math.max(5, Number(e.target.value) || 20))}
            >
              {[10, 20, 30, 50, 100].map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <TeamStatsSection clubStats={clubStats} loading={loading} error={error} />

      <PlayerStatsTable
        players={players}
        loading={loading}
        error={error}
        clubStats={clubStats}
        minMatches={minMatches}
        searchTerm={search}
        initialSortKey={sortKey}
        initialSortOrder={sortOrder}
        pageSize={pageSize}
        onSortChange={(key, order) => {
          setSortKey(key);
          setSortOrder(order);
        }}
      />
    </div>
  );
}
