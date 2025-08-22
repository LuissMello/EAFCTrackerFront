import React, { useEffect, useMemo, useRef, useState } from "react";
import api from "../services/api.ts";
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { useClub } from "../hooks/useClub.tsx";

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler
);

// =========================
// Types
// =========================

type Result = "W" | "D" | "L";

interface MatchTrendPointDto {
    matchId: number;
    timestamp: string;
    opponentClubId: number;
    opponentName: string;
    goalsFor: number;
    goalsAgainst: number;
    result: Result | string;
    shots: number;
    passesMade: number;
    passAttempts: number;
    passAccuracyPercent: number;
    tacklesMade: number;
    tackleAttempts: number;
    tackleSuccessPercent: number;
    avgRating: number;
    momOccurred: boolean;
}

interface ClubTrendsDto {
    clubId: number;
    clubName: string;
    series: MatchTrendPointDto[];
    formLast5: string;
    formLast10: string;
    currentUnbeaten: number;
    currentWins: number;
    currentCleanSheets: number;
    movingAvgPassAcc_5: number[];
    movingAvgRating_5: number[];
    movingAvgTackleAcc_5: number[];
}

interface TopItemDto {
    playerEntityId: number;
    playerId: number;
    playerName: string;
    clubId: number;
    goals: number;
    assists: number;
    matches: number;
    avgRating: number;
    mom: number;
}

// =========================
// Helpers
// =========================

const BR_DATE = new Intl.DateTimeFormat("pt-BR");
const formatDate = (iso: string) => BR_DATE.format(new Date(iso));

const COLORS = {
    blue: {
        border: "rgba(37, 99, 235, 1)",
        fill: "rgba(59, 130, 246, 0.15)",
    },
    emerald: {
        border: "rgba(16, 185, 129, 1)",
        fill: "rgba(52, 211, 153, 0.15)",
    },
    amber: {
        border: "rgba(245, 158, 11, 1)",
        fill: "rgba(251, 191, 36, 0.15)",
    },
};

const pillColor = (r: Result) =>
    r === "W" ? "bg-green-600" : r === "D" ? "bg-gray-500" : "bg-red-600";

// =========================
// Component
// =========================

