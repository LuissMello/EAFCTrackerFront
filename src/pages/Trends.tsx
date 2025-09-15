import React, { useEffect, useMemo, useRef, useState } from "react";
import api from "../services/api.ts";
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Title,
    Tooltip,
    Legend,
    Filler,
} from "chart.js";
import { Line, Bar } from "react-chartjs-2";
import { useClub } from "../hooks/useClub.tsx";

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
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

const BR_DATE = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
});
const formatDate = (iso: string) => BR_DATE.format(new Date(iso));

const COLORS = {
    blue: { border: "rgba(37,99,235,1)", fill: "rgba(59,130,246,0.15)" },
    emerald: { border: "rgba(16,185,129,1)", fill: "rgba(52,211,153,0.15)" },
    amber: { border: "rgba(245,158,11,1)", fill: "rgba(251,191,36,0.15)" },
    indigo: { border: "rgba(79,70,229,1)", fill: "rgba(129,140,248,0.15)" },
    rose: { border: "rgba(244,63,94,1)", fill: "rgba(251,113,133,0.12)" },
    slate: { border: "rgba(100,116,139,1)", fill: "rgba(148,163,184,0.15)" },
};

const pillColor = (r: Result) =>
    r === "W" ? "bg-green-600" : r === "D" ? "bg-gray-500" : "bg-red-600";

// simples média móvel (não recalcula percentuais a partir de tentativas; só suaviza a série recebida)
function movingAvg(arr: number[], win = 5) {
    if (!arr || arr.length === 0) return [];
    const out: number[] = [];
    let sum = 0;
    for (let i = 0; i < arr.length; i++) {
        sum += arr[i] ?? 0;
        if (i >= win) sum -= arr[i - win] ?? 0;
        out.push(i >= win - 1 ? sum / win : arr[i]); // antes da janela completa, mostra o próprio valor
    }
    return out;
}

// =========================
// Component
// =========================

