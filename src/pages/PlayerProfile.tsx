import React, { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import api from "../services/api.ts";
import { API_ENDPOINTS } from "../config/urls.ts";

interface PlayerMatchHistoryDto {
    matchId: number;
    timestamp: string;
    goals: number;
    assists: number;
    preAssists: number;
    rating: number;
    pos: string;
    mom: boolean;
    secondsPlayed: number;
    result: string;
    goalsFor: number;
    goalsAgainst: number;
    opponentName: string | null;
}

interface PlayerProfileDto {
    playerEntityId: number;
    name: string;
    accountName: string;
    playerId: number;
    clubId: number;
    totalMatches: number;
    totalWins: number;
    totalDraws: number;
    totalLosses: number;
    totalGoals: number;
    totalAssists: number;
    totalPreAssists: number;
    avgRating: number;
    totalMoM: number;
    totalRedCards: number;
    totalCleanSheets: number;
    totalSaves: number;
    hatTricks: number;
    bestRating: number;
    worstRating: number;
    bestRatingMatchId: number | null;
    worstRatingMatchId: number | null;
    mostGoalsInMatch: number;
    mostAssistsInMatch: number;
    proOverall: number | null;
    positions: Record<string, number>;
    history: PlayerMatchHistoryDto[];
}

function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function fmtTime(seconds: number) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
}

