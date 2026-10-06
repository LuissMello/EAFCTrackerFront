// src/pages/PlayerStatisticsByDatePage.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api, { isCanceled } from "../services/api.ts";
import { API_ENDPOINTS } from "../config/urls.ts";
import { useRefresh } from "../hooks/useRefresh.tsx";
import { fmtBRFromISO } from "../utils/date.ts";
import { PlayerStatsTable } from "../components/PlayerStatsTable.tsx";
import type { PlayerStats } from "../types/stats";
import { ChevronDown, Trophy, TrendingDown } from "lucide-react";
import { Tooltip } from "../components/Tooltip.tsx";
import { RatingPill, PageHeader, PageShell } from "../components/ui.tsx";
import { toNum } from "../utils/number.ts";
import { buildDateColorMap, NEUTRAL_DATE_COLOR } from "../utils/dateColors.ts";
import { getPassPct, getTacklePct, getMatchesPlayed, getSuccessfulTackles } from "../utils/playerDto.ts";
import { DateBadge } from "../components/DateBadge.tsx";
import { DateRangeBar } from "../components/DateRangeBar.tsx";
import { useUrlDateRange } from "../hooks/useUrlDateRange.ts";
import { useArchetypeFilter } from "../hooks/useArchetypeFilter.ts";
import { ArchetypeFilterNote } from "../components/archetypes/ArchetypeFilterSelect.tsx";
import { PositionArchetypeFilter } from "../components/archetypes/PositionArchetypeFilter.tsx";
import { archetypeOptionsForItems, archetypeOptionsOf, filterByPositionArchetype, matchesPositionArchetype, positionArchetypeLabel } from "../utils/archetypeFilters.ts";
import type { FullMatchStatisticsByDayDto, DayBlock } from "../types/statsByDate.ts";

/** Barra horizontal V/E/D para resumos */
function RecordBar({ wins, draws, losses }: { wins: number; draws: number; losses: number }) {
    const total = Math.max(wins + draws + losses, 1);
    return (
        <div>
            <div className="flex h-3 rounded overflow-hidden gap-px">
                {wins > 0 && <div className="bg-positive" style={{ width: `${(wins / total) * 100}%` }} />}
                {draws > 0 && <div className="bg-warning" style={{ width: `${(draws / total) * 100}%` }} />}
                {losses > 0 && <div className="bg-negative" style={{ width: `${(losses / total) * 100}%` }} />}
            </div>
            <div className="flex justify-between text-[11px] mt-0.5 font-medium">
                <span className="text-positive">{wins}V</span>
                <span className="text-warning">{draws}E</span>
                <span className="text-negative">{losses}D</span>
            </div>
        </div>
    );
}

/** Mini-barra proporcional para rankings */
function MiniBar({ value, max }: { value: number; max: number }) {
    const w = max > 0 ? Math.max(4, (value / max) * 100) : 4;
    return <div className="h-1.5 rounded bg-accent mt-1" style={{ width: `${w}%` }} />;
}

const Info: React.FC<{ title: string }> = ({ title }) => (
    <Tooltip content={title}>
        <span
            className="ml-1 inline-flex items-center justify-center w-4 h-4 text-xs rounded-full border border-border-strong text-fg-muted select-none cursor-help"
            aria-label={title}
        >
            i
        </span>
    </Tooltip>
);

