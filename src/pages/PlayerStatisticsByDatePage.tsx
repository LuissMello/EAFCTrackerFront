// src/pages/PlayerStatisticsByDatePage.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../services/api.ts";
import { PlayerStatsTable } from "../components/PlayerStatsTable.tsx";
import type { PlayerStats } from "../types/stats";

// ===== Tipos vindos da API =====
type FullMatchStatisticsDto = {
    overall?: {
        totalMatches?: number;
        totalWins?: number;
        totalDraws?: number;
        totalLosses?: number;

        passAccuracyPercent?: number; PassAccuracyPercent?: number;
        tackleSuccessPercent?: number; TackleSuccessPercent?: number;
    };
    players?: PlayerStats[];
    clubs?: Array<{
        clubId?: number; ClubId?: number;
        goalsFor?: number; GoalsFor?: number;
        goalsAgainst?: number; GoalsAgainst?: number;
    }>;
};

type FullMatchStatisticsByDayDto = {
    date: string; // "YYYY-MM-DD"
    statistics: FullMatchStatisticsDto;
};

type DayBlock = {
    date: string;
    matchesCount: number;
    wins: number;
    draws: number;
    losses: number;
    goalsFor: number;
    goalsAgainst: number;
    players: PlayerStats[];
};

// ===== Utils =====
function fmtYYYYMMDD(d: Date) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const da = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${da}`;
}
const toNum = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : 0);

// Helpers para ler percentuais do DTO (camelCase / PascalCase)
function getPassPct(p: any): number {
    const v =
        p?.passAccuracyPercent ??
        p?.PassAccuracyPercent ??
        p?.passSuccessPct ??
        p?.PassSuccessPct ??
        0;
    return Number.isFinite(v) ? Number(v) : 0;
}
function getTacklePct(p: any): number {
    const v =
        p?.tackleSuccessPercent ??
        p?.TackleSuccessPercent ??
        0;
    return Number.isFinite(v) ? Number(v) : 0;
}
// Matches/jogos do jogador no dia (tolerante a nomes)
function getMatchesPlayed(p: any): number {
    return toNum(
        p?.matchesPlayed ??
        p?.MatchesPlayed ??
        p?.totalMatches ??
        p?.TotalMatches ??
        0
    );
}

// Pequeno componente de dica (tooltip nativo via title)
const Info: React.FC<{ title: string }> = ({ title }) => (
    <span
        className="ml-1 inline-flex items-center justify-center w-4 h-4 text-xs rounded-full border border-gray-300 text-gray-600 select-none"
        title={title}
        aria-label={title}
    >
        i
    </span>
);

export default function PlayerStatisticsByDatePage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [days, setDays] = useState<DayBlock[]>([]);

    // toggles de exibição
    const [showBestPerPlayer, setShowBestPerPlayer] = useState(true);
    const [showWorstPerPlayer, setShowWorstPerPlayer] = useState(true);

    // clubes selecionados (?clubIds=355651,352016,...)
    const clubIds = useMemo(() => {
        const raw = searchParams.get("clubIds");
        if (!raw) return [] as number[];
        return raw
            .split(",")
            .map((s) => parseInt(s.trim(), 10))
            .filter((n) => !Number.isNaN(n));
    }, [searchParams]);

    // range (URL ou mês atual)
    const [dateFrom, setDateFrom] = useState(() => {
        const fromUrl = searchParams.get("dateFrom");
        if (fromUrl) return fromUrl;
        const now = new Date();
        return fmtYYYYMMDD(new Date(now.getFullYear(), now.getMonth(), 1));
    });
    const [dateTo, setDateTo] = useState(() => {
        const toUrl = searchParams.get("dateTo");
        if (toUrl) return toUrl;
        const now = new Date();
        return fmtYYYYMMDD(new Date(now.getFullYear(), now.getMonth() + 1, 0));
    });

    const handleRangeChange = (start: string, end: string) => {
        setDateFrom(start);
        setDateTo(end);
        const sp = new URLSearchParams(searchParams);
        sp.set("dateFrom", start);
        sp.set("dateTo", end);
        setSearchParams(sp);
    };

    const setQuickRangeDays = (nDays: number) => {
        const end = new Date();
        const start = new Date();
        start.setDate(end.getDate() - (nDays - 1));
        handleRangeChange(fmtYYYYMMDD(start), fmtYYYYMMDD(end));
    };
    const setCurrentMonth = () => {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        handleRangeChange(fmtYYYYMMDD(start), fmtYYYYMMDD(end));
    };
    const setPreviousMonth = () => {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const end = new Date(now.getFullYear(), now.getMonth(), 0);
        handleRangeChange(fmtYYYYMMDD(start), fmtYYYYMMDD(end));
    };

    // ===== Fetch =====
    useEffect(() => {
        let disposed = false;

        async function fetchData() {
            setLoading(true);
            setError(null);
            try {
                if (!clubIds.length) {
                    if (!disposed) setDays([]);
                    return;
                }

                const params: Record<string, string> = {
                    clubIds: clubIds.join(","),
                    start: dateFrom,
                    end: dateTo,
                };

                const { data } = await api.get<FullMatchStatisticsByDayDto[]>(
                    "/api/Clubs/matches/statistics/by-date-range-grouped",
                    { params }
                );

                const blocks: DayBlock[] = (Array.isArray(data) ? data : [])
                    .map((row) => {
                        const ov = row?.statistics?.overall ?? {};
                        const clubsArr = Array.isArray(row?.statistics?.clubs)
                            ? row.statistics!.clubs!
                            : [];

                        // soma GF/GA de todos os clubes (visão geral como "um clube")
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
                    .sort((a, b) => a.date.localeCompare(b.date));

                if (!disposed) setDays(blocks);
            } catch (e: any) {
                if (!disposed) setError(e?.message ?? "Falha ao carregar dados");
            } finally {
                if (!disposed) setLoading(false);
            }
        }

        fetchData();
        return () => {
            disposed = true;
        };
    }, [dateFrom, dateTo, clubIds]);

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
            .sort((a, b) => b.winPct - a.winPct || b.saldo - a.saldo || b.goalsFor - a.goalsFor)
            .slice(0, 5);
    }, [rankedDays]);

    const topBySaldo = useMemo(() => {
        return [...rankedDays]
            .sort(
                (a, b) =>
                    b.saldo - a.saldo || b.goalsFor - a.goalsFor || a.goalsAgainst - b.goalsAgainst
            )
            .slice(0, 5);
    }, [rankedDays]);

    const topByGF = useMemo(() => {
        return [...rankedDays]
            .sort((a, b) => b.goalsFor - a.goalsFor || a.goalsAgainst - b.goalsAgainst)
            .slice(0, 5);
    }, [rankedDays]);

    const topByLowGA = useMemo(() => {
        return [...rankedDays]
            .sort((a, b) => a.goalsAgainst - b.goalsAgainst || b.goalsFor - a.goalsFor)
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

    // ===== Melhor/Pior dia de cada jogador por métrica (com Participações) =====
    type BestPerMetric = { date: string; value: number };
    type PlayerBestDays = {
        playerId: number;
        playerName: string;
        goals: BestPerMetric;
        assists: BestPerMetric;
        passPct: BestPerMetric;    // backend
        tacklePct: BestPerMetric;  // backend
        participations: BestPerMetric; // (gols + assistências) / jogos
        saves: BestPerMetric;
        rating: BestPerMetric;
    };
    type PlayerWorstDays = PlayerBestDays;

    const { bestDayPerPlayer, worstDayPerPlayer } = useMemo(() => {
        const bestMap = new Map<number, PlayerBestDays>();
        const worstMap = new Map<number, PlayerWorstDays>();

        for (const d of days) {
            for (const p of d.players) {
                const pid = toNum((p as any).playerId ?? (p as any).PlayerId);
                if (!pid) continue;

                const goals = toNum((p as any).totalGoals ?? (p as any).TotalGoals);
                const assists = toNum((p as any).totalAssists ?? (p as any).TotalAssists);
                const matches = Math.max(1, getMatchesPlayed(p)); // evita div/0
                const participationsVal = (goals + assists) / matches;
                const passPct = getPassPct(p as any);
                const tacklePct = getTacklePct(p as any);
                const saves = toNum((p as any).totalSaves ?? (p as any).TotalSaves);
                const rating = toNum((p as any).avgRating ?? (p as any).AvgRating);
                const name = (p as any).playerName ?? (p as any).PlayerName ?? `Player ${pid}`;

                const base: PlayerBestDays = {
                    playerId: pid,
                    playerName: name,
                    goals: { date: d.date, value: goals },
                    assists: { date: d.date, value: assists },
                    passPct: { date: d.date, value: passPct },
                    tacklePct: { date: d.date, value: tacklePct },
                    participations: { date: d.date, value: participationsVal },
                    saves: { date: d.date, value: saves },
                    rating: { date: d.date, value: rating },
                };

                // pickers
                const pickBest = (best: BestPerMetric, v: number): BestPerMetric => {
                    if (v > best.value) return { date: d.date, value: v };
                    if (v === best.value && d.date > best.date) return { date: d.date, value: v };
                    return best;
                };
                const pickWorst = (worst: BestPerMetric, v: number): BestPerMetric => {
                    if (v < worst.value) return { date: d.date, value: v };
                    if (v === worst.value && d.date > worst.date) return { date: d.date, value: v }; // empate -> mais recente
                    return worst;
                };

                // BEST
                const curBest = bestMap.get(pid) ?? { ...base };
                curBest.playerName = name;
                curBest.goals = pickBest(curBest.goals, goals);
                curBest.assists = pickBest(curBest.assists, assists);
                curBest.passPct = pickBest(curBest.passPct, passPct);
                curBest.tacklePct = pickBest(curBest.tacklePct, tacklePct);
                curBest.participations = pickBest(curBest.participations, participationsVal);
                curBest.saves = pickBest(curBest.saves, saves);
                curBest.rating = pickBest(curBest.rating, rating);
                bestMap.set(pid, curBest);

                // WORST
                const curWorst = worstMap.get(pid) ?? { ...base };
                curWorst.playerName = name;
                curWorst.goals = pickWorst(curWorst.goals, goals);
                curWorst.assists = pickWorst(curWorst.assists, assists);
                curWorst.passPct = pickWorst(curWorst.passPct, passPct);
                curWorst.tacklePct = pickWorst(curWorst.tacklePct, tacklePct);
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
    }, [days]);

    // ===== Render =====
    return (
        <div className="p-4 flex flex-col gap-6">
            <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <h1 className="text-xl font-semibold">Estatísticas por Data (Agrupadas)</h1>
                <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                    <div className="flex gap-2 items-center">
                        <label className="text-sm">
                            Início:
                            <input
                                type="date"
                                value={dateFrom}
                                onChange={(e) => handleRangeChange(e.target.value, dateTo)}
                                className="ml-1 border rounded px-2 py-1"
                            />
                        </label>
                        <label className="text-sm">
                            Fim:
                            <input
                                type="date"
                                value={dateTo}
                                onChange={(e) => handleRangeChange(dateFrom, e.target.value)}
                                className="ml-1 border rounded px-2 py-1"
                            />
                        </label>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <button onClick={() => setQuickRangeDays(7)} className="text-xs border rounded px-2 py-1 hover:bg-gray-50">7d</button>
                        <button onClick={() => setQuickRangeDays(14)} className="text-xs border rounded px-2 py-1 hover:bg-gray-50">14d</button>
                        <button onClick={() => setQuickRangeDays(30)} className="text-xs border rounded px-2 py-1 hover:bg-gray-50">30d</button>
                        <button onClick={setCurrentMonth} className="text-xs border rounded px-2 py-1 hover:bg-gray-50">Mês atual</button>
                        <button onClick={setPreviousMonth} className="text-xs border rounded px-2 py-1 hover:bg-gray-50">Mês anterior</button>
                    </div>
                </div>
            </header>

            {/* Controles de exibição */}
            <div className="flex flex-wrap gap-3">
                <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                    <input
                        type="checkbox"
                        className="accent-black"
                        checked={showBestPerPlayer}
                        onChange={(e) => setShowBestPerPlayer(e.target.checked)}
                    />
                    <span className="text-sm">Mostrar “Melhor dia por jogador”</span>
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                    <input
                        type="checkbox"
                        className="accent-black"
                        checked={showWorstPerPlayer}
                        onChange={(e) => setShowWorstPerPlayer(e.target.checked)}
                    />
                    <span className="text-sm">Mostrar “Pior dia por jogador”</span>
                </label>
            </div>

            {loading && <div>Carregando…</div>}
            {error && <div className="text-red-600">{error}</div>}
            {!loading && !error && !clubIds.length && (
                <div className="text-gray-600">Nenhum clube selecionado.</div>
            )}

            {/* Resumo do período */}
            {!loading && !error && days.length > 0 && (
                <section className="rounded-xl border p-4 shadow-sm">
                    <h2 className="text-lg font-semibold mb-3">Resumo do período</h2>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                        <div className="rounded-lg border p-3">
                            <div className="text-sm text-gray-600">Jogos</div>
                            <div className="font-semibold text-lg">
                                {days.reduce((a, d) => a + d.matchesCount, 0)}
                            </div>
                            <div className="text-xs text-gray-500">
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
                            <div className="text-sm text-gray-600">Resultados</div>
                            <div className="font-semibold">
                                {days.reduce((a, d) => a + d.wins, 0)}V{" "}
                                {days.reduce((a, d) => a + d.draws, 0)}E{" "}
                                {days.reduce((a, d) => a + d.losses, 0)}D
                            </div>
                            <div className="text-xs text-gray-500">
                                {(() => {
                                    const m = days.reduce((a, d) => a + d.matchesCount, 0);
                                    const w = days.reduce((a, d) => a + d.wins, 0);
                                    return `Win% ${m > 0 ? ((w * 100) / m).toFixed(1) : "0.0"}%`;
                                })()}
                            </div>
                        </div>
                        <div className="rounded-lg border p-3">
                            <div className="text-sm text-gray-600">Gols</div>
                            <div className="font-semibold">
                                {days.reduce((a, d) => a + d.goalsFor, 0)}-
                                {days.reduce((a, d) => a + d.goalsAgainst, 0)}
                            </div>
                            <div className="text-xs text-gray-500">
                                {(() => {
                                    const gf = days.reduce((a, d) => a + d.goalsFor, 0);
                                    const ga = days.reduce((a, d) => a + d.goalsAgainst, 0);
                                    const saldo = gf - ga;
                                    return `Saldo ${saldo >= 0 ? "+" : ""}${saldo}`;
                                })()}
                            </div>
                        </div>
                        <div className="rounded-lg border p-3">
                            <div className="text-sm text-gray-600">GF por jogo</div>
                            <div className="font-semibold">
                                {(() => {
                                    const m = days.reduce((a, d) => a + d.matchesCount, 0);
                                    const gf = days.reduce((a, d) => a + d.goalsFor, 0);
                                    return m > 0 ? (gf / m).toFixed(2) : "0.00";
                                })()}
                            </div>
                        </div>
                        <div className="rounded-lg border p-3">
                            <div className="text-sm text-gray-600">GA por jogo</div>
                            <div className="font-semibold">
                                {(() => {
                                    const m = days.reduce((a, d) => a + d.matchesCount, 0);
                                    const ga = days.reduce((a, d) => a + d.goalsAgainst, 0);
                                    return m > 0 ? (ga / m).toFixed(2) : "0.00";
                                })()}
                            </div>
                        </div>
                        <div className="rounded-lg border p-3">
                            <div className="text-sm text-gray-600">Intervalo</div>
                            <div className="font-semibold">{dateFrom} → {dateTo}</div>
                        </div>
                    </div>
                </section>
            )}

            {/* Melhor dia (geral) */}
            {!loading && !error && bestOverallDay && (
                <section className="rounded-xl border p-4 shadow-sm">
                    <h2 className="text-lg font-semibold mb-2">Melhor dia (geral)</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        <div className="rounded-lg border p-3">
                            <div className="text-sm text-gray-600">Data</div>
                            <div className="font-medium">{bestOverallDay.date}</div>
                        </div>
                        <div className="rounded-lg border p-3">
                            <div className="text-sm text-gray-600">Resultados</div>
                            <div className="font-medium">
                                {bestOverallDay.wins}V {bestOverallDay.draws}E {bestOverallDay.losses}D
                            </div>
                            <div className="text-sm text-gray-600">
                                Jogos: {bestOverallDay.matchesCount} • Win%: {bestOverallDay.winPct.toFixed(1)}%
                            </div>
                        </div>
                        <div className="rounded-lg border p-3">
                            <div className="text-sm text-gray-600">Gols</div>
                            <div className="font-medium">
                                {bestOverallDay.goalsFor}-{bestOverallDay.goalsAgainst} (Saldo{" "}
                                {bestOverallDay.saldo >= 0 ? "+" : ""}
                                {bestOverallDay.saldo})
                            </div>
                        </div>
                        <div className="rounded-lg border p-3">
                            <div className="text-sm text-gray-600">Médias do dia</div>
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
                        <div className="rounded-lg border">
                            <div className="px-3 py-2 border-b font-medium">Maior Win%</div>
                            <ul className="text-sm divide-y">
                                {topByWinPct.map((d) => (
                                    <li key={`wp-${d.date}`} className="px-3 py-2 flex justify-between">
                                        <span>{d.date}</span>
                                        <span>{d.winPct.toFixed(1)}% • {d.wins}V/{d.matchesCount}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div className="rounded-lg border">
                            <div className="px-3 py-2 border-b font-medium">Maior saldo</div>
                            <ul className="text-sm divide-y">
                                {topBySaldo.map((d) => (
                                    <li key={`sd-${d.date}`} className="px-3 py-2 flex justify-between">
                                        <span>{d.date}</span>
                                        <span>{d.saldo >= 0 ? "+" : ""}{d.saldo} ({d.goalsFor}-{d.goalsAgainst})</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div className="rounded-lg border">
                            <div className="px-3 py-2 border-b font-medium">Mais gols marcados</div>
                            <ul className="text-sm divide-y">
                                {topByGF.map((d) => (
                                    <li key={`gf-${d.date}`} className="px-3 py-2 flex justify-between">
                                        <span>{d.date}</span>
                                        <span>{d.goalsFor}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div className="rounded-lg border">
                            <div className="px-3 py-2 border-b font-medium">Menos gols sofridos</div>
                            <ul className="text-sm divide-y">
                                {topByLowGA.map((d) => (
                                    <li key={`ga-${d.date}`} className="px-3 py-2 flex justify-between">
                                        <span>{d.date}</span>
                                        <span>{d.goalsAgainst}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </section>
            )}

            {/* Melhor dia por jogador — com Participações */}
            {!loading && !error && days.length > 0 && showBestPerPlayer && (
                <section className="rounded-xl border p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                        <h2 className="text-lg font-semibold">Melhor dia de cada jogador por métrica</h2>
                    </div>
                    <div className="overflow-x-auto rounded-lg border bg-white">
                        <table className="table-auto w-full text-sm">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-3 py-2 text-left">Jogador</th>
                                    <th className="px-3 py-2">Gols</th>
                                    <th className="px-3 py-2">Assistências</th>
                                    <th className="px-3 py-2">Passe (%)</th>
                                    <th className="px-3 py-2">Desarme (%)</th>
                                    <th className="px-3 py-2">
                                        Participações
                                        <Info title="(Gols + Assistências) / Jogos do dia" />
                                    </th>
                                    <th className="px-3 py-2">Defesas</th>
                                    <th className="px-3 py-2">Nota</th>
                                </tr>
                            </thead>
                            <tbody>
                                {bestDayPerPlayer.length === 0 && (
                                    <tr>
                                        <td colSpan={8} className="px-3 py-3 text-center text-gray-600">
                                            Nenhum jogador no período.
                                        </td>
                                    </tr>
                                )}
                                {bestDayPerPlayer.map((r) => (
                                    <tr key={r.playerId} className="hover:bg-gray-50">
                                        <td className="px-3 py-2 text-left">{r.playerName}</td>
                                        <td className="px-3 py-2">
                                            {r.goals.value} <span className="text-gray-500">({r.goals.date})</span>
                                        </td>
                                        <td className="px-3 py-2">
                                            {r.assists.value} <span className="text-gray-500">({r.assists.date})</span>
                                        </td>
                                        <td className="px-3 py-2">
                                            {r.passPct.value.toFixed(1)}%{" "}
                                            <span className="text-gray-500">({r.passPct.date})</span>
                                        </td>
                                        <td className="px-3 py-2">
                                            {r.tacklePct.value.toFixed(1)}%{" "}
                                            <span className="text-gray-500">({r.tacklePct.date})</span>
                                        </td>
                                        <td className="px-3 py-2">
                                            {r.participations.value.toFixed(2)}{" "}
                                            <span className="text-gray-500">({r.participations.date})</span>
                                        </td>
                                        <td className="px-3 py-2">
                                            {r.saves.value} <span className="text-gray-500">({r.saves.date})</span>
                                        </td>
                                        <td className="px-3 py-2">
                                            {Number(r.rating.value).toFixed(2)}{" "}
                                            <span className="text-gray-500">({r.rating.date})</span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            )}

            {/* Pior dia por jogador — espelhado, escolhendo o MENOR valor */}
            {!loading && !error && days.length > 0 && showWorstPerPlayer && (
                <section className="rounded-xl border p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                        <h2 className="text-lg font-semibold">Pior dia de cada jogador por métrica</h2>
                    </div>
                    <div className="overflow-x-auto rounded-lg border bg-white">
                        <table className="table-auto w-full text-sm">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-3 py-2 text-left">Jogador</th>
                                    <th className="px-3 py-2">Gols</th>
                                    <th className="px-3 py-2">Assistências</th>
                                    <th className="px-3 py-2">Passe (%)</th>
                                    <th className="px-3 py-2">Desarme (%)</th>
                                    <th className="px-3 py-2">
                                        Participações
                                        <Info title="(Gols + Assistências) / Jogos do dia" />
                                    </th>
                                    <th className="px-3 py-2">Defesas</th>
                                    <th className="px-3 py-2">Nota</th>
                                </tr>
                            </thead>
                            <tbody>
                                {worstDayPerPlayer.length === 0 && (
                                    <tr>
                                        <td colSpan={8} className="px-3 py-3 text-center text-gray-600">
                                            Nenhum jogador no período.
                                        </td>
                                    </tr>
                                )}
                                {worstDayPerPlayer.map((r) => (
                                    <tr key={r.playerId} className="hover:bg-gray-50">
                                        <td className="px-3 py-2 text-left">{r.playerName}</td>
                                        <td className="px-3 py-2">
                                            {r.goals.value} <span className="text-gray-500">({r.goals.date})</span>
                                        </td>
                                        <td className="px-3 py-2">
                                            {r.assists.value} <span className="text-gray-500">({r.assists.date})</span>
                                        </td>
                                        <td className="px-3 py-2">
                                            {r.passPct.value.toFixed(1)}%{" "}
                                            <span className="text-gray-500">({r.passPct.date})</span>
                                        </td>
                                        <td className="px-3 py-2">
                                            {r.tacklePct.value.toFixed(1)}%{" "}
                                            <span className="text-gray-500">({r.tacklePct.date})</span>
                                        </td>
                                        <td className="px-3 py-2">
                                            {r.participations.value.toFixed(2)}{" "}
                                            <span className="text-gray-500">({r.participations.date})</span>
                                        </td>
                                        <td className="px-3 py-2">
                                            {r.saves.value} <span className="text-gray-500">({r.saves.date})</span>
                                        </td>
                                        <td className="px-3 py-2">
                                            {Number(r.rating.value).toFixed(2)}{" "}
                                            <span className="text-gray-500">({r.rating.date})</span>
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
                        <div className="text-gray-500">Nenhum jogo no período selecionado.</div>
                    )}
                    {days.map((d) => (
                        <section key={d.date} className="rounded-xl border p-3 shadow-sm">
                            <div className="flex items-center justify-between mb-2">
                                <div className="font-medium">{d.date}</div>
                                <div className="text-sm text-gray-700">
                                    Jogos: <strong>{d.matchesCount}</strong> • {d.wins}V {d.draws}E {d.losses}D • Gols: {d.goalsFor}-{d.goalsAgainst} •
                                    {" "}GF/jg {d.matchesCount ? (d.goalsFor / d.matchesCount).toFixed(2) : "0.00"} •
                                    {" "}GA/jg {d.matchesCount ? (d.goalsAgainst / d.matchesCount).toFixed(2) : "0.00"}
                                </div>
                            </div>

                            <PlayerStatsTable
                                players={d.players}
                                loading={false}
                                error={null}
                                clubStats={null}
                                compactMode
                            />
                        </section>
                    ))}
                </div>
            )}
        </div>
    );
}
