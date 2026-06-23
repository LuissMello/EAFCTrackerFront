import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api.ts";
import { API_ENDPOINTS } from "../config/urls.ts";
import { useClub } from "../hooks/useClub.tsx";
import { Card, SectionHeader, RatingPill } from "../components/ui.tsx";

interface RecordMatchDto {
    matchId: number;
    timestamp: string;
    goalsFor: number;
    goalsAgainst: number;
    opponentName: string | null;
}

interface RecordPlayerMatchDto {
    matchId: number;
    timestamp: string;
    playerName: string;
    value: number;
}

interface HatTrickDto {
    matchId: number;
    timestamp: string;
    playerName: string;
    goals: number;
}

interface ClubRecordsDto {
    totalMatches: number;
    totalWins: number;
    totalDraws: number;
    totalLosses: number;
    totalGoalsFor: number;
    totalGoalsAgainst: number;
    biggestWin: RecordMatchDto | null;
    biggestLoss: RecordMatchDto | null;
    highestScoringMatch: RecordMatchDto | null;
    longestWinStreak: number;
    longestUnbeatenStreak: number;
    longestCleanSheetStreak: number;
    longestScoringStreak: number;
    currentWinStreak: number;
    currentUnbeatenStreak: number;
    mostGoalsInMatch: RecordPlayerMatchDto | null;
    mostAssistsInMatch: RecordPlayerMatchDto | null;
    mostSavesInMatch: RecordPlayerMatchDto | null;
    highestRating: RecordPlayerMatchDto | null;
    mostRedCardsCareer: RecordPlayerMatchDto | null;
    mostMoMCareer: RecordPlayerMatchDto | null;
    hatTricks: HatTrickDto[];
}

function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

const KpiCard: React.FC<{ label: string; value: number | string; sub?: string }> = ({ label, value, sub }) => (
    <Card className="p-4 flex flex-col gap-1">
        <div className="text-2xl font-display font-black tabular-nums text-fg">{value}</div>
        <div className="text-xs font-medium text-fg-muted">{label}</div>
        {sub && <div className="text-[11px] text-fg-subtle">{sub}</div>}
    </Card>
);

const StreakCard: React.FC<{ label: string; value: number; highlight?: boolean }> = ({ label, value, highlight }) => (
    <Card className={`p-4 flex flex-col gap-1 ${highlight ? "border-gold/40 bg-gold-soft" : ""}`}>
        <div className={`text-2xl font-display font-black tabular-nums ${highlight ? "text-gold-fg" : "text-fg"}`}>{value}</div>
        <div className={`text-xs font-medium ${highlight ? "text-gold-fg/80" : "text-fg-muted"}`}>{label}</div>
    </Card>
);

const MatchRecordCard: React.FC<{ title: string; match: RecordMatchDto | null }> = ({ title, match }) => (
    <Card className="overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-surface-raised">
            <span className="font-semibold text-fg text-sm">{title}</span>
        </div>
        <div className="px-4 py-4">
            {match ? (
                <div className="flex flex-col gap-1">
                    <Link to={`/match/${match.matchId}`} className="text-xl font-display font-black text-fg hover:text-accent transition-colors">
                        {match.goalsFor} — {match.goalsAgainst}
                    </Link>
                    <div className="text-sm text-fg-muted">vs {match.opponentName ?? "Adversário"}</div>
                    <div className="text-xs text-fg-subtle">{fmtDate(match.timestamp)}</div>
                </div>
            ) : (
                <div className="text-sm text-fg-subtle">Sem dados</div>
            )}
        </div>
    </Card>
);

const PlayerRecordCard: React.FC<{ title: string; record: RecordPlayerMatchDto | null; unit?: string; rating?: boolean }> = ({ title, record, unit, rating }) => (
    <Card className="overflow-hidden flex-1 min-w-0">
        <div className="px-4 py-3 border-b border-border bg-surface-raised">
            <span className="font-semibold text-fg text-sm">{title}</span>
        </div>
        <div className="px-4 py-4">
            {record ? (
                <div className="flex flex-col gap-1">
                    {rating ? (
                        <RatingPill value={record.value} size="lg" className="self-start" />
                    ) : (
                        <div className="text-2xl font-display font-black text-fg">{record.value}{unit ? ` ${unit}` : ""}</div>
                    )}
                    <div className="text-sm font-semibold text-fg-secondary">{record.playerName}</div>
                    <Link to={`/match/${record.matchId}`} className="text-xs text-fg-subtle hover:text-accent underline underline-offset-2">
                        {fmtDate(record.timestamp)}
                    </Link>
                </div>
            ) : (
                <div className="text-sm text-fg-subtle">Sem dados</div>
            )}
        </div>
    </Card>
);

const SkeletonBlock: React.FC<{ h?: string }> = ({ h = "h-20" }) => (
    <div className={`rounded-xl border bg-surface-sunken animate-pulse ${h}`} />
);

