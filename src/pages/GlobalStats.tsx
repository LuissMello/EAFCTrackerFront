import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api, { isCanceled } from "../services/api.ts";
import { useClub } from "../hooks/useClub.tsx";
import { PlayerStats, ClubStats } from "../types/stats";
import { TeamStatsSection } from "../components/TeamStatsSection.tsx";
import { PlayerStatsTable } from "../components/PlayerStatsTable.tsx";
import { API_ENDPOINTS } from "../config/urls.ts";
import { useRefresh } from "../hooks/useRefresh.tsx";
import { Card, Field, FIELD_CLASS, PageHeader, PageShell } from "../components/ui.tsx";
import { useUrlEnum, useUrlParams, useUrlState, type UrlPatch } from "../hooks/useUrlState.ts";

const SORT_ORDERS = ["asc", "desc"] as const;

export default function PlayerStatisticsPage() {
  const { refreshKey } = useRefresh();
  const { club, selectedClubs } = useClub();
  const fallbackClubId = club?.clubId ?? null;

  const [searchParams, setSearchParams] = useSearchParams();

  // Lê os clubIds da URL (?clubIds=1,2,3). Se não houver, usa clubId único (back-compat).
  // A chave em string mantém o array estável: mudanças em outros parâmetros da URL não disparam nova busca.
  const groupClubIdsKey = (() => {
    const raw = searchParams.get("clubIds");
    if (raw && raw.trim().length) {
      return raw
        .split(",")
        .map((s) => parseInt(s, 10))
        .filter((n) => !Number.isNaN(n))
        .join(",");
    }
    return fallbackClubId ? String(fallbackClubId) : "";
  })();
  const groupClubIds = useMemo(
    () => (groupClubIdsKey ? groupClubIdsKey.split(",").map(Number) : []),
    [groupClubIdsKey]
  );

  // estado
  const [players, setPlayers] = useState<PlayerStats[]>([]);
  const [clubStats, setClubStats] = useState<ClubStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filtros na URL (?last=&opp=&size=&sort=&dir=&q=&min=). Valores padrão não aparecem na URL,
  // então o link copiado reproduz exatamente a tela.
  const [urlParams, patchUrl] = useUrlParams();
  const [matchCount, setMatchCount] = useUrlState("last", 10, { validate: (n) => n >= 1 });
  const [minMatches] = useUrlState("min", 1, { validate: (n) => n >= 0 });
  const [search, setSearch] = useUrlState("q", "");
  const [pageSize, setPageSize] = useUrlState("size", 20, { validate: (n) => n >= 5 });
  const [oppRaw, setOppRaw] = useUrlState("opp", "all");
  const oppPlayers: number | "all" = (() => {
    if (oppRaw === "all") return "all";
    const n = parseInt(oppRaw, 10);
    return !Number.isNaN(n) && n >= 2 && n <= 11 ? n : "all";
  })();
  const setOppPlayers = (v: number | "all") => setOppRaw(v === "all" ? "all" : String(v));

  type SortKey = keyof PlayerStats;
  type SortOrder = "asc" | "desc";
  const [sortKeyRaw, setSortKeyRaw] = useUrlState("sort", "totalGoals");
  const sortKey = sortKeyRaw as SortKey;
  const setSortKey = (k: SortKey) => setSortKeyRaw(String(k));
  const [sortOrder, setSortOrder] = useUrlEnum<SortOrder>("dir", "desc", SORT_ORDERS);

  // "Últimas partidas": texto livre (pode ficar vazio enquanto se digita) com commit após uma pausa
  const [countText, setCountText] = useState(String(matchCount));
  const countOk = /^\d+$/.test(countText.trim()) && parseInt(countText, 10) >= 1;
  useEffect(() => {
    if (!countOk) return;
    const n = parseInt(countText, 10);
    if (n === matchCount) return;
    const t = window.setTimeout(() => setMatchCount(n), 450);
    return () => window.clearTimeout(t);
  }, [countText, countOk, matchCount, setMatchCount]);
  // mudanças vindas da URL (voltar/avançar, link) refletem no campo
  useEffect(() => {
    setCountText((prev) => (parseInt(prev, 10) === matchCount ? prev : String(matchCount)));
  }, [matchCount]);

  const [page, setPage] = useState(1);

  const abortRef = useRef<AbortController | null>(null);

  // Migração única: preferências antigas (localStorage "psp.*") viram parâmetros da URL e são removidas.
  const migratedRef = useRef(false);
  useEffect(() => {
    if (migratedRef.current) return;
    migratedRef.current = true;
    try {
      const legacyKeys = ["psp.matchCount", "psp.minMatches", "psp.pageSize", "psp.sortKey", "psp.sortOrder", "psp.opp"];
      if (!legacyKeys.some((k) => localStorage.getItem(k) !== null)) return;
      const patch: UrlPatch = {};
      const num = (k: string) => Number(localStorage.getItem(k));
      if (!urlParams.has("last") && num("psp.matchCount") >= 1 && num("psp.matchCount") !== 10) patch.last = num("psp.matchCount");
      if (!urlParams.has("min") && num("psp.minMatches") >= 0 && num("psp.minMatches") !== 1 && localStorage.getItem("psp.minMatches")) patch.min = num("psp.minMatches");
      if (!urlParams.has("size") && num("psp.pageSize") >= 5 && num("psp.pageSize") !== 20) patch.size = num("psp.pageSize");
      const sk = localStorage.getItem("psp.sortKey");
      if (!urlParams.has("sort") && sk && sk !== "totalGoals") patch.sort = sk;
      const so = localStorage.getItem("psp.sortOrder");
      if (!urlParams.has("dir") && (so === "asc" || so === "desc") && so !== "desc") patch.dir = so;
      const opp = localStorage.getItem("psp.opp");
      if (!urlParams.has("opp") && opp && opp !== "all") {
        const n = parseInt(opp, 10);
        if (n >= 2 && n <= 11) patch.opp = n;
      }
      legacyKeys.forEach((k) => localStorage.removeItem(k));
      if (Object.keys(patch).length > 0) patchUrl(patch);
    } catch {
      /* storage indisponível */
    }
  }, [urlParams, patchUrl]);

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
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const { signal } = controller;

      setError(null);
      setFetching(true);
      setLoading(true);

      try {
        const ids = groupClubIds;
        const isGrouped = ids.length > 1;
        if (!isGrouped) {
          const singleId = ids[0] ?? null;
          if (!singleId) {
            setPlayers([]);
            setClubStats(null);
            return;
          }
          const params: Record<string, any> = { count };
          if (oppPlayers !== "all") params.opponentCount = oppPlayers;

          const { data } = await api.get(
            API_ENDPOINTS.CLUB_STATS(singleId),
            { params, signal }
          );
          if (signal.aborted) return;
          setPlayers(data.players ?? []);
          setClubStats(data.clubs?.[0] ?? null);
        } else {
          const params: Record<string, any> = {
            count,
            clubIds: ids.join(","),
          };
          if (oppPlayers !== "all") params.opponentCount = oppPlayers;

          const { data } = await api.get(
            API_ENDPOINTS.CLUB_STATS_GROUPED,
            { params, signal }
          );
          if (signal.aborted) return;
          setPlayers(data.players ?? []);
          setClubStats(data.clubs?.[0] ?? null);
        }
      } catch (err: any) {
        if (signal.aborted || isCanceled(err)) return;
        setError(err?.message ?? "Erro ao buscar estatísticas.");
      } finally {
        // Requisição cancelada/substituída não mexe no estado de carregamento da nova
        if (!signal.aborted) {
          setLoading(false);
          setFetching(false);
        }
      }
    },
    [groupClubIds, oppPlayers]
  );

  useEffect(() => {
    fetchStats(matchCount);
    return () => abortRef.current?.abort();
  }, [fetchStats, matchCount, refreshKey]);

  return (
    <PageShell size="full">
      <PageHeader
        eyebrow="Clube"
        title="Estatísticas"
        subtitle={
          groupClubIds.length > 1 ? (
            <>
              Agrupando clubes: <span className="font-semibold">{groupClubIds.map((id) => selectedClubs.find((c) => c.clubId === id)?.clubName || id).join(", ")}</span>
            </>
          ) : (
            <>
              Clube atual: <span className="font-semibold">{club?.clubName || (groupClubIds[0] ?? "-")}</span>
            </>
          )
        }
        actions={
          fetching ? (
            <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-accent/10 text-accent border border-accent/30" role="status">
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" /> Atualizando…
            </span>
          ) : undefined
        }
      />

      {/* Filtros */}
      <Card className="mb-4 p-3 sm:p-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-[9rem_minmax(0,1fr)_11rem_9rem]">
          <Field
            label="Últimas partidas"
            htmlFor="matchCount"
            error={!countOk ? "Informe um número a partir de 1." : undefined}
          >
            <input
              id="matchCount"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value={countText}
              aria-invalid={!countOk}
              onChange={(e) => setCountText(e.target.value.replace(/[^\d]/g, ""))}
              onBlur={() => {
                if (!countOk) setCountText(String(matchCount));
              }}
              className={FIELD_CLASS}
            />
          </Field>

          <Field label="Buscar jogador" htmlFor="search" className="col-span-2 sm:col-span-1">
            <input
              id="search"
              type="search"
              placeholder="Nome do jogador"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={FIELD_CLASS}
            />
          </Field>

          {/* Filtro por jogadores do adversário */}
          <Field label="Jogadores do adversário" htmlFor="oppPlayers">
            <select
              id="oppPlayers"
              className={FIELD_CLASS}
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
          </Field>

          <Field label="Itens por página" htmlFor="pageSize">
            <select
              id="pageSize"
              className={FIELD_CLASS}
              value={pageSize}
              onChange={(e) => setPageSize(Math.max(5, Number(e.target.value) || 20))}
            >
              {[10, 20, 30, 50, 100].map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </Card>

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
    </PageShell>
  );
}