function ResultBadge({ result }: { result: string }) {
    const styles: Record<string, string> = {
        W: "bg-green-100 text-green-800 border-green-300",
        D: "bg-gray-100 text-gray-700 border-gray-300",
        L: "bg-red-100 text-red-800 border-red-300",
    };
    const labels: Record<string, string> = { W: "V", D: "E", L: "D" };
    return (
        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold border ${styles[result] ?? styles.D}`}>
            {labels[result] ?? result}
        </span>
    );
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

export default function PlayerProfile() {
    const { playerEntityId } = useParams<{ playerEntityId: string }>();
    const navigate = useNavigate();
    const [data, setData] = useState<PlayerProfileDto | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        if (!playerEntityId) return;
        setLoading(true);
        setError(null);
        try {
            const { data: resp } = await api.get<PlayerProfileDto>(
                API_ENDPOINTS.PLAYER_PROFILE(Number(playerEntityId))
            );
            setData(resp);
        } catch (e: any) {
            if (e?.response?.status === 404) {
                setError("Jogador não encontrado.");
            } else {
                setError(e?.message ?? "Erro ao carregar perfil");
            }
        } finally {
            setLoading(false);
        }
    }, [playerEntityId]);

    useEffect(() => { load(); }, [load]);

    const positionEntries = data
        ? Object.entries(data.positions).sort((a, b) => b[1] - a[1])
        : [];
    const maxPosCount = positionEntries[0]?.[1] ?? 1;

    return (
        <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
            <div className="flex items-center gap-3">
                <button
                    onClick={() => navigate(-1)}
                    className="px-3 py-1.5 rounded-lg text-sm font-medium border bg-white hover:bg-gray-50 transition-colors text-gray-700"
                >
                    Voltar
                </button>
                {data && (
                    <div className="flex items-center gap-3 flex-1">
                        <div>
                            <h1 className="text-xl font-black text-gray-900 tracking-tight">{data.name}</h1>
                            <p className="text-sm text-gray-500">@{data.accountName}</p>
                        </div>
                        {data.proOverall != null && (
                            <span className="ml-2 px-3 py-1 rounded-full text-sm font-bold bg-gray-900 text-white">
                                OVR {data.proOverall}
                            </span>
                        )}
                    </div>
                )}
                {loading && (
                    <div className="text-sm text-gray-400 animate-pulse">Carregando...</div>
                )}
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-800">{error}</div>
            )}

            {loading && (
                <div className="space-y-6">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {Array.from({ length: 8 }).map((_, i) => <SkeletonBlock key={i} h="h-20" />)}
                    </div>
                    <SkeletonBlock h="h-40" />
                    <SkeletonBlock h="h-64" />
                </div>
            )}

            {!loading && data && (
                <>
                    <div>
                        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Estatísticas Gerais</h2>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <KpiCard label="Partidas" value={data.totalMatches} />
                            <KpiCard label="V / E / D" value={`${data.totalWins} / ${data.totalDraws} / ${data.totalLosses}`} />
                            <KpiCard label="Gols" value={data.totalGoals} />
                            <KpiCard label="Assistências" value={data.totalAssists} />
                            <KpiCard label="Pré-Assists" value={data.totalPreAssists} />
                            <KpiCard label="Nota Média" value={data.avgRating.toFixed(2)} />
                            <KpiCard label="MoM" value={data.totalMoM} />
                            <KpiCard label="Hat-tricks" value={data.hatTricks} />
                        </div>
                    </div>

                    <div>
                        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Recordes Pessoais</h2>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-white rounded-xl border shadow-sm p-4 flex flex-col gap-1">
                                <div className="text-xs font-medium text-gray-500">Melhor Nota</div>
                                <div className="text-2xl font-black text-green-700">{data.bestRating.toFixed(2)}</div>
                                {data.bestRatingMatchId && (
                                    <Link to={`/match/${data.bestRatingMatchId}`} className="text-xs text-gray-400 hover:text-blue-600 underline underline-offset-2">
                                        Ver partida
                                    </Link>
                                )}
                            </div>
                            <div className="bg-white rounded-xl border shadow-sm p-4 flex flex-col gap-1">
                                <div className="text-xs font-medium text-gray-500">Pior Nota</div>
                                <div className="text-2xl font-black text-red-700">{data.worstRating.toFixed(2)}</div>
                                {data.worstRatingMatchId && (
                                    <Link to={`/match/${data.worstRatingMatchId}`} className="text-xs text-gray-400 hover:text-blue-600 underline underline-offset-2">
                                        Ver partida
                                    </Link>
                                )}
                            </div>
                            <div className="bg-white rounded-xl border shadow-sm p-4 flex flex-col gap-1">
                                <div className="text-xs font-medium text-gray-500">Mais Gols numa Partida</div>
                                <div className="text-2xl font-black text-gray-900">{data.mostGoalsInMatch}</div>
                            </div>
                            <div className="bg-white rounded-xl border shadow-sm p-4 flex flex-col gap-1">
                                <div className="text-xs font-medium text-gray-500">Mais Assists numa Partida</div>
                                <div className="text-2xl font-black text-gray-900">{data.mostAssistsInMatch}</div>
                            </div>
                        </div>
                    </div>

                    {positionEntries.length > 0 && (
                        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                            <div className="px-4 py-3 border-b bg-gray-50">
                                <span className="font-semibold text-gray-800 text-sm">Posições Jogadas</span>
                            </div>
                            <div className="divide-y">
                                {positionEntries.map(([pos, count]) => (
                                    <div key={pos} className="px-4 py-3 flex items-center gap-3">
                                        <span className="text-sm font-bold text-gray-700 w-12">{pos || "—"}</span>
                                        <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                                            <div
                                                className="h-full rounded-full bg-gray-700"
                                                style={{ width: `${Math.round((count / maxPosCount) * 100)}%` }}
                                            />
                                        </div>
                                        <span className="text-sm text-gray-500 w-8 text-right">{count}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                        <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
                            <span className="font-semibold text-gray-800 text-sm">Histórico de Partidas</span>
                            <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">{data.history.length} partidas</span>
                        </div>
                        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                            <table className="w-full text-sm">
                                <thead className="sticky top-0 bg-gray-50/90 backdrop-blur-sm z-10">
                                    <tr className="border-b text-gray-500 text-xs uppercase tracking-wide">
                                        <th className="text-left px-4 py-2.5 font-medium whitespace-nowrap">Data</th>
                                        <th className="text-left px-4 py-2.5 font-medium whitespace-nowrap">Adversário</th>
                                        <th className="text-center px-3 py-2.5 font-medium">Res.</th>
                                        <th className="text-center px-3 py-2.5 font-medium">G/A/P</th>
                                        <th className="text-center px-3 py-2.5 font-medium">Nota</th>
                                        <th className="text-center px-3 py-2.5 font-medium">Pos</th>
                                        <th className="text-center px-3 py-2.5 font-medium whitespace-nowrap">Tempo</th>
                                        <th className="px-4 py-2.5 font-medium" />
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.history.map((h, i) => (
                                        <tr key={i} className="border-b last:border-0 hover:bg-gray-50 transition-colors">
                                            <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{fmtDate(h.timestamp)}</td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-gray-700 truncate max-w-[120px]">{h.opponentName ?? "—"}</span>
                                                    <span className="text-xs text-gray-400 whitespace-nowrap">{h.goalsFor}–{h.goalsAgainst}</span>
                                                </div>
                                            </td>
                                            <td className="px-3 py-3 text-center">
                                                <ResultBadge result={h.result} />
                                            </td>
                                            <td className="px-3 py-3 text-center">
                                                <span className="font-mono text-xs text-gray-700">
                                                    {h.goals}/{h.assists}/{h.preAssists}
                                                </span>
                                            </td>
                                            <td className="px-3 py-3 text-center">
                                                <span className={`text-sm font-bold ${h.rating >= 8 ? "text-green-700" : h.rating < 6 ? "text-red-600" : "text-gray-700"}`}>
                                                    {h.rating.toFixed(1)}
                                                </span>
                                            </td>
                                            <td className="px-3 py-3 text-center text-xs font-semibold text-gray-600">{h.pos || "—"}</td>
                                            <td className="px-3 py-3 text-center text-xs text-gray-500 whitespace-nowrap">{fmtTime(h.secondsPlayed)}</td>
                                            <td className="px-4 py-3 text-right">
                                                <Link
                                                    to={`/match/${h.matchId}`}
                                                    className="text-xs text-gray-400 hover:text-blue-600 underline underline-offset-2"
                                                >
                                                    Ver
                                                </Link>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
