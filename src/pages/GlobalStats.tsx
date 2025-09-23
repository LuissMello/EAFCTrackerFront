// src/pages/PlayerStatisticsPage.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../services/api.ts";
import { useClub } from "../hooks/useClub.tsx";
import { classifyStat } from "../utils/statClassifier.ts";
import { StatQualityIndicator } from "../components/StatQualityIndicator.tsx";
import { Tooltip } from "../components/Tooltip.tsx";

/* Tipos (iguais aos seus) */
interface PlayerStats {
  playerId: number;
  playerName: string;
  clubId: number;
  matchesPlayed: number;
  totalGoals: number;
  totalGoalsConceded: number;
  totalAssists: number;
  totalShots: number;
  totalPassesMade: number;
  totalPassAttempts: number;
  totalTacklesMade: number;
  totalTackleAttempts: number;
  totalWins: number;
  totalLosses: number;
  totalDraws: number;
  totalCleanSheets: number;
  totalRedCards: number;
  totalSaves: number;
  totalMom: number;
  avgRating: number;
  passAccuracyPercent: number;
  tackleSuccessPercent: number;
  goalAccuracyPercent: number;
  winPercent: number;
}

interface ClubStats {
  clubId: number;
  clubName: string;
  matchesPlayed: number;
  totalGoals: number;
  totalGoalsConceded: number;
  totalAssists: number;
  totalShots: number;
  totalPassesMade: number;
  totalPassAttempts: number;
  totalTacklesMade: number;
  totalTackleAttempts: number;
  totalWins: number;
  totalLosses: number;
  totalDraws: number;
  totalCleanSheets: number;
  totalRedCards: number;
  totalSaves: number;
  totalMom: number;
  avgRating: number;
  winPercent: number;
  passAccuracyPercent: number;
  goalAccuracyPercent: number;
  totalGoalsAgainst?: number;
}

/* Utils */
const pct = (num: number, den: number) => (den > 0 ? (num / den) * 100 : 0);
const clamp = (v: number, min = 0, max = 100) => Math.max(min, Math.min(max, v));

function useNumberFormats() {
  const int = useMemo(() => new Intl.NumberFormat("pt-BR"), []);
  const p1 = useMemo(() => new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }), []);
  const p2 = useMemo(() => new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }), []);
  return { int, p1, p2 };
}

