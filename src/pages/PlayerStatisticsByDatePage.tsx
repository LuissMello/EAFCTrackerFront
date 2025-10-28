// src/pages/PlayerStatisticsByDatePage.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../services/api.ts";
import { PlayerStatsTable } from "../components/PlayerStatsTable.tsx";
import type { PlayerStats } from "../types/stats";

type FullMatchStatisticsDto = {
    overall?: {
        totalMatches?: number;
        totalWins?: number;
        totalDraws?: number;
        totalLosses?: number;
    };
    players?: PlayerStats[];
    clubs?: Array<{
        clubId?: number; ClubId?: number;
        goalsFor?: number; GoalsFor?: number;
        goalsAgainst?: number; GoalsAgainst?: number;
    }>;
};

type FullMatchStatisticsByDayDto = {
    date: string;
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

function fmtYYYYMMDD(d: Date) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const da = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${da}`;
}

export default function PlayerStatisticsByDatePage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [days, setDays] = useState<DayBlock[]>([]);

    // clubes selecionados no picker (?clubIds=355651,352016,...)
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
        searchParams.set("dateFrom", start);
        searchParams.set("dateTo", end);
        setSearchParams(searchParams);
    };

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

                // ✅ NOVO: rota sem clubId fixo
                const params: Record<string, string> = {
                    clubIds: clubIds.join(","), // todos os selecionados
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

                        // soma GF/GA de todos os clubes no dia
                        const gf = clubsArr.reduce(
                            (acc, c: any) => acc + Number(c?.goalsFor ?? c?.GoalsFor ?? 0),
                            0
                        );
                        const ga = clubsArr.reduce(
                            (acc, c: any) => acc + Number(c?.goalsAgainst ?? c?.GoalsAgainst ?? 0),
                            0
                        );

                        return {
                            date: typeof row.date === "string" ? row.date : String(row.date),
                            matchesCount: Number(ov.totalMatches ?? 0),
                            wins: Number(ov.totalWins ?? 0),
                            draws: Number(ov.totalDraws ?? 0),
                            losses: Number(ov.totalLosses ?? 0),
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

    return (
        <div className="p-4 flex flex-col gap-4">
            <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <h1 className="text-xl font-semibold">Estatísticas por Data (Agrupadas)</h1>
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
            </header>

            {loading && <div>Carregando…</div>}
            {error && <div className="text-red-600">{error}</div>}
            {!loading && !error && !clubIds.length && (
                <div className="text-gray-600">Nenhum clube selecionado.</div>
            )}

            {!loading && !error && clubIds.length > 0 && (
                <div className="flex flex-col gap-6">
                    {days.length === 0 && (
                        <div className="text-gray-500">
                            Nenhum jogo no período selecionado.
                        </div>
                    )}
                    {days.map((d) => (
                        <section key={d.date} className="rounded-xl border p-3 shadow-sm">
                            <div className="flex items-center justify-between mb-2">
                                <div className="font-medium">{d.date}</div>
                                <div className="text-sm text-gray-700">
                                    Jogos: <strong>{d.matchesCount}</strong> • {d.wins}V {d.draws}E {d.losses}D • Gols: {d.goalsFor}-{d.goalsAgainst}
                                </div>
                            </div>
                            <PlayerStatsTable players={d.players} />
                        </section>
                    ))}
                </div>
            )}
        </div>
    );
}