export default function TrendsPage() {
    const { club } = useClub();
    const activeClubId = club?.clubId;

    const [last, setLast] = useState(20);
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<ClubTrendsDto | null>(null);
    const [tops, setTops] = useState<TopItemDto[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [reloadNonce, setReloadNonce] = useState<number>(0);

    // UI state novo
    type Metric = "pass" | "tackle" | "rating" | "gfga" | "gdiff";
    const [metric, setMetric] = useState<Metric>("pass");
    type ChartKind = "line" | "area" | "bar";
    const [chartKind, setChartKind] = useState<ChartKind>("line");
    const [smooth, setSmooth] = useState(true);
    type XMode = "index" | "date";
    const [xMode, setXMode] = useState<XMode>("index");

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
    const n = series.length;

    const xIndexLabels = useMemo(() => series.map((_, i) => `Jogo ${i + 1}`), [series]);
    const xDateLabels = useMemo(() => series.map((p) => formatDate(p.timestamp)), [series]);
    const xLabels = xMode === "index" ? xIndexLabels : xDateLabels;

    // valores base
    const pass = series.map((s) => s.passAccuracyPercent ?? 0);
    const tackle = series.map((s) => s.tackleSuccessPercent ?? 0);
    const rating = series.map((s) => s.avgRating ?? 0);
    const gf = series.map((s) => s.goalsFor ?? 0);
    const ga = series.map((s) => s.goalsAgainst ?? 0);
    const gdiff = series.map((_, i) => (gf[i] ?? 0) - (ga[i] ?? 0));

    // aplica suavização, se marcado
    const passPlot = smooth ? movingAvg(pass, 5) : pass;
    const tacklePlot = smooth ? movingAvg(tackle, 5) : tackle;
    const ratingPlot = smooth ? movingAvg(rating, 5) : rating;
    const gfPlot = smooth ? movingAvg(gf, 5) : gf;
    const gaPlot = smooth ? movingAvg(ga, 5) : ga;
    const gdiffPlot = smooth ? movingAvg(gdiff, 5) : gdiff;

    // ponto pequeno/sem ponto quando há muitos jogos
    const manyPoints = n > 25;
    const pointRadius = manyPoints ? 0 : 2;

    // Seleção dinâmica de datasets por métrica
    const chartData = useMemo(() => {
        if (metric === "gfga") {
            return {
                labels: xLabels,
                datasets: [
                    {
                        type: chartKind === "bar" ? "bar" : "line",
                        label: "Gols feitos",
                        data: gfPlot,
                        borderColor: COLORS.indigo.border,
                        backgroundColor:
                            chartKind === "bar" ? COLORS.indigo.fill : COLORS.indigo.fill,
                        borderWidth: 2,
                        tension: 0.3,
                        pointRadius,
                        fill: chartKind === "area",
                    },
                    {
                        type: chartKind === "bar" ? "bar" : "line",
                        label: "Gols levados",
                        data: gaPlot,
                        borderColor: COLORS.rose.border,
                        backgroundColor:
                            chartKind === "bar" ? COLORS.rose.fill : COLORS.rose.fill,
                        borderWidth: 2,
                        tension: 0.3,
                        pointRadius,
                        fill: chartKind === "area",
                    },
                ],
            };
        }

        if (metric === "gdiff") {
            // barras com cor por sinal do valor; para line/area, mantém linha única
            const base = {
                labels: xLabels,
                datasets: [
                    {
                        label: "Dif. de gols (GF - GA)",
                        data: gdiffPlot,
                        borderColor: COLORS.emerald.border,
                        backgroundColor:
                            chartKind === "bar"
                                ? (ctx: any) =>
                                    (ctx.raw ?? 0) >= 0
                                        ? "rgba(16,185,129,0.6)"
                                        : "rgba(244,63,94,0.6)"
                                : COLORS.emerald.fill,
                        borderWidth: 2,
                        tension: 0.3,
                        pointRadius,
                        fill: chartKind === "area",
                    } as any,
                ],
            };
            return base;
        }

        // métricas simples
        const mapMetric: Record<
            Exclude<Metric, "gfga" | "gdiff">,
            { label: string; color: keyof typeof COLORS; values: number[] }
        > = {
            pass: { label: "Precisão de passe (%)", color: "blue", values: passPlot },
            tackle: { label: "Êxito em desarmes (%)", color: "emerald", values: tacklePlot },
            rating: { label: "Nota média", color: "amber", values: ratingPlot },
        };
        const { label, color, values } = mapMetric[metric];

        return {
            labels: xLabels,
            datasets: [
                {
                    label,
                    data: values,
                    borderColor: COLORS[color].border,
                    backgroundColor:
                        chartKind === "bar" ? COLORS[color].fill : COLORS[color].fill,
                    borderWidth: 2,
                    tension: 0.3,
                    pointRadius,
                    fill: chartKind === "area",
                },
            ],
        };
    }, [metric, chartKind, xLabels, passPlot, tacklePlot, ratingPlot, gfPlot, gaPlot, gdiffPlot, pointRadius]);

    // opções de eixo/tooltip mais limpas
    const baseOptions: any = useMemo(
        () => ({
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            interaction: { mode: "index", intersect: false },
            plugins: {
                legend: { display: true, position: "top" },
                tooltip: {
                    callbacks: {
                        title: (items: any[]) => {
                            const i = items?.[0]?.dataIndex ?? 0;
                            const s = series[i];
                            if (!s) return items?.[0]?.label ?? "";
                            const title = xMode === "index" ? `Jogo ${i + 1}` : items?.[0]?.label;
                            const date = formatDate(s.timestamp);
                            const vs = s.opponentName ? ` vs ${s.opponentName}` : "";
                            const placar = ` • ${s.goalsFor}-${s.goalsAgainst}`;
                            return `${title} — ${date}${vs}${placar}`;
                        },
                        label: (ctx: any) => {
                            const v = ctx.raw as number;
                            return `${ctx.dataset.label}: ${Number.isFinite(v) ? v.toFixed(metric === "rating" ? 2 : 1) : "-"
                                }`;
                        },
                    },
                },
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: {
                        autoSkip: true,
                        maxTicksLimit: 8,
                    },
                },
                y: {
                    beginAtZero: true,
                    grid: { color: "rgba(0,0,0,0.05)" },
                    ticks: {
                        // rating costuma variar pouco; força uma escala mais útil
                        callback: (v: any) => `${v}`,
                    },
                },
            },
            elements: {
                point: { radius: pointRadius },
                line: { borderJoinStyle: "round", borderCapStyle: "round" },
            },
        }),
        [series, xMode, pointRadius, metric]
    );

    const ChartComponent =
        metric === "gfga" || metric === "gdiff"
            ? chartKind === "bar"
                ? Bar
                : Line
            : chartKind === "bar"
                ? Bar
                : Line;

    const lastResults = series.map((s) => s.result as Result);
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

                <div className="flex flex-wrap items-center gap-2">
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
                    <div className="animate-pulse bg-white border rounded-xl p-4 h-[340px]" />
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
                            <div className="font-mono tracking-wide">{data.formLast5 || "-"}</div>
                        </div>
                        <div className="bg-white border rounded-xl p-4">
                            <div className="text-xs text-gray-500 mb-1">Forma (Últimos 10)</div>
                            <div className="font-mono tracking-wide">{data.formLast10 || "-"}</div>
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

                    {/* CONTROLES DO GRÁFICO */}
                    <div className="bg-white border rounded-xl p-4">
                        <div className="flex flex-wrap items-center gap-3">
                            <label className="text-sm text-gray-700">
                                Métrica
                                <select
                                    className="ml-2 border rounded px-2 py-1 text-sm"
                                    value={metric}
                                    onChange={(e) => setMetric(e.target.value as any)}
                                >
                                    <option value="pass">Precisão de passe (%)</option>
                                    <option value="tackle">Êxito em desarmes (%)</option>
                                    <option value="rating">Nota média</option>
                                    <option value="gfga">Gols feitos × levados</option>
                                    <option value="gdiff">Dif. de gols (GF−GA)</option>
                                </select>
                            </label>

                            <label className="text-sm text-gray-700">
                                Visual
                                <select
                                    className="ml-2 border rounded px-2 py-1 text-sm"
                                    value={chartKind}
                                    onChange={(e) => setChartKind(e.target.value as any)}
                                >
                                    <option value="line">Linha</option>
                                    <option value="area">Área</option>
                                    <option value="bar">Barras</option>
                                </select>
                            </label>

                            <label className="text-sm text-gray-700">
                                Eixo X
                                <select
                                    className="ml-2 border rounded px-2 py-1 text-sm"
                                    value={xMode}
                                    onChange={(e) => setXMode(e.target.value as any)}
                                >
                                    <option value="index">Jogo #</option>
                                    <option value="date">Data</option>
                                </select>
                            </label>
                        </div>

                        {/* GRÁFICO PRINCIPAL */}
                        <div className="mt-4 h-[340px]">
                            <ChartComponent data={chartData as any} options={baseOptions} />
                        </div>

                        {/* FAIXA DE RESULTADOS COMPACTA */}
                        <div className="mt-4">
                            <div className="text-xs text-gray-500 mb-2">Resultados no período</div>
                            {series.length === 0 ? (
                                <div className="text-sm text-gray-600">Sem partidas no período selecionado.</div>
                            ) : (
                                <div className="flex gap-1 overflow-x-auto no-scrollbar py-1">
                                    {series.map((s, i) => (
                                        <span
                                            key={s.matchId}
                                            title={`${formatDate(s.timestamp)} • vs ${s.opponentName} • ${s.goalsFor}-${s.goalsAgainst}`}
                                            className={`inline-block w-5 h-5 rounded ${pillColor(
                                                s.result as Result
                                            )}`}
                                        />
                                    ))}
                                </div>
                            )}
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
                                        .sort(
                                            (a, b) =>
                                                b.goals - a.goals ||
                                                b.assists - a.assists ||
                                                b.avgRating - a.avgRating
                                        )
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