function SortIcon({ active, order }: { active: boolean; order: "asc" | "desc" }) {
  if (!active)
    return (
      <span aria-hidden className="opacity-30">
        ↕
      </span>
    );
  return <span aria-hidden>{order === "asc" ? "▲" : "▼"}</span>;
}

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded ${className}`} />;
}

function StatCard({
  label,
  value,
  sub,
  statType,
  rawValue,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  statType?: string;
  rawValue?: number;
}) {
  const quality = statType && rawValue !== undefined ? classifyStat(statType, rawValue) : null;

  return (
    <div className="rounded-2xl border bg-white shadow-sm p-4 flex flex-col gap-1">
      <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
      <div className="text-2xl font-semibold leading-tight flex items-center gap-2">
        {value}
        {quality && <StatQualityIndicator quality={quality} size="medium" />}
      </div>
      {sub ? <div className="text-xs text-gray-500">{sub}</div> : null}
    </div>
  );
}

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
  const { int, p1, p2 } = useNumberFormats();

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

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortOrder((o) => (o === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortOrder("desc");
    }
  }

  // Filtros/orden.
  const deferredSearch = search;
  const filtered = useMemo(() => {
    const term = deferredSearch.trim().toLowerCase();
    return players
      .filter((p) => p.matchesPlayed >= minMatches)
      .filter((p) => (term ? p.playerName.toLowerCase().includes(term) : true));
  }, [players, minMatches, deferredSearch]);

  const sorted = useMemo(() => {
    const cp = [...filtered];
    cp.sort((a, b) => {
      const va = a[sortKey] as any;
      const vb = b[sortKey] as any;
      if (typeof va === "number" && typeof vb === "number") return sortOrder === "asc" ? va - vb : vb - va;
      const sa = String(va);
      const sb = String(vb);
      return sortOrder === "asc" ? sa.localeCompare(sb) : sb.localeCompare(sa);
    });
    return cp;
  }, [filtered, sortKey, sortOrder]);

  // Escalas barras
  const maxByKey = useMemo(() => {
    const keys: (keyof PlayerStats)[] = [
      "totalGoals",
      "totalAssists",
      "totalShots",
      "totalPassesMade",
      "totalTacklesMade",
      "avgRating",
      "winPercent",
      "passAccuracyPercent",
      "tackleSuccessPercent",
      "goalAccuracyPercent",
      "totalSaves",
    ];
    const res = new Map<keyof PlayerStats, number>();
    keys.forEach((k) => res.set(k, Math.max(1, ...filtered.map((p) => Number(p[k]) || 0))));
    return res;
  }, [filtered]);

  // paginação
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const pageItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, page, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [minMatches, search, sortKey, sortOrder, pageSize, oppPlayers, groupClubIds.join(",")]);

  const clubGoalsAgainst = Number(clubStats?.totalGoalsConceded || 0);

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

      {/* Cartões do clube */}
      <section className="mb-6">
        {loading && !clubStats && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
        )}

        {clubStats && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard label="Partidas" value={int.format(clubStats.matchesPlayed)} />
            <StatCard
              label="Gols / Assist."
              value={`${int.format(clubStats.totalGoals)} / ${int.format(clubStats.totalAssists)}`}
            />
            <StatCard
              label="Chutes (G/T)"
              value={`${int.format(clubStats.totalGoals)} / ${int.format(clubStats.totalShots)}`}
              sub={`${p1.format(clubStats.goalAccuracyPercent)}% de conversão`}
              statType="shotToGoalConversion"
              rawValue={clubStats.goalAccuracyPercent}
            />
            <StatCard
              label="Passes (C/T)"
              value={`${int.format(clubStats.totalPassesMade)} / ${int.format(clubStats.totalPassAttempts)}`}
              sub={`${p1.format(pct(clubStats.totalPassesMade, clubStats.totalPassAttempts))}% de acerto`}
              statType="passCompletion"
              rawValue={pct(clubStats.totalPassesMade, clubStats.totalPassAttempts)}
            />
            <StatCard
              label="Desarmes (C/T)"
              value={`${int.format(clubStats.totalTacklesMade)} / ${int.format(clubStats.totalTackleAttempts)}`}
              sub={`${p1.format(pct(clubStats.totalTacklesMade, clubStats.totalTackleAttempts))}% de sucesso`}
              statType="tackleDuelWin"
              rawValue={pct(clubStats.totalTacklesMade, clubStats.totalTackleAttempts)}
            />
            <StatCard
              label="Resultados"
              value={`${int.format(clubStats.totalWins)}V / ${int.format(clubStats.totalDraws)}E / ${int.format(
                clubStats.totalLosses
              )}D`}
              sub={`${p1.format(clubStats.winPercent)}% vitórias`}
              statType="winRate"
              rawValue={clubStats.winPercent}
            />
            <StatCard
              label="Vermelhos / MOM"
              value={`${int.format(clubStats.totalRedCards)} / ${int.format(clubStats.totalMom)}`}
            />
            <StatCard label="Nota média" value={p2.format(Number(clubStats.avgRating || 0))} />
          </div>
        )}

        {!loading && !clubStats && !error && (
          <div className="p-3 bg-gray-50 rounded border text-gray-700">Sem estatísticas de clube disponíveis.</div>
        )}
        {error && <div className="p-3 bg-red-50 rounded border border-red-200 text-red-700">{error}</div>}
      </section>

      {/* Tabela */}
      <section>
        <h2 className="text-xl font-bold mb-2 text-center">Estatísticas dos Jogadores</h2>

        <div className="overflow-x-auto rounded-lg border bg-white shadow">
          <table className="table-auto w-full text-sm text-center">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                {[
                  { key: "playerName", label: "Jogador", tooltip: "Nome do jogador" },
                  { key: "matchesPlayed", label: "Partidas" },
                  { key: "totalGoals", label: "Gols" },
                  { key: "totalAssists", label: "Assistências" },
                  { key: "totalShots", label: "Chutes (G/T)", tooltip: "Gols / Tentativas totais e % de conversão" },
                  {
                    key: "totalSaves",
                    label: "Defesas (S/Gc)",
                    tooltip: "Defesas e Gols Sofridos do CLUBE no período: % = S / (S + Gc)",
                  },
                  { key: "totalPassesMade", label: "Passes (C/T)", tooltip: "Completos / Tentados e %" },
                  { key: "totalTacklesMade", label: "Desarmes (C/T)", tooltip: "Completos / Tentados e %" },
                  { key: "totalWins", label: "Vitórias" },
                  { key: "totalLosses", label: "Derrotas" },
                  { key: "totalDraws", label: "Empates" },
                  { key: "winPercent", label: "Win %" },
                  { key: "totalRedCards", label: "Vermelhos" },
                  { key: "totalMom", label: "MOM" },
                  { key: "avgRating", label: "Nota" },
                ].map((c) => {
                  const headerContent = (
                    <div className="flex items-center justify-center gap-1">
                      <span>{(c as any).label}</span>
                      <SortIcon active={sortKey === (c.key as keyof PlayerStats)} order={sortOrder} />
                    </div>
                  );
                  
                  return (
                    <th
                      key={c.key as string}
                      onClick={() => handleSort(c.key as keyof PlayerStats)}
                      className="px-3 py-2 cursor-pointer select-none hover:bg-gray-100"
                      aria-sort={
                        sortKey === (c.key as keyof PlayerStats)
                          ? sortOrder === "asc"
                            ? "ascending"
                            : "descending"
                          : "none"
                      }
                      scope="col"
                    >
                      {(c as any).tooltip ? (
                        <Tooltip content={(c as any).tooltip}>
                          {headerContent}
                        </Tooltip>
                      ) : (
                        headerContent
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={25} className="p-4">
                    <div className="space-y-2">
                      <Skeleton className="h-6" />
                      <Skeleton className="h-6" />
                      <Skeleton className="h-6" />
                    </div>
                  </td>
                </tr>
              )}

              {!loading && pageItems.length === 0 && (
                <tr>
                  <td colSpan={25} className="p-4 text-gray-600">
                    Nenhum jogador encontrado.
                  </td>
                </tr>
              )}

              {!loading &&
                pageItems.map((p) => {
                  const saves = Number(p.totalSaves || 0);
                  const conceded = clubGoalsAgainst;
                  const savePct = pct(saves, saves + conceded);
                  return (
                    <tr key={p.playerId} className="hover:bg-gray-50">
                      <td className="px-3 py-2 font-medium text-left sticky left-0 bg-white/95 backdrop-blur">
                        {p.playerName}
                      </td>
                      <td className="px-3 py-2">{int.format(p.matchesPlayed)}</td>
                      <td className="px-3 py-2">
                        <CellBar
                          value={p.totalGoals}
                          max={maxByKey.get("totalGoals") || 1}
                          format={(v) => int.format(v)}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <CellBar
                          value={p.totalAssists}
                          max={maxByKey.get("totalAssists") || 1}
                          format={(v) => int.format(v)}
                        />
                      </td>
                      <td className="px-3 py-2">
                        {int.format(p.totalGoals)} / {int.format(p.totalShots)}
                        <div className="mt-1">
                          <CellBar 
                            value={p.goalAccuracyPercent} 
                            max={100} 
                            suffix="%" 
                            positive 
                            format={(v) => p1.format(v)}
                            statType="shotToGoalConversion"
                          />
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        {int.format(saves)} / {int.format(conceded)}
                        <div className="mt-1">
                          <CellBar value={savePct} max={100} suffix="%" positive format={(v) => p1.format(v)} />
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        {int.format(p.totalPassesMade)} / {int.format(p.totalPassAttempts)}
                        <div className="mt-1">
                          <CellBar
                            value={pct(p.totalPassesMade, p.totalPassAttempts)}
                            max={100}
                            suffix="%"
                            positive
                            format={(v) => p1.format(v)}
                            statType="passCompletion"
                          />
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        {int.format(p.totalTacklesMade)} / {int.format(p.totalTackleAttempts)}
                        <div className="mt-1">
                          <CellBar
                            value={pct(p.totalTacklesMade, p.totalTackleAttempts)}
                            max={100}
                            suffix="%"
                            positive
                            format={(v) => p1.format(v)}
                            statType="tackleDuelWin"
                          />
                        </div>
                      </td>
                      <td className="px-3 py-2">{int.format(p.totalWins)}</td>
                      <td className="px-3 py-2">{int.format(p.totalLosses)}</td>
                      <td className="px-3 py-2">{int.format(p.totalDraws)}</td>
                      <td className="px-3 py-2">
                        <CellBar 
                          value={p.winPercent} 
                          max={100} 
                          suffix="%" 
                          positive 
                          format={(v) => p1.format(v)}
                          statType="winRate"
                        />
                      </td>
                      <td className="px-3 py-2">{int.format(p.totalRedCards)}</td>
                      <td className="px-3 py-2">{int.format(p.totalMom)}</td>
                      <td className="px-3 py-2">{p2.format(Number(p.avgRating || 0))}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>

        {/* Paginação */}
        <div className="mt-3 flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
          <div className="text-sm text-gray-600">
            Mostrando {pageItems.length} de {sorted.length} jogadores (pág. {page}/{totalPages})
            {oppPlayers !== "all" ? (
              <>
                {" "}
                - filtro adversário: <strong>{oppPlayers}</strong> jogadores
              </>
            ) : null}
          </div>
          <div className="flex gap-2">
            <button
              className="px-3 py-1 rounded border bg-white disabled:opacity-50"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              Anterior
            </button>
            <button
              className="px-3 py-1 rounded border bg-white disabled:opacity-50"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              Próxima
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

/* CellBar */
function CellBar({
  value,
  max,
  suffix = "",
  positive = false,
  format = (n: number) => String(n),
  statType,
}: {
  value: number;
  max: number;
  suffix?: string;
  positive?: boolean;
  format?: (n: number) => string;
  statType?: string;
}) {
  const width = clamp((value / (max || 1)) * 100);
  const quality = statType ? classifyStat(statType, value) : null;

  // Determine bar color based on quality
  let barColor = positive ? "bg-emerald-200" : "bg-gray-300";
  if (quality) {
    const qualityColors = {
      poor: "bg-red-200",
      decent: "bg-orange-200",
      good: "bg-green-200",
      veryGood: "bg-blue-200",
    };
    barColor = qualityColors[quality.level];
  }

  return (
    <div className="relative w-full h-6 rounded-md border border-gray-200 overflow-hidden bg-gray-50">
      <div className={`h-full ${barColor}`} style={{ width: `${width}%` }} />
      <div className="absolute inset-0 grid place-items-center text-xs font-medium">
        {format(value)}
        {suffix}
      </div>
    </div>
  );
}
