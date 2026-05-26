import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api.ts";
import { API_ENDPOINTS } from "../config/urls.ts";
import { useClub } from "../hooks/useClub.tsx";

interface OpponentRecordDto {
    name: string;
    clubId: number;
    matches: number;
    wins: number;
    draws: number;
    losses: number;
    winRate: number;
    goalsFor: number;
    goalsAgainst: number;
    goalDiff: number;
    biggestWinMatchId: number | null;
    biggestWinGF: number;
    biggestWinGA: number;
    biggestLossMatchId: number | null;
    biggestLossGF: number;
    biggestLossGA: number;
    lastMatch: string | null;
}

interface OpponentsAnalysisDto {
    totalMatches: number;
    totalOpponents: number;
    opponents: OpponentRecordDto[];
}

type SortKey = "matches" | "wins" | "draws" | "losses" | "winRate" | "goalsFor" | "goalsAgainst" | "goalDiff";

function fmtDate(iso: string | null) {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

const KpiCard: React.FC<{ label: string; value: number | string; sub?: string }> = ({ label, value, sub }) => (
    <div className="rounded-xl border bg-white p-4 flex flex-col gap-1 shadow-sm">
        <div className="text-2xl font-black tabular-nums text-gray-900">{value}</div>
        <div className="text-xs font-medium text-gray-500">{label}</div>
        {sub && <div className="text-[11px] text-gray-400">{sub}</div>}
    </div>
);

const SkeletonBlock: React.FC<{ h?: string }> = ({ h = "h-20" }) => (
    <div className={`rounded-xl border bg-gray-100 animate-pulse ${h}`} />
);

function SortTh({
    col, label, sortKey, dir, onChange
}: {
    col: SortKey;
    label: string;
    sortKey: SortKey;
    dir: "asc" | "desc";
    onChange: (k: SortKey) => void;
}) {
    const active = col === sortKey;
    return (
        <th
            className="text-center px-3 py-2.5 font-medium cursor-pointer select-none hover:bg-gray-100 transition-colors whitespace-nowrap"
            onClick={() => onChange(col)}
        >
            {label}{active ? (dir === "desc" ? " ↓" : " ↑") : ""}
        </th>
    );
}

export default function Opponents() {
    const { club, selectedClubIds } = useClub();

    const activeClubIds = useMemo(() => {
        return selectedClubIds.length > 0 ? selectedClubIds : (club?.clubId ? [club.clubId] : []);
    }, [selectedClubIds, club]);

    const [data, setData] = useState<OpponentsAnalysisDto | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [sortKey, setSortKey] = useState<SortKey>("matches");
    const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

    const load = useCallback(async () => {
        if (activeClubIds.length === 0) return;
        setLoading(true);
        setError(null);
        try {
            const clubIdsStr = activeClubIds.join(",");
            const { data: resp } = await api.get<OpponentsAnalysisDto>(API_ENDPOINTS.CLUB_OPPONENTS(clubIdsStr));
            setData(resp);
        } catch (e: any) {
            setError(e?.message ?? "Erro ao carregar adversários");
        } finally {
            setLoading(false);
        }
    }, [activeClubIds]);

    useEffect(() => { load(); }, [load]);

    const handleSort = (key: SortKey) => {
        if (key === sortKey) {
            setSortDir(d => d === "desc" ? "asc" : "desc");
        } else {
            setSortKey(key);
            setSortDir("desc");
        }
    };

    const sorted = useMemo(() => {
        if (!data) return [];
        return [...data.opponents].sort((a, b) => {
            const av = a[sortKey];
            const bv = b[sortKey];
            if (typeof av === "number" && typeof bv === "number") {
                return sortDir === "desc" ? bv - av : av - bv;
            }
            return 0;
        });
    }, [data, sortKey, sortDir]);

    const bestWinRate = useMemo(() => {
        if (!data || data.opponents.length === 0) return null;
        return [...data.opponents].filter(o => o.matches >= 2).sort((a, b) => b.winRate - a.winRate)[0] ?? null;
    }, [data]);

    const worstWinRate = useMemo(() => {
        if (!data || data.opponents.length === 0) return null;
        return [...data.opponents].filter(o => o.matches >= 2).sort((a, b) => a.winRate - b.winRate)[0] ?? null;
    }, [data]);

    const neverWon = useMemo(() => data?.opponents.filter(o => o.wins === 0 && o.matches > 0) ?? [], [data]);
    const neverLost = useMemo(() => data?.opponents.filter(o => o.losses === 0 && o.matches > 0) ?? [], [data]);
    const rival = useMemo(() => sorted[0] ?? null, [sorted]);
    const favVictim = useMemo(() => {
        if (!data) return null;
        return [...data.opponents].filter(o => o.matches >= 2).sort((a, b) => b.wins - a.wins)[0] ?? null;
    }, [data]);
    const nightmare = useMemo(() => {
        if (!data) return null;
        return [...data.opponents].filter(o => o.matches >= 2).sort((a, b) => b.losses - a.losses)[0] ?? null;
    }, [data]);

    const top5Wins = useMemo(() => {
        if (!data) return [];
        return [...data.opponents]
            .filter(o => o.biggestWinMatchId != null)
            .sort((a, b) => (b.biggestWinGF - b.biggestWinGA) - (a.biggestWinGF - a.biggestWinGA))
            .slice(0, 5);
    }, [data]);

    const top5Losses = useMemo(() => {
        if (!data) return [];
        return [...data.opponents]
            .filter(o => o.biggestLossMatchId != null)
            .sort((a, b) => (b.biggestLossGA - b.biggestLossGF) - (a.biggestLossGA - a.biggestLossGF))
            .slice(0, 5);
    }, [data]);

    if (activeClubIds.length === 0) {
        return (
            <div className="p-6 max-w-5xl mx-auto">
                <div className="bg-white rounded-xl border shadow-sm p-10 text-center text-gray-500">
                    <div className="text-4xl mb-3">🎯</div>
                    <div className="font-semibold">Nenhum clube selecionado</div>
                    <div className="text-sm mt-1">Selecione um clube no menu superior para ver a análise de adversários.</div>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
            <div>
                <h1 className="text-xl font-black text-gray-900 tracking-tight">Análise de Adversários</h1>
                <p className="text-sm text-gray-500 mt-0.5">Histórico e estatísticas contra cada adversário enfrentado</p>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-800">{error}</div>
            )}

            {loading && (
                <div className="space-y-6">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {Array.from({ length: 4 }).map((_, i) => <SkeletonBlock key={i} h="h-20" />)}
                    </div>
                    <SkeletonBlock h="h-80" />
                </div>
            )}

            {!loading && data && (
                <>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <KpiCard label="Total de Partidas" value={data.totalMatches} />
                        <KpiCard label="Adversários Únicos" value={data.totalOpponents} />
                        {bestWinRate && (
                            <KpiCard
                                label="Maior Win Rate (vs)"
                                value={`${bestWinRate.winRate}%`}
                                sub={bestWinRate.name}
                            />
                        )}
                        {worstWinRate && (
                            <KpiCard
                                label="Menor Win Rate (vs)"
                                value={`${worstWinRate.winRate}%`}
                                sub={worstWinRate.name}
                            />
                        )}
                    </div>

                    {(neverWon.length > 0 || neverLost.length > 0 || rival || favVictim || nightmare) && (
                        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                            <div className="px-4 py-3 border-b bg-gray-50">
                                <span className="font-semibold text-gray-800 text-sm">Curiosidades</span>
                            </div>
                            <div className="px-4 py-4 flex flex-wrap gap-2">
                                {rival && (
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-300">
                                        Rival: {rival.name} ({rival.matches}×)
                                    </span>
                                )}
                                {favVictim && favVictim.wins > 0 && (
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-green-100 text-green-800 border border-green-300">
                                        Vítima Favorita: {favVictim.name} ({favVictim.wins}V)
                                    </span>
                                )}
                                {nightmare && nightmare.losses > 0 && (
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-300">
                                        Pesadelo: {nightmare.name} ({nightmare.losses}D)
                                    </span>
                                )}
                                {neverLost.map(o => (
                                    <span key={o.clubId} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                        Nunca perdeu: {o.name}
                                    </span>
                                ))}
                                {neverWon.map(o => (
                                    <span key={o.clubId} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-800 border border-orange-300">
                                        Nunca venceu: {o.name}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                        <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
                            <span className="font-semibold text-gray-800 text-sm">Todos os Adversários</span>
                            <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">{data.opponents.length}</span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b bg-gray-50/50 text-gray-500 text-xs uppercase tracking-wide">
                                        <th className="text-left px-4 py-2.5 font-medium">Adversário</th>
                                        <SortTh col="matches" label="Partidas" sortKey={sortKey} dir={sortDir} onChange={handleSort} />
                                        <SortTh col="wins" label="V" sortKey={sortKey} dir={sortDir} onChange={handleSort} />
                                        <SortTh col="draws" label="E" sortKey={sortKey} dir={sortDir} onChange={handleSort} />
                                        <SortTh col="losses" label="D" sortKey={sortKey} dir={sortDir} onChange={handleSort} />
                                        <SortTh col="winRate" label="Win%" sortKey={sortKey} dir={sortDir} onChange={handleSort} />
                                        <SortTh col="goalsFor" label="GF" sortKey={sortKey} dir={sortDir} onChange={handleSort} />
                                        <SortTh col="goalsAgainst" label="GS" sortKey={sortKey} dir={sortDir} onChange={handleSort} />
                                        <SortTh col="goalDiff" label="Saldo" sortKey={sortKey} dir={sortDir} onChange={handleSort} />
                                        <th className="text-center px-3 py-2.5 font-medium whitespace-nowrap">Último</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sorted.map((opp) => (
                                        <tr key={opp.clubId} className="border-b last:border-0 hover:bg-gray-50 transition-colors">
                                            <td className="px-4 py-3 font-medium text-gray-800">{opp.name}</td>
                                            <td className="px-3 py-3 text-center text-gray-700">{opp.matches}</td>
                                            <td className="px-3 py-3 text-center font-semibold text-green-700">{opp.wins}</td>
                                            <td className="px-3 py-3 text-center text-gray-500">{opp.draws}</td>
                                            <td className="px-3 py-3 text-center font-semibold text-red-600">{opp.losses}</td>
                                            <td className="px-3 py-3 text-center">
                                                <span className={`text-xs font-bold ${opp.winRate >= 60 ? "text-green-700" : opp.winRate >= 40 ? "text-gray-700" : "text-red-600"}`}>
                                                    {opp.winRate}%
                                                </span>
                                            </td>
                                            <td className="px-3 py-3 text-center text-gray-700">{opp.goalsFor}</td>
                                            <td className="px-3 py-3 text-center text-gray-700">{opp.goalsAgainst}</td>
                                            <td className="px-3 py-3 text-center">
                                                <span className={`text-sm font-bold ${opp.goalDiff > 0 ? "text-green-700" : opp.goalDiff < 0 ? "text-red-600" : "text-gray-500"}`}>
                                                    {opp.goalDiff > 0 ? "+" : ""}{opp.goalDiff}
                                                </span>
                                            </td>
                                            <td className="px-3 py-3 text-center text-xs text-gray-400 whitespace-nowrap">{fmtDate(opp.lastMatch)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                            <div className="px-4 py-3 border-b bg-gray-50">
                                <span className="font-semibold text-gray-800 text-sm">Top 5 Maiores Goleadas</span>
                            </div>
                            {top5Wins.length === 0 ? (
                                <div className="px-4 py-8 text-sm text-gray-400 text-center">Sem dados</div>
                            ) : (
                                <div className="divide-y">
                                    {top5Wins.map((opp, i) => (
                                        <div key={opp.clubId} className="px-4 py-3 hover:bg-gray-50 flex items-center gap-3 transition-colors">
                                            <span className="text-xs text-gray-400 w-4 text-right">{i + 1}</span>
                                            <span className="flex-1 text-gray-700 text-sm truncate">{opp.name}</span>
                                            <span className="font-bold text-green-700 text-sm whitespace-nowrap">
                                                {opp.biggestWinGF} — {opp.biggestWinGA}
                                            </span>
                                            {opp.biggestWinMatchId && (
                                                <Link
                                                    to={`/match/${opp.biggestWinMatchId}`}
                                                    className="text-xs text-gray-400 hover:text-blue-600 underline underline-offset-2"
                                                >
                                                    Ver
                                                </Link>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                            <div className="px-4 py-3 border-b bg-gray-50">
                                <span className="font-semibold text-gray-800 text-sm">Top 5 Maiores Derrotas</span>
                            </div>
                            {top5Losses.length === 0 ? (
                                <div className="px-4 py-8 text-sm text-gray-400 text-center">Sem dados</div>
                            ) : (
                                <div className="divide-y">
                                    {top5Losses.map((opp, i) => (
                                        <div key={opp.clubId} className="px-4 py-3 hover:bg-gray-50 flex items-center gap-3 transition-colors">
                                            <span className="text-xs text-gray-400 w-4 text-right">{i + 1}</span>
                                            <span className="flex-1 text-gray-700 text-sm truncate">{opp.name}</span>
                                            <span className="font-bold text-red-600 text-sm whitespace-nowrap">
                                                {opp.biggestLossGF} — {opp.biggestLossGA}
                                            </span>
                                            {opp.biggestLossMatchId && (
                                                <Link
                                                    to={`/match/${opp.biggestLossMatchId}`}
                                                    className="text-xs text-gray-400 hover:text-blue-600 underline underline-offset-2"
                                                >
                                                    Ver
                                                </Link>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}

            {!loading && !data && !error && activeClubIds.length > 0 && (
                <div className="bg-white rounded-xl border shadow-sm p-10 text-center text-gray-500">
                    <div className="font-semibold">Sem dados para exibir</div>
                </div>
            )}
        </div>
    );
}
