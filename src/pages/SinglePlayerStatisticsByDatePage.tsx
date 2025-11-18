// src/pages/PlayerStatisticsByPlayerPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../services/api.ts";
import { PlayerSingleStatsTable } from "../components/PlayerSingleStatsTable.tsx";
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

// Endpoint agrupado por dia para UM jogador
type PlayerStatisticsByDayDto = {
    date: string;              // "YYYY-MM-DD"
    statistics: PlayerStats[]; // uma entrada por jogo desse jogador nesse dia (com Date)
};

// ===== Utils =====
function fmtYYYYMMDD(d: Date) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const da = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${da}`;
}
const toNum = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : 0);

// "2025-11-04" -> "04/11/2025"
function fmtBRFromISO(iso: string) {
    if (!iso || iso.length < 10) return iso ?? "";
    const [y, m, d] = iso.substring(0, 10).split("-");
    return `${d}/${m}/${y}`;
}

function fmtHM(d: Date) {
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
}

// ======= Cores por data (NUNCA repete entre datas diferentes) =======
type DateColor = { bg: string; border: string; fg: string };

function buildDateColorMap(datesISODesc: string[]): Map<string, DateColor> {
    const uniq: string[] = [];
    const seen = new Set<string>();
    for (const d of datesISODesc) {
        const key = d.slice(0, 10);
        if (!seen.has(key)) {
            seen.add(key);
            uniq.push(key);
        }
    }

    const map = new Map<string, DateColor>();
    const GOLDEN_ANGLE = 137.508;
    for (let i = 0; i < uniq.length; i++) {
        const h = (i * GOLDEN_ANGLE) % 360;
        const bg = `hsl(${h} 80% 88%)`;
        const border = `hsl(${h} 75% 45%)`;
        const fg = "#111827";
        map.set(uniq[i], { bg, border, fg });
    }
    return map;
}

const DateBadge: React.FC<{ dateISO: string; colorMap: Map<string, DateColor>; className?: string }> = ({ dateISO, colorMap, className }) => {
    const key = dateISO.slice(0, 10);
    const c = colorMap.get(key) ?? { bg: "#E5E7EB", border: "#9CA3AF", fg: "#111827" };
    return (
        <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${className ?? ""}`}
            style={{ backgroundColor: c.bg, color: c.fg, borderColor: c.border }}
            title={fmtBRFromISO(dateISO)}
            aria-label={fmtBRFromISO(dateISO)}
        >
            {fmtBRFromISO(dateISO)}
        </span>
    );
};

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
function getMatchesPlayed(p: any): number {
    return toNum(
        p?.matchesPlayed ??
        p?.MatchesPlayed ??
        p?.totalMatches ??
        p?.TotalMatches ??
        0
    );
}
function getSuccessfulTackles(p: any): number {
    return toNum(
        p?.totalTacklesMade ??
        p?.TotalTacklesMade ??
        0
    );
}

type SimplePlayerOption = {
    playerId: number;
    name: string;
};

type SummaryBox = {
    scopeLabel: string;
    totalMatches: number;
    totalWins: number;
    totalDraws: number;
    totalLosses: number;
    totalGoals: number;
    totalAssists: number;
    totalPassesMade: number;
    totalPassAttempts: number;
    totalTacklesMade: number;
    totalTackleAttempts: number;
    totalSaves: number;
    avgRating: number;
    passPct: number;
    tacklePct: number;
    goalsPerGame: number;
    daysCount: number;
    matchesPerDay: number;
};

type PlayerDaySummary = {
    date: string;
    matches: number;
    goals: number;
    assists: number;
    shots: number;
    passesMade: number;
    passesAttempted: number;
    passPct: number;
    tacklesMade: number;
    tacklesAttempted: number;
    tacklePct: number;
    saves: number;
    rating: number;
    firstMatchTime?: string | null;
    lastMatchTime?: string | null;
};

// Estrutura genérica para ranking (serve para jogos e para dias)
type GameRow = {
    id: string;
    dateISO: string | null;
    time: string | null;
    goals: number;
    assists: number;
    passesMade: number;
    passesAttempted: number;
    passPct: number;
    tacklesMade: number;
    tacklesAttempted: number;
    tacklePct: number;
    rating: number;
};

type GameHighlight = {
    item: PlayerStats;
    time: string | null;
    goals: number;
    assists: number;
    passesMade: number;
    passesAttempted: number;
    passPct: number;
    tacklesMade: number;
    tacklesAttempted: number;
    tacklePct: number;
    saves: number;
    rating: number;
    participations: number;
};

function buildGameRows(baseItems: PlayerStats[]): GameRow[] {
    return baseItems.map((p, idx) => {
        const anyP: any = p;

        const goals = toNum(anyP.totalGoals ?? anyP.TotalGoals);
        const assists = toNum(anyP.totalAssists ?? anyP.TotalAssists);
        const passesMade = toNum(anyP.totalPassesMade ?? anyP.TotalPassesMade);
        const passesAttempted = toNum(anyP.totalPassAttempts ?? anyP.TotalPassAttempts);
        const tacklesMade = toNum(anyP.totalTacklesMade ?? anyP.TotalTacklesMade);
        const tacklesAttempted = toNum(anyP.totalTackleAttempts ?? anyP.TotalTackleAttempts);
        const rating = toNum(anyP.avgRating ?? anyP.AvgRating ?? anyP.rating ?? anyP.Rating);
        const passPct = passesAttempted > 0 ? (passesMade * 100) / passesAttempted : 0;
        const tacklePct = tacklesAttempted > 0 ? (tacklesMade * 100) / tacklesAttempted : 0;

        const rawDate = anyP.date ?? anyP.Date;
        let dateISO: string | null = null;
        let time: string | null = null;

        if (rawDate) {
            const d = new Date(rawDate);
            if (!Number.isNaN(d.getTime())) {
                dateISO = d.toISOString();
                time = fmtHM(d);
            }
        }

        const id = `${idx}-${dateISO ?? "nodate"}-${goals}-${assists}`;

        return {
            id,
            dateISO,
            time,
            goals,
            assists,
            passesMade,
            passesAttempted,
            passPct,
            tacklesMade,
            tacklesAttempted,
            tacklePct,
            rating,
        };
    });
}

export default function PlayerStatisticsByPlayerPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [days, setDays] = useState<DayBlock[]>([]);

    // clubes selecionados (?clubIds=355651,352016,...)
    const clubIds = useMemo(() => {
        const raw = searchParams.get("clubIds");
        if (!raw) return [] as number[];
        return raw
            .split(",")
            .map((s) => parseInt(s.trim(), 10))
            .filter((n) => !Number.isNaN(n));
    }, [searchParams]);

    // range (URL ou fixo/inicial)
    const [dateFrom, setDateFrom] = useState(() => {
        const fromUrl = searchParams.get("dateFrom");
        if (fromUrl) return fromUrl;
        return "2025-10-14"; // FIXO
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

    // ===== Fetch agrupado por dia (clubes + todos jogadores) =====
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

    // ===== Índice de jogadores (chips) =====
    const playerOptions: SimplePlayerOption[] = useMemo(() => {
        const map = new Map<number, string>();
        for (const d of days) {
            for (const p of d.players) {
                const pid = toNum((p as any).playerId ?? (p as any).PlayerId);
                if (!pid) continue;
                const name =
                    (p as any).playerName ??
                    (p as any).PlayerName ??
                    (p as any).proName ??
                    (p as any).ProName ??
                    `Player ${pid}`;
                if (!map.has(pid)) {
                    map.set(pid, name);
                }
            }
        }
        return Array.from(map.entries())
            .map(([playerId, name]) => ({ playerId, name }))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [days]);

    const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);

    // seleção padrão
    useEffect(() => {
        if (!playerOptions.length) {
            setSelectedPlayerId(null);
        } else if (!selectedPlayerId || !playerOptions.some(p => p.playerId === selectedPlayerId)) {
            setSelectedPlayerId(playerOptions[0].playerId);
        }
    }, [playerOptions, selectedPlayerId]);

    // ===== Datas em que o jogador jogou =====
    const datesForSelectedPlayer = useMemo(() => {
        if (!selectedPlayerId) return [] as string[];
        const set = new Set<string>();
        for (const d of days) {
            const hasPlayer = d.players.some(p => {
                const pid = toNum((p as any).playerId ?? (p as any).PlayerId);
                return pid === selectedPlayerId;
            });
            if (hasPlayer) {
                set.add(d.date.slice(0, 10));
            }
        }
        return Array.from(set).sort((a, b) => b.localeCompare(a)); // desc
    }, [days, selectedPlayerId]);

    const [selectedDayKey, setSelectedDayKey] = useState<string>("all"); // "all" ou "YYYY-MM-DD"

    // reset de dia ao trocar jogador
    useEffect(() => {
        setSelectedDayKey("all");
    }, [selectedPlayerId]);

    const useDaysRanking = selectedDayKey === "all";

    // ===== Mapa de cores por data =====
    const dateColorMap = useMemo(() => {
        const datesDesc = days.map(d => d.date);
        return buildDateColorMap(datesDesc);
    }, [days]);

    // ===== Jogo a jogo via endpoint /api/Clubs/matches/statistics/player/by-date-range-grouped =====
    const [playerMatchesByDay, setPlayerMatchesByDay] = useState<PlayerStatisticsByDayDto[]>([]);
    const [matchesLoading, setMatchesLoading] = useState(false);
    const [matchesError, setMatchesError] = useState<string | null>(null);

    useEffect(() => {
        if (!selectedPlayerId || !clubIds.length) {
            setPlayerMatchesByDay([]);
            setMatchesError(null);
            setMatchesLoading(false);
            return;
        }

        let disposed = false;

        async function fetchMatches() {
            setMatchesLoading(true);
            setMatchesError(null);
            try {
                const params: Record<string, string | number> = {
                    playerId: selectedPlayerId,
                    start: dateFrom,
                    end: dateTo,
                    clubIds: clubIds.join(","),
                };

                const { data } = await api.get<PlayerStatisticsByDayDto[]>(
                    "/api/clubs/matches/statistics/player/by-date-range-grouped",
                    { params }
                );

                if (disposed) return;

                setPlayerMatchesByDay(Array.isArray(data) ? data : []);
            } catch (e: any) {
                if (disposed) return;
                setPlayerMatchesByDay([]);
                setMatchesError(e?.message ?? "Falha ao carregar jogos do jogador");
            } finally {
                if (!disposed) setMatchesLoading(false);
            }
        }

        fetchMatches();
        return () => {
            disposed = true;
        };
    }, [selectedPlayerId, dateFrom, dateTo, clubIds]);

    // ===== Resumo por dia só desse jogador =====
    const perDayForPlayer: PlayerDaySummary[] = useMemo(() => {
        if (!selectedPlayerId) return [];
        const list: PlayerDaySummary[] = [];

        for (const d of days) {
            const player = d.players.find(p => {
                const pid = toNum((p as any).playerId ?? (p as any).PlayerId);
                return pid === selectedPlayerId;
            });
            if (!player) continue;

            const matches = Math.max(1, getMatchesPlayed(player));
            const goals = toNum((player as any).totalGoals ?? (player as any).TotalGoals);
            const assists = toNum((player as any).totalAssists ?? (player as any).TotalAssists);
            const shots = toNum((player as any).totalShots ?? (player as any).TotalShots);
            const passesMade = toNum((player as any).totalPassesMade ?? (player as any).TotalPassesMade);
            const passesAttempted = toNum((player as any).totalPassAttempts ?? (player as any).TotalPassAttempts);
            const passPct = getPassPct(player as any);
            const tacklesMade = getSuccessfulTackles(player as any);
            const tacklesAttempted = toNum((player as any).totalTackleAttempts ?? (player as any).TotalTackleAttempts);
            const tacklePct = getTacklePct(player as any);
            const saves = toNum((player as any).totalSaves ?? (player as any).TotalSaves);
            const rating = toNum((player as any).avgRating ?? (player as any).AvgRating);

            const dayKey = d.date.slice(0, 10);
            const matchesEntry = playerMatchesByDay.find(pm => pm.date.slice(0, 10) === dayKey);
            let firstMatchTime: string | null = null;
            let lastMatchTime: string | null = null;

            if (matchesEntry && matchesEntry.statistics?.length) {
                const times: Date[] = matchesEntry.statistics
                    .map((sp: any) => {
                        const raw = sp.date ?? sp.Date;
                        if (!raw) return null;
                        const parsed = new Date(raw);
                        return Number.isNaN(parsed.getTime()) ? null : parsed;
                    })
                    .filter((x): x is Date => x !== null);

                if (times.length) {
                    times.sort((a, b) => a.getTime() - b.getTime());
                    firstMatchTime = fmtHM(times[0]);
                    lastMatchTime = fmtHM(times[times.length - 1]);
                }
            }

            list.push({
                date: d.date,
                matches,
                goals,
                assists,
                shots,
                passesMade,
                passesAttempted,
                passPct,
                tacklesMade,
                tacklesAttempted,
                tacklePct,
                saves,
                rating,
                firstMatchTime,
                lastMatchTime,
            });
        }
        return list.sort((a, b) => b.date.localeCompare(a.date));
    }, [days, selectedPlayerId, playerMatchesByDay]);

    // Todas as partidas (flatten dos jogos por dia)
    const allGames: PlayerStats[] = useMemo(() => {
        const result: PlayerStats[] = [];
        for (const d of playerMatchesByDay) {
            if (Array.isArray(d.statistics)) {
                result.push(...d.statistics);
            }
        }
        return result;
    }, [playerMatchesByDay]);

    // Linhas (jogos) para o dia selecionado
    const matchesForSelectedDay: PlayerStats[] = useMemo(() => {
        if (!selectedPlayerId || selectedDayKey === "all") return [];
        const day = playerMatchesByDay.find(d => d.date.slice(0, 10) === selectedDayKey);
        return day?.statistics ?? [];
    }, [playerMatchesByDay, selectedPlayerId, selectedDayKey]);

    // ===== Estatísticas gerais (período OU dia) =====
    const summary: SummaryBox | null = useMemo(() => {
        if (!selectedPlayerId) return null;

        const baseItems =
            selectedDayKey === "all" ? allGames : matchesForSelectedDay;

        if (!baseItems.length) return null;

        let totalMatches = 0;
        let totalWins = 0;
        let totalDraws = 0;
        let totalLosses = 0;
        let totalGoals = 0;
        let totalAssists = 0;
        let totalPassesMade = 0;
        let totalPassAttempts = 0;
        let totalTacklesMade = 0;
        let totalTackleAttempts = 0;
        let totalSaves = 0;
        let ratingSum = 0;

        for (const p of baseItems) {
            const anyP: any = p;

            const mp = getMatchesPlayed(anyP) || 1;
            totalMatches += mp;

            totalWins += toNum(anyP.totalWins ?? anyP.TotalWins);
            totalDraws += toNum(anyP.totalDraws ?? anyP.TotalDraws);
            totalLosses += toNum(anyP.totalLosses ?? anyP.TotalLosses);

            totalGoals += toNum(anyP.totalGoals ?? anyP.TotalGoals);
            totalAssists += toNum(anyP.totalAssists ?? anyP.TotalAssists);
            totalPassesMade += toNum(anyP.totalPassesMade ?? anyP.TotalPassesMade);
            totalPassAttempts += toNum(anyP.totalPassAttempts ?? anyP.TotalPassAttempts);
            totalTacklesMade += toNum(anyP.totalTacklesMade ?? anyP.TotalTacklesMade);
            totalTackleAttempts += toNum(anyP.totalTackleAttempts ?? anyP.TotalTackleAttempts);
            totalSaves += toNum(anyP.totalSaves ?? anyP.TotalSaves);

            ratingSum += toNum(anyP.avgRating ?? anyP.AvgRating ?? anyP.rating ?? anyP.Rating);
        }

        const passPct = totalPassAttempts > 0 ? (totalPassesMade * 100) / totalPassAttempts : 0;
        const tacklePct = totalTackleAttempts > 0 ? (totalTacklesMade * 100) / totalTackleAttempts : 0;
        const goalsPerGame = totalMatches > 0 ? totalGoals / totalMatches : 0;
        const avgRating = baseItems.length > 0 ? ratingSum / baseItems.length : 0;

        const daysCount =
            selectedDayKey === "all" ? perDayForPlayer.length : 1;
        const matchesPerDay =
            daysCount > 0 ? totalMatches / daysCount : totalMatches;

        const scopeLabel =
            selectedDayKey === "all"
                ? `${fmtBRFromISO(dateFrom)} — ${fmtBRFromISO(dateTo)}`
                : fmtBRFromISO(selectedDayKey);

        return {
            scopeLabel,
            totalMatches,
            totalWins,
            totalDraws,
            totalLosses,
            totalGoals,
            totalAssists,
            totalPassesMade,
            totalPassAttempts,
            totalTacklesMade,
            totalTackleAttempts,
            totalSaves,
            avgRating,
            passPct,
            tacklePct,
            goalsPerGame,
            daysCount,
            matchesPerDay,
        };
    }, [
        selectedPlayerId,
        selectedDayKey,
        allGames,
        matchesForSelectedDay,
        perDayForPlayer.length,
        dateFrom,
        dateTo,
    ]);

    // ===== Rankings por dia (melhor dia) =====
    const bestDay = useMemo(() => {
        if (!selectedPlayerId || perDayForPlayer.length === 0) return null;

        const sorted = [...perDayForPlayer].sort((a, b) => {
            const partA = a.goals + a.assists;
            const partB = b.goals + b.assists;
            if (partB !== partA) return partB - partA;
            return b.rating - a.rating;
        });

        return sorted[0];
    }, [selectedPlayerId, perDayForPlayer]);

    // ===== Destaques de jogos para o dia selecionado =====
    const gameHighlights: GameHighlight[] = useMemo(() => {
        if (!selectedPlayerId || selectedDayKey === "all" || !matchesForSelectedDay.length) {
            return [];
        }

        return [...matchesForSelectedDay]
            .map((p) => {
                const anyP: any = p;

                const goals = toNum(anyP.totalGoals ?? anyP.TotalGoals);
                const assists = toNum(anyP.totalAssists ?? anyP.TotalAssists);
                const passesMade = toNum(anyP.totalPassesMade ?? anyP.TotalPassesMade);
                const passesAttempted = toNum(anyP.totalPassAttempts ?? anyP.TotalPassAttempts);
                const tacklesMade = toNum(anyP.totalTacklesMade ?? anyP.TotalTacklesMade);
                const tacklesAttempted = toNum(anyP.totalTackleAttempts ?? anyP.TotalTackleAttempts);
                const saves = toNum(anyP.totalSaves ?? anyP.TotalSaves);
                const rating = toNum(anyP.avgRating ?? anyP.AvgRating ?? anyP.rating ?? anyP.Rating);
                const passPct = passesAttempted > 0 ? (passesMade * 100) / passesAttempted : 0;
                const tacklePct = tacklesAttempted > 0 ? (tacklesMade * 100) / tacklesAttempted : 0;
                const participations = goals + assists;

                const rawDate = anyP.date ?? anyP.Date;
                let time: string | null = null;
                if (rawDate) {
                    const d = new Date(rawDate);
                    if (!Number.isNaN(d.getTime())) {
                        time = fmtHM(d);
                    }
                }

                return {
                    item: p,
                    time,
                    goals,
                    assists,
                    passesMade,
                    passesAttempted,
                    passPct,
                    tacklesMade,
                    tacklesAttempted,
                    tacklePct,
                    saves,
                    rating,
                    participations,
                };
            })
            .sort((a, b) => {
                if (b.participations !== a.participations) return b.participations - a.participations;
                return b.rating - a.rating;
            });
    }, [selectedPlayerId, selectedDayKey, matchesForSelectedDay]);

    const bestGameOfDay = gameHighlights.length ? gameHighlights[0] : null;

    // ===== Listas de jogos para rankings "Top 5" / "Piores 5" =====
    const gamesForRanking: GameRow[] = useMemo(() => {
        const base =
            selectedDayKey === "all" ? allGames : matchesForSelectedDay;
        if (!base.length) return [];
        return buildGameRows(base);
    }, [allGames, matchesForSelectedDay, selectedDayKey]);

    // ===== Linhas de DIAS para ranking quando "Todos" está selecionado =====
    const dayRowsForRanking: GameRow[] = useMemo(() => {
        return perDayForPlayer.map((d) => {
            const dateKey = d.date.slice(0, 10);
            const dateISO = `${dateKey}T00:00:00Z`;

            return {
                id: `day-${dateKey}`,
                dateISO,
                time: null,
                goals: d.goals,
                assists: d.assists,
                passesMade: d.passesMade,
                passesAttempted: d.passesAttempted,
                passPct: d.passPct,
                tacklesMade: d.tacklesMade,
                tacklesAttempted: d.tacklesAttempted,
                tacklePct: d.tacklePct,
                rating: d.rating,
            };
        });
    }, [perDayForPlayer]);

    // ===== RANKINGS POR JOGO (já existiam) =====
    const bestGoalsGames = useMemo(() => {
        return [...gamesForRanking]
            .sort((a, b) => (b.goals - a.goals) || (b.rating - a.rating))
            .slice(0, 5);
    }, [gamesForRanking]);

    const worstGoalsGames = useMemo(() => {
        return [...gamesForRanking]
            .sort((a, b) => (a.goals - b.goals) || (a.rating - b.rating))
            .slice(0, 5);
    }, [gamesForRanking]);

    const bestAssistsGames = useMemo(() => {
        return [...gamesForRanking]
            .sort((a, b) => (b.assists - a.assists) || (b.rating - a.rating))
            .slice(0, 5);
    }, [gamesForRanking]);

    const worstAssistsGames = useMemo(() => {
        return [...gamesForRanking]
            .sort((a, b) => (a.assists - b.assists) || (a.rating - b.rating))
            .slice(0, 5);
    }, [gamesForRanking]);

    const bestTacklesGames = useMemo(() => {
        return [...gamesForRanking]
            .sort((a, b) => (b.tacklesMade - a.tacklesMade) || (b.tacklePct - a.tacklePct))
            .slice(0, 5);
    }, [gamesForRanking]);

    const worstTacklesGames = useMemo(() => {
        return [...gamesForRanking]
            .sort((a, b) => (a.tacklePct - b.tacklePct) || (a.tacklesMade - b.tacklesMade))
            .slice(0, 5);
    }, [gamesForRanking]);

    const bestPassesGames = useMemo(() => {
        return [...gamesForRanking]
            .sort(
                (a, b) =>
                    b.passPct - a.passPct ||
                    b.passesMade - a.passesMade
            )
            .slice(0, 5);
    }, [gamesForRanking]);

    const worstPassesGames = useMemo(() => {
        return [...gamesForRanking]
            .sort(
                (a, b) =>
                    a.passPct - b.passPct ||
                    a.passesMade - b.passesMade
            )
            .slice(0, 5);
    }, [gamesForRanking]);

    // ===== RANKINGS POR DIA (quando "Todos" está selecionado) =====
    const bestGoalsDays = useMemo(() => {
        return [...dayRowsForRanking]
            .sort((a, b) => (b.goals - a.goals) || (b.rating - a.rating))
            .slice(0, 5);
    }, [dayRowsForRanking]);

    const worstGoalsDays = useMemo(() => {
        return [...dayRowsForRanking]
            .sort((a, b) => (a.goals - b.goals) || (a.rating - b.rating))
            .slice(0, 5);
    }, [dayRowsForRanking]);

    const bestAssistsDays = useMemo(() => {
        return [...dayRowsForRanking]
            .sort((a, b) => (b.assists - a.assists) || (b.rating - a.rating))
            .slice(0, 5);
    }, [dayRowsForRanking]);

    const worstAssistsDays = useMemo(() => {
        return [...dayRowsForRanking]
            .sort((a, b) => (a.assists - b.assists) || (a.rating - b.rating))
            .slice(0, 5);
    }, [dayRowsForRanking]);

    const bestTacklesDays = useMemo(() => {
        return [...dayRowsForRanking]
            .sort((a, b) => (b.tacklesMade - a.tacklesMade) || (b.tacklePct - a.tacklePct))
            .slice(0, 5);
    }, [dayRowsForRanking]);

    const worstTacklesDays = useMemo(() => {
        return [...dayRowsForRanking]
            .sort((a, b) => (a.tacklePct - b.tacklePct) || (a.tacklesMade - b.tacklesMade))
            .slice(0, 5);
    }, [dayRowsForRanking]);

    const bestPassesDays = useMemo(() => {
        return [...dayRowsForRanking]
            .sort(
                (a, b) =>
                    b.passPct - a.passPct ||
                    b.passesMade - a.passesMade
            )
            .slice(0, 5);
    }, [dayRowsForRanking]);

    const worstPassesDays = useMemo(() => {
        return [...dayRowsForRanking]
            .sort(
                (a, b) =>
                    a.passPct - b.passPct ||
                    a.passesMade - b.passesMade
            )
            .slice(0, 5);
    }, [dayRowsForRanking]);

    // ===== Escolha entre listas por DIA ou por JOGO =====
    const topGoalsList = useDaysRanking ? bestGoalsDays : bestGoalsGames;
    const worstGoalsList = useDaysRanking ? worstGoalsDays : worstGoalsGames;

    const topAssistsList = useDaysRanking ? bestAssistsDays : bestAssistsGames;
    const worstAssistsList = useDaysRanking ? worstAssistsDays : worstAssistsGames;

    const topTacklesList = useDaysRanking ? bestTacklesDays : bestTacklesGames;
    const worstTacklesList = useDaysRanking ? worstTacklesDays : worstTacklesGames;

    const topPassesList = useDaysRanking ? bestPassesDays : bestPassesGames;
    const worstPassesList = useDaysRanking ? worstPassesDays : worstPassesGames;

    const hasRankingData = useDaysRanking
        ? dayRowsForRanking.length > 0
        : gamesForRanking.length > 0;

    // ===== Render =====
    const selectedPlayerName =
        playerOptions.find(p => p.playerId === selectedPlayerId)?.name ?? "—";

    const modeBadgeClass =
        "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border " +
        (useDaysRanking
            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
            : "bg-sky-50 text-sky-700 border-sky-200");

    const modeLabel = useDaysRanking ? "Modo: dias" : "Modo: jogos";

    return (
        <div className="p-4 flex flex-col gap-6">
            {/* Header & filtros */}
            <header className="flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <h1 className="text-xl font-semibold">
                        Estatísticas individuais por data
                    </h1>
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
                </div>

                {/* Seleção de jogador e dia – chips */}
                <div className="flex flex-col gap-3">
                    {/* Jogadores */}
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium">Jogador</span>
                            {selectedPlayerName !== "—" && (
                                <span className="text-xs text-gray-500">
                                    Selecionado: <strong>{selectedPlayerName}</strong>
                                </span>
                            )}
                        </div>
                        {playerOptions.length === 0 ? (
                            <div className="text-xs text-gray-500 italic">
                                Nenhum jogador encontrado no período.
                            </div>
                        ) : (
                            <div className="flex flex-wrap gap-2">
                                {playerOptions.map((p) => {
                                    const isActive = p.playerId === selectedPlayerId;
                                    return (
                                        <button
                                            key={p.playerId}
                                            type="button"
                                            onClick={() => setSelectedPlayerId(p.playerId)}
                                            className={
                                                "px-3 py-1 rounded-full text-xs sm:text-sm border transition-colors " +
                                                (isActive
                                                    ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                                                    : "bg-white text-gray-800 border-gray-300 hover:bg-gray-50")
                                            }
                                        >
                                            {p.name}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Dias */}
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium">Dia</span>
                            <span className="text-xs text-gray-500">
                                Clique em um dia para ver jogo a jogo, ou em <strong>Todos</strong> para o resumo.
                            </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {/* Chip "Todos os dias" */}
                            <button
                                type="button"
                                onClick={() => setSelectedDayKey("all")}
                                className={
                                    "px-3 py-1 rounded-full text-xs sm:text-sm border transition-colors " +
                                    (selectedDayKey === "all"
                                        ? "bg-gray-800 text-white border-gray-800 shadow-sm"
                                        : "bg-white text-gray-800 border-gray-300 hover:bg-gray-50")
                                }
                            >
                                Todos os dias
                            </button>

                            {/* Chips de datas, cada um na cor do dia */}
                            {datesForSelectedPlayer.map((d) => {
                                const key = d.slice(0, 10);
                                const c = dateColorMap.get(key) ?? {
                                    bg: "#E5E7EB",
                                    border: "#9CA3AF",
                                    fg: "#111827",
                                };
                                const isActive = selectedDayKey === d;

                                return (
                                    <button
                                        key={d}
                                        type="button"
                                        onClick={() => setSelectedDayKey(d)}
                                        className={
                                            "px-3 py-1 rounded-full text-xs sm:text-sm border transition-transform " +
                                            (isActive ? "ring-2 ring-offset-1 ring-offset-white" : "")
                                        }
                                        style={{
                                            backgroundColor: c.bg,
                                            borderColor: c.border,
                                            color: c.fg,
                                            transform: isActive ? "scale(1.03)" : "scale(1.0)",
                                        }}
                                    >
                                        {fmtBRFromISO(d)}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </header>

            {/* BLOCO DE RESUMO GERAL (período ou dia) */}
            {summary && (
                <section className="rounded-xl border bg-slate-50 p-3 sm:p-4 flex flex-col gap-3">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                        <div className="flex items-center gap-2">
                            <h2 className="text-sm sm:text-base font-semibold">
                                Resumo geral —{" "}
                                {selectedDayKey === "all" ? "período selecionado" : "dia selecionado"}
                            </h2>
                            <span className={modeBadgeClass}>{modeLabel}</span>
                        </div>
                        <span className="text-xs text-gray-500">
                            Intervalo: {summary.scopeLabel}
                        </span>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                        {/* Jogos */}
                        <div className="bg-white rounded-lg border px-3 py-2 flex flex-col gap-1">
                            <span className="text-xs uppercase tracking-wide text-gray-500">
                                Jogos
                            </span>
                            <span className="text-lg font-semibold">
                                {summary.totalMatches}
                            </span>
                            {selectedDayKey === "all" && (
                                <span className="text-xs text-gray-500">
                                    {summary.daysCount} dia(s);{" "}
                                    {summary.matchesPerDay.toFixed(2)} jogos/dia
                                </span>
                            )}
                        </div>

                        {/* Resultados */}
                        <div className="bg-white rounded-lg border px-3 py-2 flex flex-col gap-1">
                            <span className="text-xs uppercase tracking-wide text-gray-500">
                                Resultados
                            </span>
                            <span className="text-sm">
                                <strong>{summary.totalWins}</strong>V{" "}
                                <strong>{summary.totalDraws}</strong>E{" "}
                                <strong>{summary.totalLosses}</strong>D
                            </span>
                            <span className="text-xs text-gray-500">
                                Win{" "}
                                {summary.totalMatches > 0
                                    ? ((summary.totalWins * 100) / summary.totalMatches).toFixed(1)
                                    : "0.0"}
                                %
                            </span>
                        </div>

                        {/* Gols / Assistências */}
                        <div className="bg-white rounded-lg border px-3 py-2 flex flex-col gap-1">
                            <span className="text-xs uppercase tracking-wide text-gray-500">
                                Gols &amp; Assistências
                            </span>
                            <span className="text-sm">
                                Gols: <strong>{summary.totalGoals}</strong>{" "}
                                — Ast: <strong>{summary.totalAssists}</strong>
                            </span>
                            <span className="text-xs text-gray-500">
                                {summary.goalsPerGame.toFixed(2)} gol/jogo
                            </span>
                        </div>

                        {/* Passes / Desarmes / Nota */}
                        <div className="bg-white rounded-lg border px-3 py-2 flex flex-col gap-1">
                            <span className="text-xs uppercase tracking-wide text-gray-500">
                                Passe, desarme e nota
                            </span>
                            <span className="text-xs">
                                Passe:{" "}
                                <strong>
                                    {summary.passPct.toFixed(1)}%
                                </strong>{" "}
                                ({summary.totalPassesMade}/{summary.totalPassAttempts})
                            </span>
                            <span className="text-xs">
                                Desarme:{" "}
                                <strong>
                                    {summary.tacklePct.toFixed(1)}%
                                </strong>{" "}
                                ({summary.totalTacklesMade}/{summary.totalTackleAttempts})
                            </span>
                            <span className="text-xs text-gray-500">
                                Nota média: {summary.avgRating.toFixed(2)} — Defesas:{" "}
                                {summary.totalSaves}
                            </span>
                        </div>
                    </div>
                </section>
            )}

            {/* BLOCO: MELHOR DIA + RANKINGS */}
            {selectedPlayerId && perDayForPlayer.length > 0 && (
                <section className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <h2 className="text-sm sm:text-base font-semibold">
                                Melhor dia do jogador e rankings
                            </h2>
                            <span className={modeBadgeClass}>{modeLabel}</span>
                        </div>
                    </div>

                    {/* Melhor dia */}
                    {bestDay && (
                        <div className="rounded-lg border bg-white p-3 flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                                <span className="text-xs uppercase tracking-wide text-gray-500">
                                    Melhor dia do jogador (part. = gols + assistências)
                                </span>
                                <DateBadge
                                    dateISO={bestDay.date.slice(0, 10)}
                                    colorMap={dateColorMap}
                                />
                            </div>
                            <div className="flex flex-wrap gap-4 text-xs sm:text-sm text-gray-700 mt-1">
                                <span>Jogos: <strong>{bestDay.matches}</strong></span>
                                <span>G/A: <strong>{bestDay.goals}</strong> / <strong>{bestDay.assists}</strong></span>
                                <span>Participações: <strong>{bestDay.goals + bestDay.assists}</strong></span>
                                <span>Passes: <strong>{bestDay.passesMade}</strong> / {bestDay.passesAttempted} ({bestDay.passPct.toFixed(1)}%)</span>
                                <span>Desarmes: <strong>{bestDay.tacklesMade}</strong> / {bestDay.tacklesAttempted} ({bestDay.tacklePct.toFixed(1)}%)</span>
                                <span>Nota média: <strong>{bestDay.rating.toFixed(2)}</strong></span>
                                {bestDay.firstMatchTime && (
                                    <span>
                                        Janela:{" "}
                                        {bestDay.firstMatchTime === bestDay.lastMatchTime
                                            ? bestDay.firstMatchTime
                                            : `${bestDay.firstMatchTime}–${bestDay.lastMatchTime}`}
                                    </span>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Top 5 / Piores 5 */}
                    {hasRankingData && (
                        <>
                            {/* TOP 5 */}
                            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                                {/* Gols */}
                                <div className="border rounded-xl bg-white shadow-sm p-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs font-semibold text-gray-700">
                                            {useDaysRanking
                                                ? "TOP 5 MELHORES DIAS EM GOLS"
                                                : "TOP 5 JOGOS EM GOLS"}
                                        </span>
                                        <span className={modeBadgeClass}>{modeLabel}</span>
                                    </div>
                                    <table className="w-full text-xs">
                                        <thead className="text-[11px] text-gray-500">
                                            <tr>
                                                <th className="text-left pb-1">Data/Hora</th>
                                                <th className="text-right pb-1">Gols</th>
                                                <th className="text-right pb-1">Nota</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {topGoalsList.map((g) => (
                                                <tr key={`tg-${g.id}`} className="hover:bg-gray-50">
                                                    <td className="py-0.5 pr-2">
                                                        {g.dateISO ? (
                                                            <>
                                                                <DateBadge dateISO={g.dateISO} colorMap={dateColorMap} />
                                                                {g.time && !useDaysRanking && (
                                                                    <span className="ml-1 text-[11px] text-gray-500">
                                                                        {g.time}
                                                                    </span>
                                                                )}
                                                            </>
                                                        ) : "—"}
                                                    </td>
                                                    <td className="py-0.5 text-right">{g.goals}</td>
                                                    <td className="py-0.5 text-right text-gray-600">
                                                        {g.rating.toFixed(2)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Assistências */}
                                <div className="border rounded-xl bg-white shadow-sm p-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs font-semibold text-gray-700">
                                            {useDaysRanking
                                                ? "TOP 5 MELHORES DIAS EM ASSISTÊNCIAS"
                                                : "TOP 5 JOGOS EM ASSISTÊNCIAS"}
                                        </span>
                                        <span className={modeBadgeClass}>{modeLabel}</span>
                                    </div>
                                    <table className="w-full text-xs">
                                        <thead className="text-[11px] text-gray-500">
                                            <tr>
                                                <th className="text-left pb-1">Data/Hora</th>
                                                <th className="text-right pb-1">Ast</th>
                                                <th className="text-right pb-1">Nota</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {topAssistsList.map((g) => (
                                                <tr key={`ta-${g.id}`} className="hover:bg-gray-50">
                                                    <td className="py-0.5 pr-2">
                                                        {g.dateISO ? (
                                                            <>
                                                                <DateBadge dateISO={g.dateISO} colorMap={dateColorMap} />
                                                                {g.time && !useDaysRanking && (
                                                                    <span className="ml-1 text-[11px] text-gray-500">
                                                                        {g.time}
                                                                    </span>
                                                                )}
                                                            </>
                                                        ) : "—"}
                                                    </td>
                                                    <td className="py-0.5 text-right">{g.assists}</td>
                                                    <td className="py-0.5 text-right text-gray-600">
                                                        {g.rating.toFixed(2)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Desarmes */}
                                <div className="border rounded-xl bg-white shadow-sm p-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs font-semibold text-gray-700">
                                            {useDaysRanking
                                                ? "TOP 5 MELHORES DIAS EM DESARMES"
                                                : "TOP 5 JOGOS EM DESARMES"}
                                        </span>
                                        <span className={modeBadgeClass}>{modeLabel}</span>
                                    </div>
                                    <table className="w-full text-xs">
                                        <thead className="text-[11px] text-gray-500">
                                            <tr>
                                                <th className="text-left pb-1">Data/Hora</th>
                                                <th className="text-right pb-1">Des.</th>
                                                <th className="text-right pb-1">% Des.</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {topTacklesList.map((g) => (
                                                <tr key={`tt-${g.id}`} className="hover:bg-gray-50">
                                                    <td className="py-0.5 pr-2">
                                                        {g.dateISO ? (
                                                            <>
                                                                <DateBadge dateISO={g.dateISO} colorMap={dateColorMap} />
                                                                {g.time && !useDaysRanking && (
                                                                    <span className="ml-1 text-[11px] text-gray-500">
                                                                        {g.time}
                                                                    </span>
                                                                )}
                                                            </>
                                                        ) : "—"}
                                                    </td>
                                                    <td className="py-0.5 text-right">{g.tacklesMade}</td>
                                                    <td className="py-0.5 text-right text-gray-600">
                                                        {g.tacklePct.toFixed(1)}%
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Passes */}
                                <div className="border rounded-xl bg-white shadow-sm p-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs font-semibold text-gray-700">
                                            {useDaysRanking
                                                ? "TOP 5 MELHORES DIAS EM PASSES"
                                                : "TOP 5 JOGOS EM PASSES"}
                                        </span>
                                        <span className={modeBadgeClass}>{modeLabel}</span>
                                    </div>
                                    <table className="w-full text-xs">
                                        <thead className="text-[11px] text-gray-500">
                                            <tr>
                                                <th className="text-left pb-1">Data/Hora</th>
                                                <th className="text-right pb-1">Passes C/T</th>
                                                <th className="text-right pb-1">% Passe</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {topPassesList.map((g) => (
                                                <tr key={`tp-${g.id}`} className="hover:bg-gray-50">
                                                    <td className="py-0.5 pr-2">
                                                        {g.dateISO ? (
                                                            <>
                                                                <DateBadge dateISO={g.dateISO} colorMap={dateColorMap} />
                                                                {g.time && !useDaysRanking && (
                                                                    <span className="ml-1 text-[11px] text-gray-500">
                                                                        {g.time}
                                                                    </span>
                                                                )}
                                                            </>
                                                        ) : "—"}
                                                    </td>
                                                    <td className="py-0.5 text-right">
                                                        {g.passesMade} / {g.passesAttempted}
                                                    </td>
                                                    <td className="py-0.5 text-right text-gray-600">
                                                        {g.passPct.toFixed(1)}%
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* PIORES 5 */}
                            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                                {/* Gols */}
                                <div className="border rounded-xl bg-white shadow-sm p-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs font-semibold text-gray-700">
                                            {useDaysRanking
                                                ? "PIORES 5 DIAS EM GOLS"
                                                : "PIORES 5 JOGOS EM GOLS"}
                                        </span>
                                        <span className={modeBadgeClass}>{modeLabel}</span>
                                    </div>
                                    <table className="w-full text-xs">
                                        <thead className="text-[11px] text-gray-500">
                                            <tr>
                                                <th className="text-left pb-1">Data/Hora</th>
                                                <th className="text-right pb-1">Gols</th>
                                                <th className="text-right pb-1">Nota</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {worstGoalsList.map((g) => (
                                                <tr key={`wg-${g.id}`} className="hover:bg-gray-50">
                                                    <td className="py-0.5 pr-2">
                                                        {g.dateISO ? (
                                                            <>
                                                                <DateBadge dateISO={g.dateISO} colorMap={dateColorMap} />
                                                                {g.time && !useDaysRanking && (
                                                                    <span className="ml-1 text-[11px] text-gray-500">
                                                                        {g.time}
                                                                    </span>
                                                                )}
                                                            </>
                                                        ) : "—"}
                                                    </td>
                                                    <td className="py-0.5 text-right">{g.goals}</td>
                                                    <td className="py-0.5 text-right text-gray-600">
                                                        {g.rating.toFixed(2)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Assistências */}
                                <div className="border rounded-xl bg-white shadow-sm p-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs font-semibold text-gray-700">
                                            {useDaysRanking
                                                ? "PIORES 5 DIAS EM ASSISTÊNCIAS"
                                                : "PIORES 5 JOGOS EM ASSISTÊNCIAS"}
                                        </span>
                                        <span className={modeBadgeClass}>{modeLabel}</span>
                                    </div>
                                    <table className="w-full text-xs">
                                        <thead className="text-[11px] text-gray-500">
                                            <tr>
                                                <th className="text-left pb-1">Data/Hora</th>
                                                <th className="text-right pb-1">Ast</th>
                                                <th className="text-right pb-1">Nota</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {worstAssistsList.map((g) => (
                                                <tr key={`wa-${g.id}`} className="hover:bg-gray-50">
                                                    <td className="py-0.5 pr-2">
                                                        {g.dateISO ? (
                                                            <>
                                                                <DateBadge dateISO={g.dateISO} colorMap={dateColorMap} />
                                                                {g.time && !useDaysRanking && (
                                                                    <span className="ml-1 text-[11px] text-gray-500">
                                                                        {g.time}
                                                                    </span>
                                                                )}
                                                            </>
                                                        ) : "—"}
                                                    </td>
                                                    <td className="py-0.5 text-right">{g.assists}</td>
                                                    <td className="py-0.5 text-right text-gray-600">
                                                        {g.rating.toFixed(2)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Desarmes */}
                                <div className="border rounded-xl bg-white shadow-sm p-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs font-semibold text-gray-700">
                                            {useDaysRanking
                                                ? "PIORES 5 DIAS EM DESARMES"
                                                : "PIORES 5 JOGOS EM DESARMES"}
                                        </span>
                                        <span className={modeBadgeClass}>{modeLabel}</span>
                                    </div>
                                    <table className="w-full text-xs">
                                        <thead className="text-[11px] text-gray-500">
                                            <tr>
                                                <th className="text-left pb-1">Data/Hora</th>
                                                <th className="text-right pb-1">Des.</th>
                                                <th className="text-right pb-1">% Des.</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {worstTacklesList.map((g) => (
                                                <tr key={`wt-${g.id}`} className="hover:bg-gray-50">
                                                    <td className="py-0.5 pr-2">
                                                        {g.dateISO ? (
                                                            <>
                                                                <DateBadge dateISO={g.dateISO} colorMap={dateColorMap} />
                                                                {g.time && !useDaysRanking && (
                                                                    <span className="ml-1 text-[11px] text-gray-500">
                                                                        {g.time}
                                                                    </span>
                                                                )}
                                                            </>
                                                        ) : "—"}
                                                    </td>
                                                    <td className="py-0.5 text-right">{g.tacklesMade}</td>
                                                    <td className="py-0.5 text-right text-gray-600">
                                                        {g.tacklePct.toFixed(1)}%
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Passes */}
                                <div className="border rounded-xl bg-white shadow-sm p-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs font-semibold text-gray-700">
                                            {useDaysRanking
                                                ? "PIORES 5 DIAS EM PASSES"
                                                : "PIORES 5 JOGOS EM PASSES"}
                                        </span>
                                        <span className={modeBadgeClass}>{modeLabel}</span>
                                    </div>
                                    <table className="w-full text-xs">
                                        <thead className="text-[11px] text-gray-500">
                                            <tr>
                                                <th className="text-left pb-1">Data/Hora</th>
                                                <th className="text-right pb-1">Passes C/T</th>
                                                <th className="text-right pb-1">% Passe</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {worstPassesList.map((g) => (
                                                <tr key={`wp-${g.id}`} className="hover:bg-gray-50">
                                                    <td className="py-0.5 pr-2">
                                                        {g.dateISO ? (
                                                            <>
                                                                <DateBadge dateISO={g.dateISO} colorMap={dateColorMap} />
                                                                {g.time && !useDaysRanking && (
                                                                    <span className="ml-1 text-[11px] text-gray-500">
                                                                        {g.time}
                                                                    </span>
                                                                )}
                                                            </>
                                                        ) : "—"}
                                                    </td>
                                                    <td className="py-0.5 text-right">
                                                        {g.passesMade} / {g.passesAttempted}
                                                    </td>
                                                    <td className="py-0.5 text-right text-gray-600">
                                                        {g.passPct.toFixed(1)}%
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </>
                    )}
                </section>
            )}

            {loading && <div>Carregando…</div>}
            {error && <div className="text-red-600">{error}</div>}
            {!loading && !error && !clubIds.length && (
                <div className="text-gray-600">Nenhum clube selecionado.</div>
            )}

            {/* Quando não tem jogador ou ele não jogou no período */}
            {!loading && !error && selectedPlayerId && perDayForPlayer.length === 0 && (
                <div className="text-gray-600">
                    {selectedPlayerName} não possui partidas no período selecionado.
                </div>
            )}

            {/* ===== VISÃO: TODOS OS DIAS (TABELA ÚNICA) ===== */}
            {!loading && !error && selectedPlayerId && selectedDayKey === "all" && perDayForPlayer.length > 0 && (
                <section className="flex flex-col gap-3">
                    <h2 className="text-lg font-semibold">
                        {selectedPlayerName} — resumo por dia
                    </h2>

                    <div className="overflow-x-auto rounded-lg border bg-white">
                        <table className="table-auto w-full text-sm">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-3 py-2 text-left">Data</th>
                                    <th className="px-3 py-2 text-center">Janela</th>
                                    <th className="px-3 py-2 text-right">Jogos</th>
                                    <th className="px-3 py-2 text-right">Gols</th>
                                    <th className="px-3 py-2 text-right">Assist.</th>
                                    <th className="px-3 py-2 text-right">Passes (C/T)</th>
                                    <th className="px-3 py-2 text-right">% Passes</th>
                                    <th className="px-3 py-2 text-right">Desarmes (C/T)</th>
                                    <th className="px-3 py-2 text-right">% Desarmes</th>
                                    <th className="px-3 py-2 text-right">Nota média</th>
                                </tr>
                            </thead>
                            <tbody>
                                {perDayForPlayer.map((d) => {
                                    const key = d.date.slice(0, 10);
                                    const hasWindow = d.firstMatchTime && d.lastMatchTime;
                                    const sameTime = d.firstMatchTime === d.lastMatchTime;

                                    return (
                                        <tr key={d.date} className="hover:bg-gray-50">
                                            <td className="px-3 py-2 text-left">
                                                <DateBadge dateISO={key} colorMap={dateColorMap} />
                                            </td>
                                            <td className="px-3 py-2 text-center">
                                                {hasWindow ? (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-800 border border-slate-300">
                                                        {sameTime
                                                            ? d.firstMatchTime
                                                            : `${d.firstMatchTime}–${d.lastMatchTime}`}
                                                    </span>
                                                ) : (
                                                    "—"
                                                )}
                                            </td>
                                            <td className="px-3 py-2 text-right">
                                                {d.matches}
                                            </td>
                                            <td className="px-3 py-2 text-right">
                                                {d.goals}
                                            </td>
                                            <td className="px-3 py-2 text-right">
                                                {d.assists}
                                            </td>
                                            <td className="px-3 py-2 text-right">
                                                {d.passesMade} / {d.passesAttempted}
                                            </td>
                                            <td className="px-3 py-2 text-right">
                                                {d.passPct.toFixed(1)}%
                                            </td>
                                            <td className="px-3 py-2 text-right">
                                                {d.tacklesMade} / {d.tacklesAttempted}
                                            </td>
                                            <td className="px-3 py-2 text-right">
                                                {d.tacklePct.toFixed(1)}%
                                            </td>
                                            <td className="px-3 py-2 text-right">
                                                {d.rating.toFixed(2)}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </section>
            )}

            {/* ===== VISÃO: DIA ESPECÍFICO (jogo a jogo em UMA tabela) ===== */}
            {!loading && !error && selectedPlayerId && selectedDayKey !== "all" && (
                <section className="rounded-xl border p-4 shadow-sm flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                        <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                                <h2 className="text-lg font-semibold">
                                    {selectedPlayerName} — jogos no dia{" "}
                                    <DateBadge dateISO={selectedDayKey} colorMap={dateColorMap} />
                                </h2>
                                <span className={modeBadgeClass}>{modeLabel}</span>
                            </div>
                            <p className="text-xs text-gray-500">
                                Cada linha da tabela representa um jogo disputado pelo jogador no dia selecionado.
                            </p>
                        </div>
                    </div>

                    {matchesLoading && <div>Carregando jogos do jogador…</div>}
                    {matchesError && <div className="text-red-600">{matchesError}</div>}

                    {/* Destaques do dia: melhor jogo */}
                    {!matchesLoading && !matchesError && gameHighlights.length > 0 && bestGameOfDay && (
                        <div className="rounded-lg border bg-white p-3 flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                                <span className="text-xs uppercase tracking-wide text-gray-500">
                                    Melhor jogo do dia (part. = gols + assistências)
                                </span>
                                {bestGameOfDay.time && (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-slate-100 border border-slate-300 text-slate-800">
                                        {bestGameOfDay.time}
                                    </span>
                                )}
                            </div>
                            <div className="flex flex-wrap gap-4 text-xs sm:text-sm text-gray-700 mt-1">
                                <span>
                                    G/A:{" "}
                                    <strong>{bestGameOfDay.goals}</strong> /{" "}
                                    <strong>{bestGameOfDay.assists}</strong>
                                </span>
                                <span>
                                    Participações:{" "}
                                    <strong>{bestGameOfDay.participations}</strong>
                                </span>
                                <span>
                                    Passes:{" "}
                                    <strong>{bestGameOfDay.passesMade}</strong> /{" "}
                                    {bestGameOfDay.passesAttempted} (
                                    {bestGameOfDay.passPct.toFixed(1)}%)
                                </span>
                                <span>
                                    Desarmes:{" "}
                                    <strong>{bestGameOfDay.tacklesMade}</strong> /{" "}
                                    {bestGameOfDay.tacklesAttempted} (
                                    {bestGameOfDay.tacklePct.toFixed(1)}%)
                                </span>
                                <span>
                                    Defesas:{" "}
                                    <strong>{bestGameOfDay.saves}</strong>
                                </span>
                                <span>
                                    Nota:{" "}
                                    <strong>{bestGameOfDay.rating.toFixed(2)}</strong>
                                </span>
                            </div>
                        </div>
                    )}

                    {!matchesLoading && !matchesError && matchesForSelectedDay.length === 0 && (
                        <div className="text-gray-600">
                            Nenhum jogo encontrado para este dia.
                        </div>
                    )}

                    {!matchesLoading && !matchesError && matchesForSelectedDay.length > 0 && (
                        <PlayerSingleStatsTable
                            players={matchesForSelectedDay}
                            loading={matchesLoading}
                            error={matchesError}
                            compactMode
                        />
                    )}
                </section>
            )}
        </div>
    );
}
