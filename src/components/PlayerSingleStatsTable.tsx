// src/components/PlayerSingleStatsTable.tsx
import type { PlayerStats } from "../types/stats.ts";
import { RatingPill } from "./ui.tsx";
import { fmtHM } from "../utils/date.ts";
import { useNumberFormats } from "../hooks/useNumberFormats.ts";
import { pct } from "../utils/number.ts";

interface PlayerSingleStatsTableProps {
    players: PlayerStats[];
    loading: boolean;
    error: string | null;
    clubStats?: unknown;
    compactMode?: boolean;
}

function getMatchDate(player: any): Date | null {
    const raw = player?.date ?? player?.Date;
    if (!raw) return null;
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return null;
    return d;
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
        return <div className="text-negative">{error}</div>;
    }

    if (!rows.length) {
        return <div className="text-fg-muted">Nenhum jogo encontrado para este dia.</div>;
    }

    // Ordenar sempre por horário do jogo
    const orderedRows = [...rows].sort((a: any, b: any) => {
        const da = getMatchDate(a)?.getTime() ?? 0;
        const db = getMatchDate(b)?.getTime() ?? 0;
        return da - db;
    });

    return (
        <div className="scroll-touch-x overflow-x-auto rounded-lg border bg-surface">
            <table className="table-auto w-full text-xs xl:text-sm">
                <thead className="bg-surface-raised">
                    <tr>
                        <th scope="col" className="px-1.5 py-1.5 xl:px-2 text-left">Horário</th>
                        <th scope="col" className="px-1.5 py-1.5 xl:px-2 text-right">Partic.</th>
                        <th scope="col" className="px-1.5 py-1.5 xl:px-2 text-right">Gols</th>
                        <th scope="col" className="px-1.5 py-1.5 xl:px-2 text-right">Assist.</th>
                        <th scope="col" className="px-1.5 py-1.5 xl:px-2 text-right">Pré-Assist.</th>
                        <th scope="col" className="px-1.5 py-1.5 xl:px-2 text-right">Chutes</th>
                        <th scope="col" className="px-1.5 py-1.5 xl:px-2 text-right">Passes (C/T)</th>
                        <th scope="col" className="px-1.5 py-1.5 xl:px-2 text-right">% Passes</th>
                        <th scope="col" className="px-1.5 py-1.5 xl:px-2 text-right">Desarmes (C/T)</th>
                        <th scope="col" className="px-1.5 py-1.5 xl:px-2 text-right">% Desarmes</th>
                        <th scope="col" className="px-1.5 py-1.5 xl:px-2 text-right">Defesas</th>
                        <th scope="col" className="px-1.5 py-1.5 xl:px-2 text-right">Nota</th>
                        <th scope="col" className="px-1.5 py-1.5 xl:px-2 text-right">Min.</th>
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
                            <tr key={String(rowKey)} className="hover:bg-surface-raised">
                                <td className="px-1.5 py-1.5 xl:px-2 text-left">
                                    {d ? (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium tabular-nums bg-surface-sunken text-fg-secondary border border-border">
                                            {timeLabel}
                                        </span>
                                    ) : (
                                        "—"
                                    )}
                                </td>
                                <td className="px-1.5 py-1.5 xl:px-2 text-right font-medium tabular-nums">{int.format(participations)}</td>
                                <td className="px-1.5 py-1.5 xl:px-2 text-right tabular-nums">{int.format(goals)}</td>
                                <td className="px-1.5 py-1.5 xl:px-2 text-right tabular-nums">{int.format(assists)}</td>
                                <td className="px-1.5 py-1.5 xl:px-2 text-right tabular-nums">{int.format(preAssists)}</td>
                                <td className="px-1.5 py-1.5 xl:px-2 text-right tabular-nums">{int.format(shots)}</td>
                                <td className="px-1.5 py-1.5 xl:px-2 text-right tabular-nums">
                                    {int.format(passesMade)} / {int.format(passesAttempted)}
                                </td>
                                <td className="px-1.5 py-1.5 xl:px-2 text-right tabular-nums">
                                    {p1.format(passPct)}%
                                </td>
                                <td className="px-1.5 py-1.5 xl:px-2 text-right tabular-nums">
                                    {int.format(tacklesMade)} / {int.format(tacklesAttempted)}
                                </td>
                                <td className="px-1.5 py-1.5 xl:px-2 text-right tabular-nums">
                                    {p1.format(tacklePct)}%
                                </td>
                                <td className="px-1.5 py-1.5 xl:px-2 text-right tabular-nums">
                                    {int.format(saves)}
                                </td>
                                <td className="px-1.5 py-1.5 xl:px-2 text-right">
                                    {rating > 0 ? (
                                        <RatingPill value={rating} size="sm" />
                                    ) : (
                                        <span className="text-fg-subtle">{p2.format(rating)}</span>
                                    )}
                                </td>
                                <td className="px-1.5 py-1.5 xl:px-2 text-right tabular-nums">
                                    {(() => {
                                        const secondsPlayed = Number(p.totalSecondsPlayed ?? 0);
                                        return `${Math.floor(secondsPlayed / 60)}:${String(secondsPlayed % 60).padStart(2, "0")}`;
                                    })()}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