export default function PlayerStatisticsByDatePage() {
    const { refreshKey } = useRefresh();
    const [searchParams] = useSearchParams();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [days, setDays] = useState<DayBlock[]>([]);
    const [groupSessions, setGroupSessions] = useState(true);
    // Acordeão por dia: só o primeiro (mais recente) começa aberto; as tabelas só são montadas quando abertas
    const [openDays, setOpenDays] = useState<Set<string>>(new Set());
    const toggleDay = (key: string) =>
        setOpenDays((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });

    // clubes selecionados (?clubIds=355651,352016,...)
    // Memoizado pela string dos IDs: outras mudanças na URL (ex.: dateFrom/dateTo) não refazem a busca
    const clubIdsKey = (() => {
        const raw = searchParams.get("clubIds");
        if (!raw) return "";
        return raw
            .split(",")
            .map((s) => parseInt(s.trim(), 10))
            .filter((n) => !Number.isNaN(n))
            .join(",");
    })();
    const clubIds = useMemo(() => (clubIdsKey ? clubIdsKey.split(",").map(Number) : []), [clubIdsKey]);

    // Período na URL (?dateFrom=&dateTo=) — padrão: últimos 30 dias, terminando hoje
    const [{ from: dateFrom, to: dateTo }, setRange] = useUrlDateRange();

    // ===== Fetch =====
    useEffect(() => {
        const controller = new AbortController();
        const { signal } = controller;

        async function fetchData() {
            setLoading(true);
            setError(null);
            try {
                if (!clubIds.length) {
                    setDays([]);
                    return;
                }

                const params: Record<string, string> = {
                    clubIds: clubIds.join(","),
                    start: dateFrom,
                    end: dateTo,
                    sessions: String(groupSessions && clubIds.length === 1),
                };

                const { data } = await api.get<FullMatchStatisticsByDayDto[]>(
                    API_ENDPOINTS.MATCHES_STATS_BY_DATE,
                    { params, signal }
                );
                if (signal.aborted) return;

                const blocks: DayBlock[] = (Array.isArray(data) ? data : [])
                    .map((row) => {
                        const ov = row?.statistics?.overall ?? {};
                        const clubsArr = Array.isArray(row?.statistics?.clubs)
                            ? row.statistics!.clubs!
                            : [];

                        const gf = clubsArr.reduce(
                            (acc, c: any) => acc + toNum(c?.goalsFor ?? c?.GoalsFor),
                            0
                        );
                        const ga = clubsArr.reduce(
                            (acc, c: any) => acc + toNum(c?.goalsAgainst ?? c?.GoalsAgainst),
                            0
                        );

                        return {
                            date: String(row.date),
                            matchesCount: toNum(ov.totalMatches),
                            wins: toNum(ov.totalWins),
                            draws: toNum(ov.totalDraws),
                            losses: toNum(ov.totalLosses),
                            goalsFor: gf,
                            goalsAgainst: ga,
                            players: Array.isArray(row?.statistics?.players)
                                ? (row.statistics!.players as PlayerStats[])
                                : [],
                        };
                    })
                    .sort((a, b) => b.date.localeCompare(a.date));

                setDays(blocks);
            } catch (e: any) {
                if (signal.aborted || isCanceled(e)) return;
                setError(e?.message ?? "Falha ao carregar dados");
            } finally {
                if (!signal.aborted) setLoading(false);
            }
        }

        fetchData();
        return () => controller.abort();
    }, [dateFrom, dateTo, clubIds, groupSessions, refreshKey]);

    // ===== Filtro Posição + Arquétipo (?pos=&arq=) =====
    // Cada jogador de cada dia traz a posição e o arquétipo principal DAQUELE dia/noite; o filtro mantém só os jogadores
    // que batem nos dois (melhor/pior dia por jogador passam a considerar só esses dias).
    // Os números do clube (jogos, V/E/D, gols) não mudam.
    const [archFilter, setArchFilter] = useArchetypeFilter();
    const allDayPlayers = useMemo(() => days.flatMap((d) => d.players), [days]);
    const archetypeOptions = useMemo(
        () => archetypeOptionsForItems(allDayPlayers, archFilter.positionGroup),
        [allDayPlayers, archFilter.positionGroup]
    );
    const filterActive = archFilter.positionGroup !== null || archFilter.archetypeId !== null;
    const viewDays = useMemo(
        () => (filterActive ? days.map((d) => ({ ...d, players: filterByPositionArchetype(d.players, archFilter) })) : days),
        [days, archFilter, filterActive]
    );
    const showArchetypeFilter = filterActive || archetypeOptionsOf(allDayPlayers).length > 0;

    // ===== Mapa de cores por data =====
    const dateColorMap = useMemo(() => {
        const datesDesc = days.map(d => d.date);
        return buildDateColorMap(datesDesc);
    }, [days]);

    // ===== Agregações para os quadros =====
    type RankedDay = DayBlock & {
        winPct: number;
        saldo: number;
        gfPerMatch: number;
        gaPerMatch: number;
    };
    const rankedDays: RankedDay[] = useMemo(() => {
        return days.map((d) => {
            const winPct = d.matchesCount > 0 ? (d.wins * 100) / d.matchesCount : 0;
            const saldo = d.goalsFor - d.goalsAgainst;
            const gfPerMatch = d.matchesCount > 0 ? d.goalsFor / d.matchesCount : 0;
            const gaPerMatch = d.matchesCount > 0 ? d.goalsAgainst / d.matchesCount : 0;
            return { ...d, winPct, saldo, gfPerMatch, gaPerMatch };
        });
    }, [days]);

    const bestOverallDay = useMemo(() => {
        if (rankedDays.length === 0) return null;
        const cp = [...rankedDays];
        cp.sort((a, b) => {
            if (b.winPct !== a.winPct) return b.winPct - a.winPct;
            if (b.saldo !== a.saldo) return b.saldo - a.saldo;
            if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
            if (a.goalsAgainst !== b.goalsAgainst) return a.goalsAgainst - b.goalsAgainst;
            return b.date.localeCompare(a.date);
        });
        return cp[0];
    }, [rankedDays]);

    const topByWinPct = useMemo(() => {
        return [...rankedDays]
            .filter((d) => d.matchesCount > 0)
            .sort((a, b) => b.winPct - a.winPct || b.saldo - a.saldo || b.goalsFor - a.goalsFor || b.date.localeCompare(a.date))
            .slice(0, 5);
    }, [rankedDays]);

    const topBySaldo = useMemo(() => {
        return [...rankedDays]
            .sort(
                (a, b) =>
                    b.saldo - a.saldo ||
                    b.goalsFor - a.goalsFor ||
                    a.goalsAgainst - b.goalsAgainst ||
                    b.date.localeCompare(a.date)
            )
            .slice(0, 5);
    }, [rankedDays]);

    const topByGFPerGame = useMemo(() => {
        return [...rankedDays]
            .filter((d) => d.matchesCount > 0)
            .sort((a, b) =>
                b.gfPerMatch - a.gfPerMatch ||
                b.goalsFor - a.goalsFor ||
                a.goalsAgainst - b.goalsAgainst ||
                b.date.localeCompare(a.date)
            )
            .slice(0, 5);
    }, [rankedDays]);

    const topByLowGAPerGame = useMemo(() => {
        return [...rankedDays]
            .filter((d) => d.matchesCount > 0)
            .sort((a, b) =>
                a.gaPerMatch - b.gaPerMatch ||
                a.goalsAgainst - b.goalsAgainst ||
                b.goalsFor - a.goalsFor ||
                b.date.localeCompare(a.date)
            )
            .slice(0, 5);
    }, [rankedDays]);

    const period = useMemo(() => {
        const totalDaysWithMatches = days.filter((d) => d.matchesCount > 0).length;
        const matches = days.reduce((a, d) => a + d.matchesCount, 0);
        const wins = days.reduce((a, d) => a + d.wins, 0);
        const draws = days.reduce((a, d) => a + d.draws, 0);
        const losses = days.reduce((a, d) => a + d.losses, 0);
        const gf = days.reduce((a, d) => a + d.goalsFor, 0);
        const ga = days.reduce((a, d) => a + d.goalsAgainst, 0);
        const saldo = gf - ga;
        const winPct = matches > 0 ? (wins * 100) / matches : 0;
        const gfPerMatch = matches > 0 ? gf / matches : 0;
        const gaPerMatch = matches > 0 ? ga / matches : 0;
        const matchesPerDay = totalDaysWithMatches > 0 ? matches / totalDaysWithMatches : 0;
        return {
            matches,
            wins,
            draws,
            losses,
            gf,
            ga,
            saldo,
            winPct,
            gfPerMatch,
            gaPerMatch,
            totalDaysWithMatches,
            matchesPerDay,
        };
    }, [days]);

    // ===== Melhor/Pior dia de cada jogador por métrica (com Participações e Tackles certos) =====
    type BestPerMetric = { date: string; value: number };
    type PlayerBestDays = {
        playerId: number;
        playerName: string;
        goals: BestPerMetric;
        assists: BestPerMetric;
        preAssists: BestPerMetric;     // pré-assistências
        passPct: BestPerMetric;
        tacklePct: BestPerMetric;
        tackles: BestPerMetric;        // número de tackles certos
        participations: BestPerMetric; // (gols + assistências + pré-assistências) / jogos
        saves: BestPerMetric;
        rating: BestPerMetric;
    };
    type PlayerWorstDays = PlayerBestDays;

    const { bestDayPerPlayer, worstDayPerPlayer } = useMemo(() => {
        const bestMap = new Map<number, PlayerBestDays>();
        const worstMap = new Map<number, PlayerWorstDays>();

        for (const d of viewDays) {
            for (const p of d.players) {
                const pid = toNum((p as any).playerId ?? (p as any).PlayerId);
                if (!pid) continue;

                const goals = toNum((p as any).totalGoals ?? (p as any).TotalGoals);
                const assists = toNum((p as any).totalAssists ?? (p as any).TotalAssists);
                const preAssists = toNum((p as any).totalPreAssists ?? (p as any).TotalPreAssists);
                const matches = Math.max(1, getMatchesPlayed(p));
                const participationsVal = (goals + assists + preAssists) / matches;
                const passPct = getPassPct(p as any);
                const tacklePct = getTacklePct(p as any);
                const tacklesCount = getSuccessfulTackles(p as any); // tackles certos
                const saves = toNum((p as any).totalSaves ?? (p as any).TotalSaves);
                const rating = toNum((p as any).avgRating ?? (p as any).AvgRating);
                const name = (p as any).playerName ?? (p as any).PlayerName ?? `Player ${pid}`;

                const base: PlayerBestDays = {
                    playerId: pid,
                    playerName: name,
                    goals: { date: d.date, value: goals },
                    assists: { date: d.date, value: assists },
                    preAssists: { date: d.date, value: preAssists },
                    passPct: { date: d.date, value: passPct },
                    tacklePct: { date: d.date, value: tacklePct },
                    tackles: { date: d.date, value: tacklesCount },
                    participations: { date: d.date, value: participationsVal },
                    saves: { date: d.date, value: saves },
                    rating: { date: d.date, value: rating },
                };

                const pickBest = (best: BestPerMetric, v: number): BestPerMetric => {
                    if (v > best.value) return { date: d.date, value: v };
                    if (v === best.value && d.date > best.date) return { date: d.date, value: v };
                    return best;
                };
                const pickWorst = (worst: BestPerMetric, v: number): BestPerMetric => {
                    if (v < worst.value) return { date: d.date, value: v };
                    if (v === worst.value && d.date > worst.date) return { date: d.date, value: v };
                    return worst;
                };

                // BEST
                const curBest = bestMap.get(pid) ?? { ...base };
                curBest.playerName = name;
                curBest.goals = pickBest(curBest.goals, goals);
                curBest.assists = pickBest(curBest.assists, assists);
                curBest.preAssists = pickBest(curBest.preAssists, preAssists);
                curBest.passPct = pickBest(curBest.passPct, passPct);
                curBest.tacklePct = pickBest(curBest.tacklePct, tacklePct);
                curBest.tackles = pickBest(curBest.tackles, tacklesCount);
                curBest.participations = pickBest(curBest.participations, participationsVal);
                curBest.saves = pickBest(curBest.saves, saves);
                curBest.rating = pickBest(curBest.rating, rating);
                bestMap.set(pid, curBest);

                // WORST
                const curWorst = worstMap.get(pid) ?? { ...base };
                curWorst.playerName = name;
                curWorst.goals = pickWorst(curWorst.goals, goals);
                curWorst.assists = pickWorst(curWorst.assists, assists);
                curWorst.preAssists = pickWorst(curWorst.preAssists, preAssists);
                curWorst.passPct = pickWorst(curWorst.passPct, passPct);
                curWorst.tacklePct = pickWorst(curWorst.tacklePct, tacklePct);
                curWorst.tackles = pickWorst(curWorst.tackles, tacklesCount);
                curWorst.participations = pickWorst(curWorst.participations, participationsVal);
                curWorst.saves = pickWorst(curWorst.saves, saves);
                curWorst.rating = pickWorst(curWorst.rating, rating);
                worstMap.set(pid, curWorst);
            }
        }

        return {
            bestDayPerPlayer: Array.from(bestMap.values()).sort((a, b) => a.playerName.localeCompare(b.playerName)),
            worstDayPerPlayer: Array.from(worstMap.values()).sort((a, b) => a.playerName.localeCompare(b.playerName)),
        };
    }, [viewDays]);

    // Ao carregar um novo conjunto de dias, abre só o primeiro
    const firstDayKey = days[0]?.date.slice(0, 10) ?? "";
    useEffect(() => {
        setOpenDays(firstDayKey ? new Set([firstDayKey]) : new Set());
    }, [firstDayKey, dateFrom, dateTo, groupSessions]);

    // ===== Render =====
    return (
        <PageShell className="flex flex-col gap-6">
            <PageHeader
                eyebrow="Período"
                title="Estatísticas por período"
                subtitle="Resumo do clube e dos jogadores, dia a dia"
                className="-mb-2"
            />
            <DateRangeBar from={dateFrom} to={dateTo} onChange={setRange} idPrefix="psbd" />

            <div className="flex items-center gap-2 text-sm">
                <span className="text-fg-muted">Agrupar por:</span>
                <button type="button" disabled={clubIds.length !== 1} aria-pressed={groupSessions && clubIds.length === 1}
                    onClick={() => setGroupSessions(true)} className={`px-3 py-1.5 rounded-lg border ${groupSessions && clubIds.length === 1 ? "bg-accent text-accent-fg" : "bg-surface"} disabled:opacity-50`}>Dia de jogo</button>
                <button type="button" aria-pressed={!groupSessions || clubIds.length !== 1}
                    onClick={() => setGroupSessions(false)} className={`px-3 py-1.5 rounded-lg border ${!groupSessions || clubIds.length !== 1 ? "bg-accent text-accent-fg" : "bg-surface"}`}>Dias do calendário</button>
            </div>

            {showArchetypeFilter && (
                <div className="-mt-2 flex flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                        <PositionArchetypeFilter
                            value={archFilter}
                            onChange={setArchFilter}
                            archetypeOptions={archetypeOptions}
                        />
                    </div>
                    {filterActive && !loading && (
                        <ArchetypeFilterNote
                            label={positionArchetypeLabel(archFilter, archetypeOptions) ?? ""}
                            shown={viewDays.reduce((a, d) => a + d.players.length, 0)}
                            total={days.reduce((a, d) => a + d.players.length, 0)}
                        />
                    )}
                </div>
            )}

            {loading && <div>Carregando…</div>}
            {error && <div className="text-negative">{error}</div>}
            {!loading && !error && !clubIds.length && (
                <div className="text-fg-muted">Nenhum clube selecionado.</div>
            )}

            {/* Resumo do período */}
            {!loading && !error && days.length > 0 && (
                <section className="rounded-xl border p-4 shadow-sm">
                    <h2 className="text-lg font-semibold mb-3">Resumo do período</h2>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                        <div className="rounded-lg border p-3">
                            <div className="text-sm text-fg-muted">Jogos</div>
                            <div className="font-semibold text-lg">
                                {days.reduce((a, d) => a + d.matchesCount, 0)}
                            </div>
                            <div className="text-xs text-fg-muted">
                                {
                                    (() => {
                                        const totalDaysWithMatches = days.filter((d) => d.matchesCount > 0).length;
                                        const matches = days.reduce((a, d) => a + d.matchesCount, 0);
                                        const perDay = totalDaysWithMatches > 0 ? matches / totalDaysWithMatches : 0;
                                        return `${totalDaysWithMatches} dias • ${perDay.toFixed(2)} jogos/dia`;
                                    })()
                                }
                            </div>
                        </div>
                        <div className="rounded-lg border p-3">
                            <div className="text-sm text-fg-muted mb-1">Resultados</div>
                            <RecordBar wins={period.wins} draws={period.draws} losses={period.losses} />
                            <div className="text-xs text-fg-muted mt-1">Win% {period.winPct.toFixed(1)}%</div>
                        </div>
                        <div className="rounded-lg border p-3">
                            <div className="text-sm text-fg-muted">Gols</div>
                            <div className="font-semibold">
                                {days.reduce((a, d) => a + d.goalsFor, 0)}-
                                {days.reduce((a, d) => a + d.goalsAgainst, 0)}
                            </div>
                            <div className="text-xs text-fg-muted">
                                {(() => {
                                    const gf = days.reduce((a, d) => a + d.goalsFor, 0);
                                    const ga = days.reduce((a, d) => a + d.goalsAgainst, 0);
                                    const saldo = gf - ga;
                                    return `Saldo ${saldo >= 0 ? "+" : ""}${saldo}`;
                                })()}
                            </div>
                        </div>
                        <div className="rounded-lg border p-3">
                            <div className="text-sm text-fg-muted">GF por jogo</div>
                            <div className="font-semibold">
                                {period.gfPerMatch.toFixed(2)}
                            </div>
                        </div>
                        <div className="rounded-lg border p-3">
                            <div className="text-sm text-fg-muted">GA por jogo</div>
                            <div className="font-semibold">
                                {period.gaPerMatch.toFixed(2)}
                            </div>
                        </div>
                        <div className="rounded-lg border p-3">
                            <div className="text-sm text-fg-muted">Intervalo</div>
                            <div className="font-semibold">
                                {fmtBRFromISO(dateFrom)} → {fmtBRFromISO(dateTo)}
                            </div>
                        </div>
                    </div>
                </section>
            )}

            {/* Melhor dia (geral) */}
            {!loading && !error && bestOverallDay && (
                <section className="rounded-xl border-2 border-gold/50 bg-gold-soft/30 p-4 shadow-sm">
                    <h2 className="text-lg font-semibold mb-2 flex items-center gap-2">
                        <Trophy size={18} className="text-gold" />
                        Melhor dia (geral)
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        <div className="rounded-lg border p-3">
                            <div className="text-sm text-fg-muted">Data</div>
                            <div className="font-medium">
                                <DateBadge dateISO={bestOverallDay.date} colorMap={dateColorMap} />
                            </div>
                        </div>
                        <div className="rounded-lg border p-3">
                            <div className="text-sm text-fg-muted">Resultados</div>
                            <div className="font-medium">
                                {bestOverallDay.wins}V {bestOverallDay.draws}E {bestOverallDay.losses}D
                            </div>
                            <div className="text-sm text-fg-muted">
                                Jogos: {bestOverallDay.matchesCount} • Win%: {bestOverallDay.winPct.toFixed(1)}%
                            </div>
                        </div>
                        <div className="rounded-lg border p-3">
                            <div className="text-sm text-fg-muted">Gols</div>
                            <div className="font-medium">
                                {bestOverallDay.goalsFor}-{bestOverallDay.goalsAgainst} (Saldo{" "}
                                {bestOverallDay.saldo >= 0 ? "+" : ""}
                                {bestOverallDay.saldo})
                            </div>
                        </div>
                        <div className="rounded-lg border p-3">
                            <div className="text-sm text-fg-muted">Médias do dia</div>
                            <div className="font-medium">
                                GF/jg {bestOverallDay.gfPerMatch.toFixed(2)} • GA/jg {bestOverallDay.gaPerMatch.toFixed(2)}
                            </div>
                        </div>
                    </div>
                </section>
            )}

            {/* Top 5 dias por critérios */}
            {!loading && !error && rankedDays.length > 0 && (
                <section className="rounded-xl border p-4 shadow-sm">
                    <h2 className="text-lg font-semibold mb-3">Top 5 dias por critério</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                        {/* Win% */}
                        <div className="rounded-lg border">
                            <div className="px-3 py-2 border-b font-medium">Maior Win%</div>
                            <ul className="text-sm divide-y">
                                {topByWinPct.map((d, i) => (
                                    <li key={`wp-${d.date}`} className="px-3 py-2">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-fg-subtle w-5 shrink-0">#{i + 1}</span>
                                            <DateBadge dateISO={d.date} colorMap={dateColorMap} />
                                            <span className="ml-auto text-xs whitespace-nowrap">{d.winPct.toFixed(1)}% · {d.wins}V/{d.matchesCount}</span>
                                        </div>
                                        <MiniBar value={d.winPct} max={topByWinPct[0]?.winPct || 1} />
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Saldo */}
                        <div className="rounded-lg border">
                            <div className="px-3 py-2 border-b font-medium">Maior saldo</div>
                            <ul className="text-sm divide-y">
                                {topBySaldo.map((d, i) => (
                                    <li key={`sd-${d.date}`} className="px-3 py-2">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-fg-subtle w-5 shrink-0">#{i + 1}</span>
                                            <DateBadge dateISO={d.date} colorMap={dateColorMap} />
                                            <span className="ml-auto text-xs whitespace-nowrap">
                                                {d.saldo >= 0 ? "+" : ""}{d.saldo} ({d.goalsFor}–{d.goalsAgainst})
                                            </span>
                                        </div>
                                        <MiniBar value={Math.max(0, d.saldo)} max={Math.max(1, topBySaldo[0]?.saldo || 1)} />
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Mais gols marcados (por jogo) */}
                        <div className="rounded-lg border">
                            <div className="px-3 py-2 border-b font-medium">Mais gols marcados (por jogo)</div>
                            <ul className="text-sm divide-y">
                                {topByGFPerGame.map((d, i) => (
                                    <li key={`gfpg-${d.date}`} className="px-3 py-2">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-fg-subtle w-5 shrink-0">#{i + 1}</span>
                                            <DateBadge dateISO={d.date} colorMap={dateColorMap} />
                                            <span className="ml-auto text-xs whitespace-nowrap">{d.gfPerMatch.toFixed(2)} gol/jogo</span>
                                        </div>
                                        <MiniBar value={d.gfPerMatch} max={topByGFPerGame[0]?.gfPerMatch || 1} />
                                        <div className="text-fg-muted text-xs mt-0.5">
                                            Total: {d.goalsFor} em {d.matchesCount} jogos
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Menos gols sofridos (por jogo) */}
                        <div className="rounded-lg border">
                            <div className="px-3 py-2 border-b font-medium">Menos gols sofridos (por jogo)</div>
                            <ul className="text-sm divide-y">
                                {topByLowGAPerGame.map((d, i) => {
                                    const worstGA = topByLowGAPerGame.at(-1)?.gaPerMatch ?? 1;
                                    const bestGA = topByLowGAPerGame[0]?.gaPerMatch ?? 0;
                                    const barMax = Math.max(0.01, worstGA - bestGA);
                                    return (
                                        <li key={`gapg-${d.date}`} className="px-3 py-2">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-fg-subtle w-5 shrink-0">#{i + 1}</span>
                                                <DateBadge dateISO={d.date} colorMap={dateColorMap} />
                                                <span className="ml-auto text-xs whitespace-nowrap">{d.gaPerMatch.toFixed(2)} gol/jogo</span>
                                            </div>
                                            <MiniBar value={Math.max(0, worstGA - d.gaPerMatch)} max={barMax} />
                                            <div className="text-fg-muted text-xs mt-0.5">
                                                Total: {d.goalsAgainst} em {d.matchesCount} jogos
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    </div>
                </section>
            )}

            {/* Melhor dia por jogador — com Participações e Tackles certos */}
            {!loading && !error && days.length > 0 && (
                <section className="rounded-xl border p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                        <h2 className="text-lg font-semibold flex items-center gap-2">
                            <Trophy size={18} className="text-gold" />
                            Melhor dia de cada jogador por métrica
                        </h2>
                    </div>
                    <div className="overflow-x-auto rounded-lg border border-l-4 border-l-positive bg-surface">
                        <table className="table-fixed w-full min-w-[640px] text-xs xl:text-sm">
                            <colgroup>
                                <col style={{ width: "14%" }} />
                                {Array.from({ length: 9 }).map((_, i) => (
                                    <col key={i} style={{ width: "9.55%" }} />
                                ))}
                            </colgroup>
                            <thead className="bg-positive-soft text-positive-fg">
                                <tr>
                                    <th className="px-1.5 py-2 xl:px-2 text-left">Jogador</th>
                                    <th className="px-1 py-2 xl:px-2 text-center leading-tight align-bottom">Gols</th>
                                    <th className="px-1 py-2 xl:px-2 text-center leading-tight align-bottom"><span title="Assistências">Assist.</span></th>
                                    <th className="px-1 py-2 xl:px-2 text-center leading-tight align-bottom"><span title="Pré-assistências">Pré</span></th>
                                    <th className="px-1 py-2 xl:px-2 text-center leading-tight align-bottom">Passe (%)</th>
                                    <th className="px-1 py-2 xl:px-2 text-center leading-tight align-bottom">Desarme (%)</th>
                                    <th className="px-1 py-2 xl:px-2 text-center leading-tight align-bottom">
                                        Tackles certos
                                        <Info title="Número de desarmes/tackles bem sucedidos no dia" />
                                    </th>
                                    <th className="px-1 py-2 xl:px-2 text-center leading-tight align-bottom">
                                        Participações
                                        <Info title="(Gols + Assistências + Pré-Assist.) / Jogos do dia" />
                                    </th>
                                    <th className="px-1 py-2 xl:px-2 text-center leading-tight align-bottom">Defesas</th>
                                    <th className="px-1 py-2 xl:px-2 text-center leading-tight align-bottom">Nota</th>
                                </tr>
                            </thead>
                            <tbody>
                                {bestDayPerPlayer.length === 0 && (
                                    <tr>
                                        <td colSpan={10} className="px-3 py-3 text-center text-fg-muted">
                                            Nenhum jogador no período.
                                        </td>
                                    </tr>
                                )}
                                {bestDayPerPlayer.map((r, i) => (
                                    <tr key={r.playerId} className={`hover:bg-surface-raised ${i % 2 === 1 ? "bg-surface-raised" : ""}`}>
                                        <td className="px-1.5 py-1.5 xl:px-2 text-left sticky left-0 bg-inherit border-r border-border [overflow-wrap:anywhere]">{r.playerName}</td>
                                        <td className="px-1 py-1.5 xl:px-2 text-center align-top">
                                            {r.goals.value}{" "}
                                            <DateBadge short className="!flex mx-auto mt-0.5 w-fit" dateISO={r.goals.date} colorMap={dateColorMap} />
                                        </td>
                                        <td className="px-1 py-1.5 xl:px-2 text-center align-top">
                                            {r.assists.value}{" "}
                                            <DateBadge short className="!flex mx-auto mt-0.5 w-fit" dateISO={r.assists.date} colorMap={dateColorMap} />
                                        </td>
                                        <td className="px-1 py-1.5 xl:px-2 text-center align-top">
                                            {r.preAssists.value}{" "}
                                            <DateBadge short className="!flex mx-auto mt-0.5 w-fit" dateISO={r.preAssists.date} colorMap={dateColorMap} />
                                        </td>
                                        <td className="px-1 py-1.5 xl:px-2 text-center align-top">
                                            {r.passPct.value.toFixed(1)}%{" "}
                                            <DateBadge short className="!flex mx-auto mt-0.5 w-fit" dateISO={r.passPct.date} colorMap={dateColorMap} />
                                        </td>
                                        <td className="px-1 py-1.5 xl:px-2 text-center align-top">
                                            {r.tacklePct.value.toFixed(1)}%{" "}
                                            <DateBadge short className="!flex mx-auto mt-0.5 w-fit" dateISO={r.tacklePct.date} colorMap={dateColorMap} />
                                        </td>
                                        <td className="px-1 py-1.5 xl:px-2 text-center align-top">
                                            {r.tackles.value}{" "}
                                            <DateBadge short className="!flex mx-auto mt-0.5 w-fit" dateISO={r.tackles.date} colorMap={dateColorMap} />
                                        </td>
                                        <td className="px-1 py-1.5 xl:px-2 text-center align-top">
                                            {r.participations.value.toFixed(2)}{" "}
                                            <DateBadge short className="!flex mx-auto mt-0.5 w-fit" dateISO={r.participations.date} colorMap={dateColorMap} />
                                        </td>
                                        <td className="px-1 py-1.5 xl:px-2 text-center align-top">
                                            {r.saves.value}{" "}
                                            <DateBadge short className="!flex mx-auto mt-0.5 w-fit" dateISO={r.saves.date} colorMap={dateColorMap} />
                                        </td>
                                        <td className="px-1 py-1.5 xl:px-2 text-center align-top">
                                            <RatingPill value={Number(r.rating.value)} />{" "}
                                            <DateBadge short className="!flex mx-auto mt-0.5 w-fit" dateISO={r.rating.date} colorMap={dateColorMap} />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            )}

            {/* Pior dia por jogador — espelhado */}
            {!loading && !error && days.length > 0 && (
                <section className="rounded-xl border p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                        <h2 className="text-lg font-semibold flex items-center gap-2">
                            <TrendingDown size={18} className="text-negative" />
                            Pior dia de cada jogador por métrica
                        </h2>
                    </div>
                    <div className="overflow-x-auto rounded-lg border border-l-4 border-l-negative bg-surface">
                        <table className="table-fixed w-full min-w-[640px] text-xs xl:text-sm">
                            <colgroup>
                                <col style={{ width: "14%" }} />
                                {Array.from({ length: 9 }).map((_, i) => (
                                    <col key={i} style={{ width: "9.55%" }} />
                                ))}
                            </colgroup>
                            <thead className="bg-negative-soft text-negative-fg">
                                <tr>
                                    <th className="px-1.5 py-2 xl:px-2 text-left">Jogador</th>
                                    <th className="px-1 py-2 xl:px-2 text-center leading-tight align-bottom">Gols</th>
                                    <th className="px-1 py-2 xl:px-2 text-center leading-tight align-bottom"><span title="Assistências">Assist.</span></th>
                                    <th className="px-1 py-2 xl:px-2 text-center leading-tight align-bottom"><span title="Pré-assistências">Pré</span></th>
                                    <th className="px-1 py-2 xl:px-2 text-center leading-tight align-bottom">Passe (%)</th>
                                    <th className="px-1 py-2 xl:px-2 text-center leading-tight align-bottom">Desarme (%)</th>
                                    <th className="px-1 py-2 xl:px-2 text-center leading-tight align-bottom">
                                        Tackles certos
                                        <Info title="Número de desarmes/tackles bem sucedidos no dia" />
                                    </th>
                                    <th className="px-1 py-2 xl:px-2 text-center leading-tight align-bottom">
                                        Participações
                                        <Info title="(Gols + Assistências + Pré-Assist.) / Jogos do dia" />
                                    </th>
                                    <th className="px-1 py-2 xl:px-2 text-center leading-tight align-bottom">Defesas</th>
                                    <th className="px-1 py-2 xl:px-2 text-center leading-tight align-bottom">Nota</th>
                                </tr>
                            </thead>
                            <tbody>
                                {worstDayPerPlayer.length === 0 && (
                                    <tr>
                                        <td colSpan={10} className="px-3 py-3 text-center text-fg-muted">
                                            Nenhum jogador no período.
                                        </td>
                                    </tr>
                                )}
                                {worstDayPerPlayer.map((r, i) => (
                                    <tr key={r.playerId} className={`hover:bg-surface-raised ${i % 2 === 1 ? "bg-surface-raised" : ""}`}>
                                        <td className="px-1.5 py-1.5 xl:px-2 text-left sticky left-0 bg-inherit border-r border-border [overflow-wrap:anywhere]">{r.playerName}</td>
                                        <td className="px-1 py-1.5 xl:px-2 text-center align-top">
                                            {r.goals.value}{" "}
                                            <DateBadge short className="!flex mx-auto mt-0.5 w-fit" dateISO={r.goals.date} colorMap={dateColorMap} />
                                        </td>
                                        <td className="px-1 py-1.5 xl:px-2 text-center align-top">
                                            {r.assists.value}{" "}
                                            <DateBadge short className="!flex mx-auto mt-0.5 w-fit" dateISO={r.assists.date} colorMap={dateColorMap} />
                                        </td>
                                        <td className="px-1 py-1.5 xl:px-2 text-center align-top">
                                            {r.preAssists.value}{" "}
                                            <DateBadge short className="!flex mx-auto mt-0.5 w-fit" dateISO={r.preAssists.date} colorMap={dateColorMap} />
                                        </td>
                                        <td className="px-1 py-1.5 xl:px-2 text-center align-top">
                                            {r.passPct.value.toFixed(1)}%{" "}
                                            <DateBadge short className="!flex mx-auto mt-0.5 w-fit" dateISO={r.passPct.date} colorMap={dateColorMap} />
                                        </td>
                                        <td className="px-1 py-1.5 xl:px-2 text-center align-top">
                                            {r.tacklePct.value.toFixed(1)}%{" "}
                                            <DateBadge short className="!flex mx-auto mt-0.5 w-fit" dateISO={r.tacklePct.date} colorMap={dateColorMap} />
                                        </td>
                                        <td className="px-1 py-1.5 xl:px-2 text-center align-top">
                                            {r.tackles.value}{" "}
                                            <DateBadge short className="!flex mx-auto mt-0.5 w-fit" dateISO={r.tackles.date} colorMap={dateColorMap} />
                                        </td>
                                        <td className="px-1 py-1.5 xl:px-2 text-center align-top">
                                            {r.participations.value.toFixed(2)}{" "}
                                            <DateBadge short className="!flex mx-auto mt-0.5 w-fit" dateISO={r.participations.date} colorMap={dateColorMap} />
                                        </td>
                                        <td className="px-1 py-1.5 xl:px-2 text-center align-top">
                                            {r.saves.value}{" "}
                                            <DateBadge short className="!flex mx-auto mt-0.5 w-fit" dateISO={r.saves.date} colorMap={dateColorMap} />
                                        </td>
                                        <td className="px-1 py-1.5 xl:px-2 text-center align-top">
                                            <RatingPill value={Number(r.rating.value)} />{" "}
                                            <DateBadge short className="!flex mx-auto mt-0.5 w-fit" dateISO={r.rating.date} colorMap={dateColorMap} />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            )}

            {/* Lista por dia + tabela compacta */}
            {!loading && !error && clubIds.length > 0 && (
                <div className="flex flex-col gap-6">
                    {days.length === 0 && (
                        <div className="text-fg-muted">Nenhum jogo no período selecionado.</div>
                    )}
                    {viewDays.map((d) => {
                        const key = d.date.slice(0, 10);
                        const dateColors = dateColorMap.get(key) ?? NEUTRAL_DATE_COLOR;
                        const isOpen = openDays.has(key);
                        const panelId = `day-panel-${key}`;
                        return (
                            <section
                                key={d.date}
                                className="rounded-xl border p-3 shadow-sm"
                                style={{ borderLeft: `8px solid ${dateColors.border}` }}
                            >
                                <button
                                    type="button"
                                    aria-expanded={isOpen}
                                    aria-controls={panelId}
                                    onClick={() => toggleDay(key)}
                                    className={`flex min-h-[44px] w-full flex-wrap items-center gap-2 rounded-lg px-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${isOpen ? "mb-2" : ""}`}
                                >
                                    <DateBadge dateISO={d.date} colorMap={dateColorMap} />
                                    {bestOverallDay?.date === d.date && (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gold-soft text-gold-fg border border-gold/40">
                                            <Trophy size={11} /> Melhor dia
                                        </span>
                                    )}
                                    <span className="px-2 py-0.5 rounded-full bg-surface border text-xs font-medium">
                                        {d.matchesCount} jogo{d.matchesCount !== 1 ? "s" : ""}
                                    </span>
                                    <span className="px-2 py-0.5 rounded-full bg-positive-soft text-positive-fg border border-positive/40 text-xs font-medium">{d.wins}V</span>
                                    <span className="px-2 py-0.5 rounded-full bg-warning-soft text-warning-fg border border-warning/40 text-xs font-medium">{d.draws}E</span>
                                    <span className="px-2 py-0.5 rounded-full bg-negative-soft text-negative-fg border border-negative/40 text-xs font-medium">{d.losses}D</span>
                                    <span className="px-2 py-0.5 rounded-full bg-surface border text-xs">
                                        Gols: <strong>{d.goalsFor}–{d.goalsAgainst}</strong>{" "}
                                        (Saldo {d.goalsFor - d.goalsAgainst >= 0 ? "+" : ""}{d.goalsFor - d.goalsAgainst})
                                    </span>
                                    <span className="px-2 py-0.5 rounded-full bg-surface border text-xs">
                                        GF/jg {d.matchesCount ? (d.goalsFor / d.matchesCount).toFixed(2) : "—"}
                                    </span>
                                    <span className="px-2 py-0.5 rounded-full bg-surface border text-xs">
                                        GA/jg {d.matchesCount ? (d.goalsAgainst / d.matchesCount).toFixed(2) : "—"}
                                    </span>
                                    <ChevronDown aria-hidden="true" className={`ml-auto h-5 w-5 flex-shrink-0 text-fg-muted transition-transform ${isOpen ? "rotate-180" : ""}`} />
                                </button>

                                {isOpen && (
                                    <div id={panelId}>
                                        <PlayerStatsTable
                                            segmentFilter={filterActive ? (sg) => matchesPositionArchetype(sg, archFilter) : undefined}
                                            players={d.players}
                                            loading={false}
                                            error={null}
                                            clubStats={null}
                                            compactMode
                                            hiddenColumns={["totalSecondsPlayed"]}
                                        />
                                    </div>
                                )}
                            </section>
                        );
                    })}
                </div>
            )}
        </PageShell>
    );
}