export default function Records() {
    const { club, selectedClubIds } = useClub();

    const activeClubIds = useMemo(() => {
        return selectedClubIds.length > 0 ? selectedClubIds : (club?.clubId ? [club.clubId] : []);
    }, [selectedClubIds, club]);

    const [data, setData] = useState<ClubRecordsDto | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        if (activeClubIds.length === 0) return;
        setLoading(true);
        setError(null);
        try {
            const clubIdsStr = activeClubIds.join(",");
            const { data: resp } = await api.get<ClubRecordsDto>(API_ENDPOINTS.CLUB_RECORDS(clubIdsStr));
            setData(resp);
        } catch (e: any) {
            setError(e?.message ?? "Erro ao carregar recordes");
        } finally {
            setLoading(false);
        }
    }, [activeClubIds]);

    useEffect(() => { load(); }, [load]);

    if (activeClubIds.length === 0) {
        return (
            <div className="p-6 max-w-5xl mx-auto">
                <Card className="p-10 text-center text-fg-muted">
                    <div className="text-4xl mb-3">🏆</div>
                    <div className="font-semibold">Nenhum clube selecionado</div>
                    <div className="text-sm mt-1">Selecione um clube no menu superior para ver os recordes.</div>
                </Card>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
            <SectionHeader eyebrow="Clube" title="Recordes & Curiosidades" />

            {error && (
                <div className="bg-negative-soft border border-negative/30 rounded-xl p-4 text-sm text-negative-fg">{error}</div>
            )}

            {loading && (
                <div className="space-y-6">
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                        {Array.from({ length: 6 }).map((_, i) => <SkeletonBlock key={i} h="h-20" />)}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {Array.from({ length: 3 }).map((_, i) => <SkeletonBlock key={i} h="h-32" />)}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {Array.from({ length: 6 }).map((_, i) => <SkeletonBlock key={i} h="h-20" />)}
                    </div>
                </div>
            )}

            {!loading && data && (
                <>
                    <div>
                        <h2 className="text-sm font-semibold text-fg-muted uppercase tracking-wide mb-3">Totais Gerais</h2>
                        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                            <KpiCard label="Partidas" value={data.totalMatches} />
                            <KpiCard label="Vitórias" value={data.totalWins} />
                            <KpiCard label="Empates" value={data.totalDraws} />
                            <KpiCard label="Derrotas" value={data.totalLosses} />
                            <KpiCard label="Gols Feitos" value={data.totalGoalsFor} />
                            <KpiCard label="Gols Sofridos" value={data.totalGoalsAgainst} />
                        </div>
                    </div>

                    <div>
                        <h2 className="text-sm font-semibold text-fg-muted uppercase tracking-wide mb-3">Recordes de Partidas</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <MatchRecordCard title="Maior Goleada" match={data.biggestWin} />
                            <MatchRecordCard title="Maior Derrota" match={data.biggestLoss} />
                            <MatchRecordCard title="Partida Mais Goleada" match={data.highestScoringMatch} />
                        </div>
                    </div>

                    <div>
                        <h2 className="text-sm font-semibold text-fg-muted uppercase tracking-wide mb-3">Sequências</h2>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            <StreakCard label="Maior Sequência de Vitórias" value={data.longestWinStreak} />
                            <StreakCard label="Maior Sequência Invicta" value={data.longestUnbeatenStreak} />
                            <StreakCard label="Maior Sequência Sem Sofrer" value={data.longestCleanSheetStreak} />
                            <StreakCard label="Maior Sequência Marcando" value={data.longestScoringStreak} />
                            <StreakCard label="Sequência Atual de Vitórias" value={data.currentWinStreak} highlight />
                            <StreakCard label="Invicto Atual" value={data.currentUnbeatenStreak} highlight />
                        </div>
                    </div>

                    <div>
                        <h2 className="text-sm font-semibold text-fg-muted uppercase tracking-wide mb-3">Recordes Individuais por Partida</h2>
                        <div className="flex flex-col sm:flex-row gap-3">
                            <PlayerRecordCard title="Mais Gols numa Partida" record={data.mostGoalsInMatch} />
                            <PlayerRecordCard title="Mais Assistências numa Partida" record={data.mostAssistsInMatch} />
                            <PlayerRecordCard title="Maior Nota" record={data.highestRating} rating />
                            <PlayerRecordCard title="Mais Defesas (GK)" record={data.mostSavesInMatch} />
                        </div>
                    </div>

                    <div>
                        <h2 className="text-sm font-semibold text-fg-muted uppercase tracking-wide mb-3">Recordes de Carreira</h2>
                        <div className="flex flex-col sm:flex-row gap-3">
                            <PlayerRecordCard title="Mais Cartões Vermelhos (Carreira)" record={data.mostRedCardsCareer} />
                            <PlayerRecordCard title="Mais MoM (Carreira)" record={data.mostMoMCareer} />
                        </div>
                    </div>

                    <Card className="overflow-hidden">
                        <div className="px-4 py-3 border-b border-border bg-surface-raised flex items-center justify-between">
                            <span className="font-semibold text-gold-fg">⚽ Hat-tricks</span>
                            {data.hatTricks.length > 0 && (
                                <span className="text-xs bg-gold-soft text-gold-fg px-2 py-0.5 rounded-full">{data.hatTricks.length}</span>
                            )}
                        </div>
                        {data.hatTricks.length === 0 ? (
                            <div className="px-4 py-10 text-center text-sm text-fg-subtle">
                                Nenhum hat-trick registrado ainda.
                            </div>
                        ) : (
                            <div className="divide-y divide-border">
                                {data.hatTricks.map((ht, i) => (
                                    <div key={i} className="px-4 py-3 hover:bg-surface-raised flex items-center gap-3 transition-colors">
                                        <Link
                                            to={`/match/${ht.matchId}`}
                                            className="text-xs text-fg-subtle hover:text-fg-secondary underline underline-offset-2 whitespace-nowrap"
                                        >
                                            {fmtDate(ht.timestamp)}
                                        </Link>
                                        <span className="font-semibold text-fg flex-1">{ht.playerName}</span>
                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-gold-soft text-gold-fg border border-gold/30">
                                            {ht.goals} gols
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </Card>
                </>
            )}

            {!loading && !data && !error && activeClubIds.length > 0 && (
                <Card className="p-10 text-center text-fg-muted">
                    <div className="font-semibold">Sem dados para exibir</div>
                </Card>
            )}
        </div>
    );
}