export default function TrendsPage() {
    const { club } = useClub();
    const activeClubId = club?.clubId; // number | undefined

    const [last, setLast] = useState(20);
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<ClubTrendsDto | null>(null);
    const [tops, setTops] = useState<TopItemDto[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [reloadNonce, setReloadNonce] = useState<number>(0);

    const mountedRef = useRef(true);
    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    // -------- Fetch --------
    useEffect(() => {
        if (!activeClubId) return;
        const controller = new AbortController();

        (async () => {
            try {
                setLoading(true);
                setError(null);

                const [t1, t2] = await Promise.all([
                    api.get<ClubTrendsDto>(
                        `https://eafctracker-cvadcceuerbgegdj.brazilsouth-01.azurewebsites.net/api/Trends/club/${activeClubId}?last=${last}`,
                        { signal: (controller as any).signal }
                    ),
                    api.get<TopItemDto[]>(
                        `https://eafctracker-cvadcceuerbgegdj.brazilsouth-01.azurewebsites.net/api/Trends/top-scorers?clubId=${activeClubId}&limit=10`,
                        { signal: (controller as any).signal }
                    ),
                ]);

                if (!mountedRef.current) return;
                setData(t1.data);
                setTops(t2.data);
            } catch (e: any) {
                if (!mountedRef.current) return;
                if (e?.name === "CanceledError" || e?.name === "AbortError") return;
                setError(e?.message ?? "Erro ao carregar tendências");
            } finally {
                if (mountedRef.current) setLoading(false);
            }
        })();

        return () => controller.abort();
    }, [activeClubId, last, reloadNonce]);

    // -------- Derived --------
    const series = data?.series ?? [];

    const labels = useMemo(() => series.map((p) => formatDate(p.timestamp)), [series]);

    const passData = useMemo(
        () => ({
            labels,
            datasets: [
                {
                    label: "Precisão de passe",
                    data: data?.movingAvgPassAcc_5 ?? [],
                    borderColor: COLORS.blue.border,
                    backgroundColor: COLORS.blue.fill,
                    borderWidth: 2,
                    pointRadius: 2,
                    tension: 0.3,
                    fill: true,
                },
            ],
        }),
        [labels, data?.movingAvgPassAcc_5]
    );

    const tackleData = useMemo(
        () => ({
            labels,
            datasets: [
                {
                    label: "Êxito em desarmes",
                    data: data?.movingAvgTackleAcc_5 ?? [],
                    borderColor: COLORS.emerald.border,
                    backgroundColor: COLORS.emerald.fill,
                    borderWidth: 2,
                    pointRadius: 2,
                    tension: 0.3,
                    fill: true,
                },
            ],
        }),
        [labels, data?.movingAvgTackleAcc_5]
    );

    const ratingData = useMemo(
        () => ({
            labels,
            datasets: [
                {
                    label: "Nota média",
                    data: data?.movingAvgRating_5 ?? [],
                    borderColor: COLORS.amber.border,
                    backgroundColor: COLORS.amber.fill,
                    borderWidth: 2,
                    pointRadius: 2,
                    tension: 0.3,
                    fill: true,
                },
            ],
        }),
        [labels, data?.movingAvgRating_5]
    );

    const baseLineOptions: any = useMemo(
        () => ({
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: true },
                tooltip: {
                    callbacks: {
                        label: (ctx: any) => {
                            const v = ctx.raw as number;
                            return `${ctx.dataset.label}: ${Number.isFinite(v) ? v.toFixed(2) : "-"}`;
                        },
                    },
                },
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: "rgba(0,0,0,0.05)" },
                    ticks: { callback: (v: any) => `${v}` },
                },
                x: {
                    grid: { display: false },
                },
            },
        }),
        []
    );

    const lastResults = series.map((s) => s.result as Result);

    // -------- Actions --------
    const quickLasts = [5, 10, 20, 50];

    const forceReload = () => setReloadNonce(Date.now());

  
    // =========================
    // Render
    // =========================

    return (
        <div className="p-4 max-w-7xl mx-auto space-y-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold">
                        Tendências &amp; Streaks — {data?.clubName ?? club?.clubName ?? ""}
                    </h1>
                    {activeClubId && (
                        <div className="text-xs text-gray-600 mt-1">
                            Clube ativo: <span className="font-mono">{activeClubId}</span>
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-700">Últimos</span>
                    <div className="flex items-center gap-1">
                        {quickLasts.map((n) => (
                            <button
                                key={n}
                                onClick={() => setLast(n)}
                                className={`text-sm px-2 py-1 rounded border ${last === n
                                        ? "bg-blue-600 text-white border-blue-600"
                                        : "bg-white hover:bg-gray-50"
                                    }`}
                                aria-pressed={last === n}
                            >
                                {n}
                            </button>
                        ))}
                    </div>
                    <input
                        type="number"
                        className="border rounded px-2 py-1 w-24"
                        min={5}
                        value={last}
                        onChange={(e) => setLast(Math.max(5, parseInt(e.target.value) || 5))}
                    />
                    <span className="text-sm text-gray-700">jogos</span>
                    <button
                        onClick={forceReload}
                        className="ml-2 text-sm px-3 py-1 rounded border bg-white hover:bg-gray-50"
                        title="Recarregar"
                    >
                        Recarregar
                    </button>
                </div>
            </div>

            {!activeClubId && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 text-yellow-800 rounded">
                    Selecione um clube no menu para ver as tendências.
                </div>
            )}

            {activeClubId && loading && (
                <div className="grid gap-3">
                    <div className="animate-pulse bg-white border rounded-xl p-4 h-20" />
                    <div className="animate-pulse bg-white border rounded-xl p-4 h-24" />
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <div className="animate-pulse bg-white border rounded-xl h-[260px]" />
                        <div className="animate-pulse bg-white border rounded-xl h-[260px]" />
                        <div className="animate-pulse bg-white border rounded-xl h-[260px]" />
                    </div>
                    <div className="animate-pulse bg-white border rounded-xl p-4 h-48" />
                </div>
            )}

            {activeClubId && error && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded flex items-center justify-between">
                    <span>{error}</span>
                    <button
                        onClick={forceReload}
                        className="text-sm px-3 py-1 rounded border bg-white hover:bg-gray-50"
                    >
                        Tentar novamente
                    </button>
                </div>
            )}

            {activeClubId && !loading && !error && data && (
                <>
                    {/* Cards - forma e streaks */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="bg-white border rounded-xl p-4">
                            <div className="text-xs text-gray-500 mb-1">Forma (Últimos 5)</div>
                            <div className="font-mono tracking-wide">{data.formLast5 || "—"}</div>
                        </div>
                        <div className="bg-white border rounded-xl p-4">
                            <div className="text-xs text-gray-500 mb-1">Forma (Últimos 10)</div>
                            <div className="font-mono tracking-wide">{data.formLast10 || "—"}</div>
                        </div>
                        <div className="bg-white border rounded-xl p-4">
                            <div className="grid grid-cols-3 text-center">
                                <div>
                                    <div className="text-xs text-gray-500">Sem perder</div>
                                    <div className="text-xl font-bold">{data.currentUnbeaten}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-gray-500">Vitórias seguidas</div>
                                    <div className="text-xl font-bold">{data.currentWins}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-gray-500">Clean sheets</div>
                                    <div className="text-xl font-bold">{data.currentCleanSheets}</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Timeline W/D/L com detalhes */}
                    <div className="bg-white border rounded-xl p-4">
                        <div className="flex items-center justify-between mb-2">
                            <div className="text-sm font-semibold">Linha do tempo (W/D/L)</div>
                            <div className="text-xs text-gray-500">toque/hover para ver o adversário e o placar</div>
                        </div>
                        {series.length === 0 ? (
                            <div className="text-sm text-gray-600">Sem partidas no período selecionado.</div>
                        ) : (
                            <div className="flex flex-wrap gap-2">
                                {series.map((s) => (
                                    <div key={s.matchId} className="flex items-center gap-2 group">
                                        <span
                                            className={`text-white text-xs px-2 py-1 rounded ${pillColor(s.result as Result)} cursor-default`}
                                            title={`${formatDate(s.timestamp)} • vs ${s.opponentName} • ${s.goalsFor}-${s.goalsAgainst}${s.momOccurred ? " • MOM" : ""
                                                }`}
                                        >
                                            {s.result}
                                        </span>
                                        <span className="text-xs text-gray-600 group-hover:underline">
                                            {formatDate(s.timestamp)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Gráficos */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <div className="bg-white border rounded-xl p-4 h-[280px]">
                            <Line data={passData as any} options={baseLineOptions} />
                        </div>
                        <div className="bg-white border rounded-xl p-4 h-[280px]">
                            <Line data={tackleData as any} options={baseLineOptions} />
                        </div>
                        <div className="bg-white border rounded-xl p-4 h-[280px]">
                            <Line data={ratingData as any} options={baseLineOptions} />
                        </div>
                    </div>

                    {/* Top performers */}
                    <div className="bg-white border rounded-xl p-4">
                        <div className="flex items-center justify-between mb-2">
                            <h2 className="text-lg font-semibold">Top Performers (período)</h2>
                            <span className="text-xs text-gray-500">ordenado por gols ↓</span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full table-auto text-sm text-center border">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="p-2 text-left">Jogador</th>
                                        <th className="p-2">Partidas</th>
                                        <th className="p-2">Gols</th>
                                        <th className="p-2">Assistências</th>
                                        <th className="p-2">MOM</th>
                                        <th className="p-2">Nota média</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {[...tops]
                                        .sort((a, b) => b.goals - a.goals || b.assists - a.assists || b.avgRating - a.avgRating)
                                        .map((t) => (
                                            <tr key={t.playerEntityId} className="border-t">
                                                <td className="p-2 text-left whitespace-nowrap">{t.playerName}</td>
                                                <td className="p-2">{t.matches}</td>
                                                <td className="p-2">{t.goals}</td>
                                                <td className="p-2">{t.assists}</td>
                                                <td className="p-2">{t.mom}</td>
                                                <td className="p-2">{Number(t.avgRating).toFixed(2)}</td>
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
