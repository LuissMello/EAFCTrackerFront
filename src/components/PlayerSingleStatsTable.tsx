// src/components/PlayerSingleStatsTable.tsx
import React, { useMemo } from "react";
import type { PlayerStats } from "../types/stats.ts";

interface PlayerSingleStatsTableProps {
    players: PlayerStats[];
    loading: boolean;
    error: string | null;
    clubStats?: unknown;
    compactMode?: boolean;
}

function useNumberFormats() {
    const int = useMemo(() => new Intl.NumberFormat("pt-BR"), []);
    const p1 = useMemo(
        () => new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }),
        []
    );
    const p2 = useMemo(
        () => new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        []
    );
    return { int, p1, p2 };
}

const pct = (num: number, den: number) => (den > 0 ? (num / den) * 100 : 0);

function getMatchDate(player: any): Date | null {
    const raw = player?.date ?? player?.Date;
    if (!raw) return null;
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return null;
    return d;
}

function fmtHM(d: Date) {
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
}

export function PlayerSingleStatsTable({
    players,
    loading,
    error,
}: PlayerSingleStatsTableProps) {
    const { int, p1, p2 } = useNumberFormats();
    const rows = players ?? [];

    if (loading) {
        return <div>Carregando jogos do jogador…</div>;
    }

    if (error) {
        return <div className="text-red-600">{error}</div>;
    }

    if (!rows.length) {
        return <div className="text-gray-600">Nenhum jogo encontrado para este dia.</div>;
    }

    // Ordenar sempre por horário do jogo
    const orderedRows = [...rows].sort((a: any, b: any) => {
        const da = getMatchDate(a)?.getTime() ?? 0;
        const db = getMatchDate(b)?.getTime() ?? 0;
        return da - db;
    });

    return (
        <div className="overflow-x-auto rounded-lg border bg-white">
            <table className="table-auto w-full text-sm">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="px-3 py-2 text-left">Horário</th>
                        <th className="px-3 py-2 text-right">Partic.</th>
                        <th className="px-3 py-2 text-right">Gols</th>
                        <th className="px-3 py-2 text-right">Assist.</th>
                        <th className="px-3 py-2 text-right">Pré-Assist.</th>
                        <th className="px-3 py-2 text-right">Chutes</th>
                        <th className="px-3 py-2 text-right">Passes (C/T)</th>
                        <th className="px-3 py-2 text-right">% Passes</th>
                        <th className="px-3 py-2 text-right">Desarmes (C/T)</th>
                        <th className="px-3 py-2 text-right">% Desarmes</th>
                        <th className="px-3 py-2 text-right">Defesas</th>
                        <th className="px-3 py-2 text-right">Nota</th>
                    </tr>
                </thead>
                <tbody>
                    {orderedRows.map((p: any, idx: number) => {
                        const d = getMatchDate(p);
                        const timeLabel = d ? fmtHM(d) : "—";

                        const goals = Number(p.totalGoals ?? p.TotalGoals ?? 0);
                        const assists = Number(p.totalAssists ?? p.TotalAssists ?? 0);
                        const preAssists = Number(p.totalPreAssists ?? p.TotalPreAssists ?? 0);
                        const participations = goals + assists + preAssists;
                        const shots = Number(p.totalShots ?? p.TotalShots ?? 0);
                        const passesMade = Number(p.totalPassesMade ?? p.TotalPassesMade ?? 0);
                        const passesAttempted = Number(p.totalPassAttempts ?? p.TotalPassAttempts ?? 0);
                        const passPct = Number(
                            p.passAccuracyPercent ??
                            p.PassAccuracyPercent ??
                            pct(passesMade, passesAttempted)
                        );
                        const tacklesMade = Number(p.totalTacklesMade ?? p.TotalTacklesMade ?? 0);
                        const tacklesAttempted = Number(p.totalTackleAttempts ?? p.TotalTackleAttempts ?? 0);
                        const tacklePct = Number(
                            p.tackleSuccessPercent ??
                            p.TackleSuccessPercent ??
                            pct(tacklesMade, tacklesAttempted)
                        );
                        const saves = Number(p.totalSaves ?? p.TotalSaves ?? 0);
                        const rating = Number(p.avgRating ?? p.AvgRating ?? 0);

                        const rowKey =
                            p.date ??
                            p.Date ??
                            `${p.playerId ?? p.PlayerId ?? "player"}-${idx}`;

                        return (
                            <tr key={String(rowKey)} className="hover:bg-gray-50">
                                <td className="px-3 py-2 text-left">
                                    {d ? (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800 border border-slate-300">
                                            {timeLabel}
                                        </span>
                                    ) : (
                                        "—"
                                    )}
                                </td>
                                <td className="px-3 py-2 text-right font-medium">{int.format(participations)}</td>
                                <td className="px-3 py-2 text-right">{int.format(goals)}</td>
                                <td className="px-3 py-2 text-right">{int.format(assists)}</td>
                                <td className="px-3 py-2 text-right">{int.format(preAssists)}</td>
                                <td className="px-3 py-2 text-right">{int.format(shots)}</td>
                                <td className="px-3 py-2 text-right">
                                    {int.format(passesMade)} / {int.format(passesAttempted)}
                                </td>
                                <td className="px-3 py-2 text-right">
                                    {p1.format(passPct)}%
                                </td>
                                <td className="px-3 py-2 text-right">
                                    {int.format(tacklesMade)} / {int.format(tacklesAttempted)}
                                </td>
                                <td className="px-3 py-2 text-right">
                                    {p1.format(tacklePct)}%
                                </td>
                                <td className="px-3 py-2 text-right">
                                    {int.format(saves)}
                                </td>
                                <td className="px-3 py-2 text-right">
                                    {p2.format(rating)}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
