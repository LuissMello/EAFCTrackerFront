import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import api from "../services/api.ts";
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import { useClub } from "../hooks/useClub.tsx";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

// ======================
// Tipos (espelham /api/matches/{matchId}/statistics)
// ======================
interface PlayerRow {
    playerId: number;
    playerName: string;
    clubId: number;

    matchesPlayed: number;
    totalGoals: number;
    totalAssists: number;
    totalShots: number;
    totalPassesMade: number;
    totalPassAttempts: number;
    totalTacklesMade: number;
    totalTackleAttempts: number;

    totalWins: number;
    totalLosses: number;
    totalDraws: number;
    totalCleanSheets: number;
    totalRedCards: number;
    totalSaves: number;
    totalMom: number;

    avgRating: number;

    passAccuracyPercent: number;
    tackleSuccessPercent: number;
    goalAccuracyPercent: number;
    winPercent: number;
}

interface ClubRow {
    clubId: number;
    clubName: string;
    clubCrestAssetId?: string | null;

    matchesPlayed: number;
    totalGoals: number;
    totalAssists: number;
    totalShots: number;
    totalPassesMade: number;
    totalPassAttempts: number;
    totalTacklesMade: number;
    totalTackleAttempts: number;

    totalWins: number;
    totalLosses: number;
    totalDraws: number;
    totalCleanSheets: number;
    totalRedCards: number;
    totalSaves: number;
    totalMom: number;

    avgRating: number;

    winPercent: number;
    passAccuracyPercent: number;
    tackleSuccessPercent: number;
    goalAccuracyPercent: number;
}

interface OverallRow {
    totalMatches: number;
    totalPlayers: number;
    totalGoals: number;
    totalAssists: number;
    totalShots: number;
    totalPassesMade: number;
    totalPassAttempts: number;
    totalTacklesMade: number;
    totalTackleAttempts: number;
    totalRating: number;
    totalWins: number;
    totalLosses: number;
    totalDraws: number;
    totalCleanSheets: number;
    totalRedCards: number;
    totalSaves: number;
    totalMom: number;

    avgGoals: number;
    avgAssists: number;
    avgShots: number;
    avgPassesMade: number;
    avgPassAttempts: number;
    avgTacklesMade: number;
    avgTackleAttempts: number;
    avgRating: number;
    avgRedCards: number;
    avgSaves: number;
    avgMom: number;

    winPercent: number;
    lossPercent: number;
    drawPercent: number;
    cleanSheetsPercent: number;
    momPercent: number;
    passAccuracyPercent: number;
    tackleSuccessPercent: number;
    goalAccuracyPercent: number;
}

interface ClubOverallRow {
    clubId: number;
    bestDivision?: string | null;
    bestFinishGroup?: string | null;
    finishesInDivision1Group1?: string | null;
    finishesInDivision2Group1?: string | null;
    finishesInDivision3Group1?: string | null;
    finishesInDivision4Group1?: string | null;
    finishesInDivision5Group1?: string | null;
    finishesInDivision6Group1?: string | null;
    gamesPlayed?: string | null;
    gamesPlayedPlayoff?: string | null;
    goals?: string | null;
    goalsAgainst?: string | null;
    promotions?: string | null;
    relegations?: string | null;
    losses?: string | null;
    ties?: string | null;
    wins?: string | null;
    lastMatch0?: string | null;
    lastMatch1?: string | null;
    lastMatch2?: string | null;
    lastMatch3?: string | null;
    lastMatch4?: string | null;
    lastMatch5?: string | null;
    lastMatch6?: string | null;
    lastMatch7?: string | null;
    lastMatch8?: string | null;
    lastMatch9?: string | null;
    lastOpponent0?: string | null;
    lastOpponent1?: string | null;
    lastOpponent2?: string | null;
    lastOpponent3?: string | null;
    lastOpponent4?: string | null;
    lastOpponent5?: string | null;
    lastOpponent6?: string | null;
    lastOpponent7?: string | null;
    lastOpponent8?: string | null;
    lastOpponent9?: string | null;
    wstreak?: string | null;
    unbeatenstreak?: string | null;
    skillRating?: string | null;
    reputationtier?: string | null;
    leagueAppearances?: string | null;
    updatedAtUtc?: string | null;
}

interface FullMatchStatisticsDto {
    overall: OverallRow;
    players: PlayerRow[];
    clubs: ClubRow[];
    clubsOverall?: ClubOverallRow[];
}

// ======================
// Helpers
// ======================
const FALLBACK_LOGO = "https://via.placeholder.com/96?text=Logo";
const crestUrl = (id?: string | null) =>
    id
        ? `https://eafc24.content.easports.com/fifa/fltOnlineAssets/24B23FDE-7835-41C2-87A2-F453DFDB2E82/2024/fcweb/crests/256x256/l${id}.png`
        : FALLBACK_LOGO;

function colorFromId(num: number) {
    let x = Math.imul(num ^ 0x9e3779b9, 0x85ebca6b);
    x ^= x >>> 13;
    x = Math.imul(x, 0xc2b2ae35);
    x ^= x >>> 16;
    const r = (x & 0xff).toString(16).padStart(2, "0");
    const g = ((x >>> 8) & 0xff).toString(16).padStart(2, "0");
    const b = ((x >>> 16) & 0xff).toString(16).padStart(2, "0");
    return `#${r}${g}${b}`.toUpperCase();
}

function toNum(s?: string | null): number {
    if (s === null || s === undefined) return 0;
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
}

function fmt(value: number | undefined | null) {
    if (value === undefined || value === null) return "–";
    return Number.isInteger(value)
        ? String(value)
        : (Math.round((value as number) * 100) / 100).toFixed(2);
}

// Aceita >= 0 (para reputationtier=0)
const asNonNegativeIntString = (s?: string | null) => {
    const n = Number(String(s ?? "").trim());
    return Number.isFinite(n) && n >= 0 ? String(Math.trunc(n)) : null;
};

// Aceita apenas >=1 (para bestDivision nos assets)
const asPositiveIntString = (s?: string | null) => {
    const n = Number(String(s ?? "").trim());
    return Number.isFinite(n) && n > 0 ? String(Math.trunc(n)) : null;
};

const divisionCrestUrl = (bestDivision?: string | null) => {
    const n = asPositiveIntString(bestDivision);
    return n
        ? `https://media.contentapi.ea.com/content/dam/eacom/fc/pro-clubs/divisioncrest${n}.png`
        : null;
};

const reputationTierUrl = (tier?: string | null) => {
    const n = asPositiveIntString(tier);
    return n
        ? `https://media.contentapi.ea.com/content/dam/eacom/fc/pro-clubs/reputation-tier${n}.png`
        : null;
};

// --- Mapas de rótulos fornecidos ---
const REPUTATION_LABELS: Record<string, string> = {
    "0": "Hometown Heroes",
    "1": "Emerging Stars",
    "2": "Well Known",
    "3": "World Renown",
};

const HIGHEST_PLACEMENT_LABELS: Record<string, string> = {
    "1": "Champion",
    "2": "Runner-Up",
    "3": "Competitive",
    "4": "Mid-Table",
    "5": "Also-ran",
    "6": "Participant",
};

// Progress bar minúscula (cabe dentro do cartão/quadrado)
const TinyBar: React.FC<{ pct: number; className?: string; title?: string }> = ({ pct, className = "", title }) => {
    const w = Math.max(0, Math.min(100, pct));
    return (
        <div className={`w-full ${className}`} title={title} aria-label={title}>
            <div className="w-full h-1 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-blue-600" style={{ width: `${w}%` }} />
            </div>
        </div>
    );
};

// meta de estatísticas disponíveis na UI
const comparisonStats: Array<{
    label: string;
    key: keyof (ClubRow & PlayerRow);
    scope: "club" | "player" | "both";
}> = [
        { label: "Gols", key: "totalGoals", scope: "both" },
        { label: "Assistências", key: "totalAssists", scope: "both" },
        { label: "Chutes", key: "totalShots", scope: "both" },
        { label: "Precisão de Chutes (%)", key: "goalAccuracyPercent", scope: "both" },
        { label: "Passes Certos", key: "totalPassesMade", scope: "both" },
        { label: "Passes Tentados", key: "totalPassAttempts", scope: "both" },
        { label: "Precisão de Passe (%)", key: "passAccuracyPercent", scope: "both" },
        { label: "Desarmes Certos", key: "totalTacklesMade", scope: "both" },
        { label: "Desarmes Tentados", key: "totalTackleAttempts", scope: "both" },
        { label: "Precisão de Desarmes (%)", key: "tackleSuccessPercent", scope: "both" },
        { label: "Nota Média", key: "avgRating", scope: "both" },
        { label: "Defesas (GK)", key: "totalSaves", scope: "both" },
        { label: "Clean Sheets", key: "totalCleanSheets", scope: "both" },
        { label: "Cartões Vermelhos", key: "totalRedCards", scope: "both" },
        { label: "Homem do Jogo", key: "totalMom", scope: "both" },
        { label: "Vitórias (%)", key: "winPercent", scope: "both" },
    ];

type StatKey = (typeof comparisonStats)[number]["key"];
type PlayerSortKey = keyof PlayerRow | "playerName";

// Aux: badge simples
const Badge: React.FC<{ className?: string; children: React.ReactNode; title?: string }>
    = ({ className = "", children, title }) => (
        <span title={title} className={`text-xs px-2 py-0.5 rounded-full border ${className}`}>{children}</span>
    );

// Aux: Skeleton
const Skeleton: React.FC<{ className?: string }>
    = ({ className = "h-5 w-full" }) => (
        <div className={`animate-pulse rounded bg-gray-200 ${className}`} />
    );

// Aux: botão
const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ className = "", ...props }) => (
    <button
        {...props}
        className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm shadow-sm hover:bg-gray-50 disabled:opacity-60 ${className}`}
    />
);

// ======================
export default function MatchDetails() {
    const { matchId } = useParams();
    const { club } = useClub();
    const selectedClubId = club?.clubId ?? null;
    const [searchParams, setSearchParams] = useSearchParams();

    const [stats, setStats] = useState<FullMatchStatisticsDto | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const initialStat = (searchParams.get("stat") as StatKey) || "totalGoals";
    const initialOnlySel = searchParams.get("onlyClub") === "1";

    const [selectedStat, setSelectedStat] = useState<StatKey>(initialStat);
    const [onlySelectedClubPlayers, setOnlySelectedClubPlayers] = useState<boolean>(initialOnlySel);
    const [playerQuery, setPlayerQuery] = useState("");
    const [sortKey, setSortKey] = useState<PlayerSortKey>("totalGoals");
    const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
    const [showOverallPanel, setShowOverallPanel] = useState<boolean>(false); // inicia minimizado

    const persistParams = useCallback((key: string, val: string | null) => {
        const sp = new URLSearchParams(searchParams);
        if (val === null) sp.delete(key); else sp.set(key, val);
        setSearchParams(sp, { replace: true });
    }, [searchParams, setSearchParams]);

    useEffect(() => { persistParams("stat", selectedStat); }, [selectedStat]);
    useEffect(() => { persistParams("onlyClub", onlySelectedClubPlayers ? "1" : null); }, [onlySelectedClubPlayers]);

    const fetchData = useCallback(async () => {
        if (!matchId) return;
        let cancel = false;
        try {
            setLoading(true);
            setError(null);
            const { data } = await api.get<FullMatchStatisticsDto>(
                `https://eafctracker-cvadcceuerbgegdj.brazilsouth-01.azurewebsites.net/api/matches/${matchId}/statistics`
            );
            if (!cancel) setStats(data);
        } catch (err: any) {
            if (!cancel) setError(err?.message ?? "Erro ao buscar estatísticas");
        } finally {
            if (!cancel) setLoading(false);
        }
        return () => { cancel = true; };
    }, [matchId]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const players = stats?.players ?? [];
    const clubs = stats?.clubs ?? [];
    const clubsOverall = stats?.clubsOverall ?? [];

    // mapa de overall por clubId
    const overallByClub = useMemo(() => {
        const m = new Map<number, ClubOverallRow>();
        for (const o of clubsOverall) m.set(o.clubId, o);
        return m;
    }, [clubsOverall]);

    // Ordena clubes mantendo o selecionado à esquerda
    const orderedClubs = useMemo(() => {
        if (!selectedClubId || clubs.length < 2) return clubs;
        const idx = clubs.findIndex((c) => c.clubId === selectedClubId);
        if (idx <= 0) return clubs;
        const clone = [...clubs];
        const [sel] = clone.splice(idx, 1);
        clone.unshift(sel);
        return clone;
    }, [clubs, selectedClubId]);

    // Auxiliares do placar
    const haveScore = orderedClubs.length >= 2;
    const goalsA = haveScore ? orderedClubs[0].totalGoals : undefined;
    const goalsB = haveScore ? orderedClubs[1].totalGoals : undefined;
    const scoreLabel = haveScore ? `${goalsA} x ${goalsB}` : null;
    const leftWon = haveScore && (goalsA ?? 0) > (goalsB ?? 0);
    const rightWon = haveScore && (goalsB ?? 0) > (goalsA ?? 0);

    const leftIsSelected = !!selectedClubId && orderedClubs[0]?.clubId === selectedClubId;
    const rightIsSelected = !!selectedClubId && orderedClubs[1]?.clubId === selectedClubId;

    // Identificar goleiro por clube (maior totalSaves > 0; desempate por avgRating e playerId)
    const gkByClub = useMemo(() => {
        const map = new Map<number, PlayerRow | undefined>();
        for (const club of clubs) {
            const pClub = players.filter(p => p.clubId === club.clubId && (p.totalSaves ?? 0) > 0);
            if (pClub.length === 0) {
                map.set(club.clubId, undefined);
            } else {
                pClub.sort((a, b) => {
                    const sDiff = (b.totalSaves ?? 0) - (a.totalSaves ?? 0);
                    if (sDiff !== 0) return sDiff;
                    const rDiff = (b.avgRating ?? 0) - (a.avgRating ?? 0);
                    if (rDiff !== 0) return rDiff;
                    return a.playerId - b.playerId;
                });
                map.set(club.clubId, pClub[0]);
            }
        }
        return map;
    }, [players, clubs]);

    const selectedMeta = useMemo(() => comparisonStats.find((s) => s.key === selectedStat) ?? comparisonStats[0], [selectedStat]);

    // Chart jogadores
    const playerChart = useMemo(() => {
        const base = onlySelectedClubPlayers && selectedClubId
            ? players.filter((p) => p.clubId === selectedClubId)
            : players;

        const filtered = playerQuery.trim()
            ? base.filter((p) => p.playerName.toLowerCase().includes(playerQuery.toLowerCase()))
            : base;

        const playerSupportsSelected =
            filtered.some((p) => Object.prototype.hasOwnProperty.call(p, selectedStat) && typeof (p as any)[selectedStat] === "number");

        const rows = filtered.map((p) => ({
            label: p.playerName,
            value: playerSupportsSelected ? ((p as any)[selectedStat] as number) : undefined,
            color: colorFromId(p.playerId),
        }));

        const top = rows
            .filter((r) => typeof r.value === "number" && !Number.isNaN(r.value))
            .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
            .slice(0, 20);

        return {
            supported: playerSupportsSelected,
            top,
            data: {
                labels: top.map((r) => r.label),
                datasets: [
                    {
                        label: "Jogadores",
                        data: top.map((r) => r.value),
                        backgroundColor: top.map((r) => r.color),
                        borderColor: top.map((r) => r.color),
                        borderWidth: 1,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: "y" as const,
                plugins: {
                    legend: { display: false },
                    title: {
                        display: true,
                        text: onlySelectedClubPlayers ? "Comparativo de Jogadores (apenas clube selecionado)" : "Comparativo de Jogadores",
                    },
                    tooltip: {
                        callbacks: { label: (item: any) => `${item.raw}` },
                    },
                },
                scales: { x: { beginAtZero: true } },
                elements: { bar: { borderWidth: 1, barThickness: 12 } },
            },
        };
    }, [players, selectedStat, onlySelectedClubPlayers, selectedClubId, playerQuery]);

    // Chart clubes
    const clubChart = useMemo(() => {
        if (orderedClubs.length < 2) return null;
        const a = orderedClubs[0];
        const b = orderedClubs[1];
        const key = selectedStat;

        const label = comparisonStats.find((c) => c.key === key)?.label ?? "Estatística";
        const va = (a as any)[key] as number;
        const vb = (b as any)[key] as number;

        return {
            data: {
                labels: [label],
                datasets: [
                    {
                        label: a.clubName,
                        data: [va ?? 0],
                        backgroundColor: "#4F46E5",
                        borderColor: "#4F46E5",
                    },
                    {
                        label: b.clubName,
                        data: [vb ?? 0],
                        backgroundColor: "#10B981",
                        borderColor: "#10B981",
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: "y" as const,
                plugins: { title: { display: true, text: `Clubes - ${label}` } },
                scales: { x: { beginAtZero: true } },
                elements: { bar: { borderWidth: 2, barThickness: 18 } },
            },
        };
    }, [orderedClubs, selectedStat]);

    // Ordenação e filtro de jogadores por clube
    const sortPlayers = useCallback((list: PlayerRow[]) => {
        const copy = [...list];
        copy.sort((a, b) => {
            const va = (a as any)[sortKey] ?? (sortKey === "playerName" ? a.playerName : 0);
            const vb = (b as any)[sortKey] ?? (sortKey === "playerName" ? b.playerName : 0);
            if (typeof va === "string" && typeof vb === "string") {
                return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
            }
            const numA = Number(va) || 0; const numB = Number(vb) || 0;
            return sortDir === "asc" ? numA - numB : numB - numA;
        });
        return copy;
    }, [sortKey, sortDir]);

    const playersByClub = useMemo(() => {
        const map = new Map<number, PlayerRow[]>();
        for (const p of players) {
            if (playerQuery && !p.playerName.toLowerCase().includes(playerQuery.toLowerCase())) continue;
            const arr = map.get(p.clubId) ?? [];
            arr.push(p);
            map.set(p.clubId, arr);
        }
        for (const [k, list] of map) map.set(k, sortPlayers(list));
        return map;
    }, [players, playerQuery, sortPlayers]);

    const cellHeat = (va?: number, vb?: number) => {
        const a = Number(va ?? 0); const b = Number(vb ?? 0);
        if (a === b) return { a: "", b: "" };
        return a > b
            ? { a: "bg-emerald-50 font-semibold", b: "bg-red-50" }
            : { a: "bg-red-50", b: "bg-emerald-50 font-semibold" };
    };

    const mom = (stats?.players ?? []).find((p) => (p.totalMom ?? 0) > 0);
    const sentOff = (stats?.players ?? []).filter((p) => (p.totalRedCards ?? 0) > 0);

    if (loading) {
        return (
            <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6" aria-busy>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <Skeleton className="h-7 w-52" />
                    <Skeleton className="h-5 w-24" />
                </div>
                <div className="bg-white shadow-sm rounded-xl p-4 border space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <Skeleton className="h-10 w-64" />
                        <Skeleton className="h-6 w-16" />
                        <Skeleton className="h-10 w-64" />
                    </div>
                    <Skeleton className="h-48" />
                </div>
                <Skeleton className="h-48" />
                <Skeleton className="h-72" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-4">
                <div className="max-w-xl rounded-lg border p-4 bg-red-50 text-red-800">
                    <div className="font-semibold">Ocorreu um erro</div>
                    <div className="text-sm mt-1">{error}</div>
                    <div className="mt-3">
                        <Button onClick={fetchData}>Tentar novamente</Button>
                    </div>
                </div>
            </div>
        );
    }

    if (!stats || orderedClubs.length === 0) {
        return <div className="p-4">Dados indisponíveis.</div>;
    }

    return (
        <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
            {/* Topo */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <h1 className="text-2xl font-bold">Detalhes da Partida</h1>
                <div className="flex items-center gap-2">
                    <Link to="/" className="text-blue-700 hover:underline">← Voltar</Link>
                </div>
            </div>

            {/* Painel Overall (toggle) */}
            <div className="bg-white shadow-sm rounded-xl p-4 border">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold">Resumo histórico (Overall)</h2>
                    <Button onClick={() => setShowOverallPanel((v) => !v)}>
                        {showOverallPanel ? "Minimizar" : "Maximizar"}
                    </Button>
                </div>

                {showOverallPanel && (
                    <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                        {orderedClubs.slice(0, 2).map((c) => {
                            const o = overallByClub.get(c.clubId);
                            const wins = toNum(o?.wins);
                            const draws = toNum(o?.ties);
                            const losses = toNum(o?.losses);
                            const games = toNum(o?.gamesPlayed);
                            const goalsFor = toNum(o?.goals);
                            const goalsAgainst = toNum(o?.goalsAgainst);
                            const winPct = games > 0 ? (wins * 100) / games : 0;

                            const divUrl = divisionCrestUrl(o?.bestDivision);
                            const repUrl = reputationTierUrl(o?.reputationtier);

                            // rótulos
                            const repKey = asNonNegativeIntString(o?.reputationtier) ?? "0";
                            const repLabel = REPUTATION_LABELS[repKey] ?? (o?.reputationtier ?? "–");

                            const highestKey = asNonNegativeIntString(o?.bestFinishGroup) ?? "6";
                            const highestLabel =
                                HIGHEST_PLACEMENT_LABELS[highestKey] ?? (o?.bestFinishGroup ?? "–");

                            // progress: reputation 0..3 (0=baixo, 3=alto)
                            const repNum = Number(repKey);
                            const repPct = Number.isFinite(repNum) ? (repNum / 3) * 100 : 0;

                            // progress: highestPlacement 1..6 (1=alto, 6=baixo) → invertido
                            const hpNum = Number(highestKey);
                            const hpPct = Number.isFinite(hpNum) ? ((6 - hpNum) / 5) * 100 : 0;

                            return (
                                <div key={c.clubId} className="rounded-lg border p-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <img
                                                src={crestUrl(c.clubCrestAssetId)}
                                                onError={(e) => ((e.currentTarget.src = FALLBACK_LOGO))}
                                                alt={`Escudo ${c.clubName}`}
                                                className="w-8 h-8 rounded-full bg-white border"
                                            />
                                            <div className="font-semibold">{c.clubName}</div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {o?.updatedAtUtc && (
                                                <span className="text-xs text-gray-500">
                                                    Atualizado: {new Date(o.updatedAtUtc).toLocaleString()}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                                        {/* Skill + Reputation/Division logos */}
                                        <div className="p-2 rounded border">
                                            {/* Título + progress minúscula */}
                                            <div className="text-gray-500">Skill Rating</div>
                                            <TinyBar pct={repPct} className="mt-1" title={`Reputation: ${repLabel}`} />
                                            <div className="mt-1 flex items-start justify-between gap-3">
                                                <div>
                                                    <div className="font-semibold">{o?.skillRating ?? "–"}</div>
                                                </div>
                                                <div className="flex flex-col items-center min-w-[48px]">
                                                    {repUrl && (
                                                        <img
                                                            src={repUrl}
                                                            alt={`Reputação ${repKey ?? ""}`}
                                                            className="w-10 h-10 object-contain"
                                                        />
                                                    )}
                                                    <div className="mt-1 text-[11px] leading-tight text-gray-600 text-center">
                                                        {repLabel}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="p-2 rounded border">
                                            <div className="text-gray-500">Melhor Divisão</div>
                                            <TinyBar pct={hpPct} className="mt-1" title={`Placement: ${highestLabel}`} />
                                            <div className="mt-1 flex items-start justify-between gap-3">
                                                <div>
                                                    <div className="font-semibold">{highestLabel}</div>
                                                </div>
                                                <div className="flex flex-col items-center min-w-[48px]">
                                                    {divUrl && (
                                                        <img
                                                            src={divUrl}
                                                            alt={`Divisão ${o?.bestDivision ?? ""}`}
                                                            className="w-10 h-10 object-contain"
                                                        />
                                                    )}
                                                    <div className="mt-1 text-[11px] leading-tight text-gray-600 text-center">
                                                        {highestLabel}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="p-2 rounded border">
                                            <div className="text-gray-500">Jogos (Total / Liga / Playoff)</div>
                                            <div className="font-semibold">
                                                {games}{' / '}{toNum(o?.leagueAppearances)}{' / '}{toNum(o?.gamesPlayedPlayoff)}
                                            </div>
                                        </div>
                                        <div className="p-2 rounded border">
                                            <div className="text-gray-500">V / E / D</div>
                                            <div className="font-semibold">
                                                {wins}-{draws}-{losses}{" "}
                                                <span className="text-gray-500 ml-1">
                                                    ({(Math.round(winPct * 100) / 100).toFixed(2)}%)
                                                </span>
                                            </div>
                                        </div>
                                        <div className="p-2 rounded border">
                                            <div className="text-gray-500">Gols (Feitos / Levados)</div>
                                            <div className="font-semibold">
                                                {goalsFor} / {goalsAgainst}
                                            </div>
                                        </div>

                                        <div className="p-2 rounded border">
                                            <div className="text-gray-500">Promoções</div>
                                            <div className="font-semibold">{toNum(o?.promotions)}</div>
                                        </div>
                                        <div className="p-2 rounded border">
                                            <div className="text-gray-500">Rebaixamentos</div>
                                            <div className="font-semibold">{toNum(o?.relegations)}</div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Cabeçalho dos clubes + placar e highlights */}
            <div className="bg-white shadow-sm rounded-xl p-4 border">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    {/* Esquerda */}
                    <div className={`flex items-center gap-2 px-2 py-1 rounded ${leftIsSelected ? "border-2 border-blue-600" : ""}`}>
                        <img
                            src={crestUrl(orderedClubs[0]?.clubCrestAssetId)}
                            onError={(e) => ((e.currentTarget.src = FALLBACK_LOGO))}
                            alt={`Escudo ${orderedClubs[0].clubName}`}
                            className="w-8 h-8 rounded-full bg-white border"
                        />
                        <div className="font-semibold flex items-center gap-2">
                            {orderedClubs[0].clubName}
                            {leftIsSelected && (
                                <Badge className="bg-blue-100 text-blue-700 border-blue-200">Clube selecionado</Badge>
                            )}
                            {leftWon && (
                                <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">Vitória</Badge>
                            )}
                            {!leftWon && haveScore && !rightWon && (
                                <Badge className="bg-gray-100 text-gray-700">Empate</Badge>
                            )}
                        </div>
                    </div>

                    {/* Placar */}
                    <div className="text-lg sm:text-xl font-bold text-gray-900">{scoreLabel}</div>

                    {/* Direita */}
                    <div className={`flex items-center gap-2 px-2 py-1 rounded ${rightIsSelected ? "border-2 border-blue-600" : ""}`}>
                        <div className="font-semibold flex items-center gap-2">
                            {orderedClubs[1].clubName}
                            {rightIsSelected && (
                                <Badge className="bg-blue-100 text-blue-700 border-blue-200">Clube selecionado</Badge>
                            )}
                            {rightWon && (
                                <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">Vitória</Badge>
                            )}
                        </div>
                        <img
                            src={crestUrl(orderedClubs[1]?.clubCrestAssetId)}
                            onError={(e) => ((e.currentTarget.src = FALLBACK_LOGO))}
                            alt={`Escudo ${orderedClubs[1].clubName}`}
                            className="w-8 h-8 rounded-full bg-white border"
                        />
                    </div>
                </div>

                {/* Tabela comparativa com heat */}
                <div className="overflow-x-auto mt-4">
                    <table className="w-full table-auto text-xs sm:text-sm border text-center">
                        <thead>
                            <tr className="bg-gray-50">
                                <th className="p-1.5 sm:p-2">{orderedClubs[0].clubName}</th>
                                <th className="p-1.5 sm:p-2">Estatística</th>
                                <th className="p-1.5 sm:p-2">{orderedClubs[1].clubName}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {comparisonStats.map(({ label, key }) => {
                                const va = (orderedClubs[0] as any)[key] as number;
                                const vb = (orderedClubs[1] as any)[key] as number;
                                const heat = cellHeat(va, vb);
                                return (
                                    <tr key={String(key)} className="border-t">
                                        <td className={`p-2 tabular-nums ${heat.a}`}>{fmt(va)}</td>
                                        <td className="p-2 font-medium">{label}</td>
                                        <td className={`p-2 tabular-nums ${heat.b}`}>{fmt(vb)}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* MVP */}
                {mom && (
                    <div className="mt-4 p-3 rounded-lg border bg-amber-50 text-amber-900 inline-flex items-center gap-2">
                        <span aria-hidden>⭐</span>
                        <span className="font-medium">Homem da Partida:</span>
                        <span>{mom.playerName}</span>
                    </div>
                )}
            </div>

            {/* Disciplina */}
            <div className="bg-white shadow-sm rounded-xl p-4 border">
                <h2 className="text-lg font-semibold mb-2">Disciplina</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3 rounded border">
                        <div className="text-sm text-gray-500 mb-1">{orderedClubs[0].clubName}</div>
                        <div className="inline-flex items-center gap-2">
                            <span className="inline-block w-3 h-5 rounded-[2px] bg-red-600" />
                            <span className="tabular-nums font-semibold">{orderedClubs[0].totalRedCards ?? 0}</span>
                        </div>
                    </div>
                    <div className="p-3 rounded border">
                        <div className="text-sm text-gray-500 mb-1">{orderedClubs[1].clubName}</div>
                        <div className="inline-flex items-center gap-2">
                            <span className="inline-block w-3 h-5 rounded-[2px] bg-red-600" />
                            <span className="tabular-nums font-semibold">{orderedClubs[1].totalRedCards ?? 0}</span>
                        </div>
                    </div>
                </div>

                {sentOff.length > 0 ? (
                    <div className="mt-3 text-sm">
                        <div className="font-medium mb-1">Expulsos:</div>
                        <ul className="list-disc pl-5 space-y-1">
                            {sentOff.map((p) => (
                                <li key={p.playerId}>
                                    <span className="font-medium">{p.playerName}</span>
                                    <span className="text-gray-500">
                                        {" "}
                                        - {orderedClubs.find((c) => c.clubId === p.clubId)?.clubName ?? "Clube"}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </div>
                ) : (
                    <div className="mt-3 text-sm text-gray-600">Nenhum jogador expulso.</div>
                )}
            </div>

            {/* Controles de gráficos */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-700">Estatística:</label>
                    <select
                        value={selectedStat}
                        onChange={(e) => setSelectedStat(e.target.value as StatKey)}
                        className="border rounded px-2 py-1 text-sm w-full sm:w-auto"
                    >
                        {comparisonStats.map((s) => (
                            <option key={String(s.key)} value={s.key as string}>
                                {s.label}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="flex items-center gap-3">
                    <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                        <input
                            type="checkbox"
                            checked={onlySelectedClubPlayers}
                            onChange={(e) => setOnlySelectedClubPlayers(e.target.checked)}
                            disabled={!selectedClubId}
                        />
                        Mostrar apenas jogadores do clube selecionado
                    </label>
                    <input
                        type="text"
                        value={playerQuery}
                        onChange={(e) => setPlayerQuery(e.target.value)}
                        placeholder="Filtrar por jogador…"
                        className="border rounded px-2 py-1 text-sm w-full sm:w-auto"
                    />
                </div>
            </div>

            {/* Gráficos */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* Clubes */}
                <div className="bg-white shadow-sm rounded-xl p-4 border h-[200px] sm:h-[240px] md:h-[260px] xl:col-span-1">
                    <h2 className="text-lg font-semibold mb-2">Comparativo entre Clubes</h2>
                    {clubChart && <Bar data={clubChart.data} options={clubChart.options as any} />}
                </div>

                {/* Jogadores */}
                <div className="bg-white shadow-sm rounded-xl p-4 border min-h-[200px] xl:col-span-2">
                    <div className="flex items-center justify-between mb-2">
                        <h2 className="text-lg font-semibold">Comparativo de Jogadores</h2>
                    </div>
                    {!playerChart.supported ? (
                        <div className="p-3 text-sm text-gray-600">
                            Esta estatística não é suportada por jogadores. Selecione uma métrica de jogadores (ex.: Gols, Assistências, Passes…) para ver o gráfico.
                        </div>
                    ) : (
                        <div className="h-[300px] sm:h-[340px] md:h-[360px]">
                            <Bar data={playerChart.data} options={playerChart.options as any} />
                        </div>
                    )}
                </div>
            </div>

            {/* Tabelas de jogadores por clube */}
            {orderedClubs.map((clubRow) => {
                const gk = gkByClub.get(clubRow.clubId);
                const clubPlayers = playersByClub.get(clubRow.clubId) ?? [];
                return (
                    <div key={clubRow.clubId} className="bg-white shadow-sm rounded-xl p-4 border">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-lg font-semibold">{clubRow.clubName} - Jogadores</h3>
                            <div className="flex items-center gap-2 text-sm">
                                <label className="text-gray-700">Ordenar por:</label>
                                <select
                                    value={sortKey}
                                    onChange={(e) => setSortKey(e.target.value as PlayerSortKey)}
                                    className="border rounded px-2 py-1 text-sm w-full md:w-auto"
                                >
                                    <option value="playerName">Nome</option>
                                    <option value="totalGoals">Gols</option>
                                    <option value="totalAssists">Assistências</option>
                                    <option value="totalShots">Chutes</option>
                                    <option value="goalAccuracyPercent">Chutes %</option>
                                    <option value="totalPassesMade">Passes</option>
                                    <option value="totalPassAttempts">Tentativas de Passe</option>
                                    <option value="passAccuracyPercent">Passes %</option>
                                    <option value="totalTacklesMade">Desarmes</option>
                                    <option value="totalTackleAttempts">Tentativas de Desarme</option>
                                    <option value="tackleSuccessPercent">Desarmes %</option>
                                    <option value="totalRedCards">Vermelhos</option>
                                    <option value="totalSaves">Defesas (GK)</option>
                                    <option value="totalCleanSheets">Clean Sheets</option>
                                    <option value="avgRating">Nota</option>
                                </select>
                                <select
                                    value={sortDir}
                                    onChange={(e) => setSortDir(e.target.value as "asc" | "desc")}
                                    className="border rounded px-2 py-1 text-sm w-full md:w-auto"
                                >
                                    <option value="desc">Desc</option>
                                    <option value="asc">Asc</option>
                                </select>
                            </div>
                        </div>

                        {/* Lista mobile */}
                        <div className="md:hidden grid gap-3">
                            {clubPlayers.map((p) => {
                                const isGK = gk?.playerId === p.playerId;
                                return (
                                    <div key={p.playerId} className="rounded-lg border p-3 bg-white">
                                        <div className="flex items-center justify-between">
                                            <Link className="text-blue-700 underline font-medium" to={`/statistics/player/${matchId}/${p.playerId}`}>
                                                {p.playerName}
                                            </Link>
                                            <div className="flex items-center gap-2">
                                                {isGK && <span title="Goleiro">🧤</span>}
                                                {p.totalMom > 0 && <span title="Homem da Partida">⭐</span>}
                                            </div>
                                        </div>
                                        <div className="mt-2 grid grid-cols-2 gap-2">
                                            <div className="flex items-center justify-between text-sm"><span className="text-gray-500">Gols</span><span className="tabular-nums font-medium">{p.totalGoals}</span></div>
                                            <div className="flex items-center justify-between text-sm"><span className="text-gray-500">Assist.</span><span className="tabular-nums font-medium">{p.totalAssists}</span></div>
                                            <div className="flex items-center justify-between text-sm"><span className="text-gray-500">Chutes</span><span className="tabular-nums font-medium">{p.totalShots}</span></div>
                                            <div className="flex items-center justify-between text-sm"><span className="text-gray-500">Chutes %</span><span className="tabular-nums font-medium">{fmt(p.goalAccuracyPercent)}</span></div>
                                            <div className="flex items-center justify-between text-sm"><span className="text-gray-500">Passes</span><span className="tabular-nums font-medium">{p.totalPassesMade}</span></div>
                                            <div className="flex items-center justify-between text-sm"><span className="text-gray-500">Passes %</span><span className="tabular-nums font-medium">{fmt(p.passAccuracyPercent)}</span></div>
                                            <div className="flex items-center justify-between text-sm"><span className="text-gray-500">Desarmes</span><span className="tabular-nums font-medium">{p.totalTacklesMade}</span></div>
                                            <div className="flex items-center justify-between text-sm"><span className="text-gray-500">Desarmes %</span><span className="tabular-nums font-medium">{fmt(p.tackleSuccessPercent)}</span></div>
                                            <div className="flex items-center justify-between text-sm"><span className="text-gray-500">Clean Sheets</span><span className="tabular-nums font-medium">{p.totalCleanSheets ?? 0}</span></div>
                                            <div className="flex items-center justify-between text-sm"><span className="text-gray-500">Defesas (GK)</span><span className="tabular-nums font-medium">{p.totalSaves ?? 0}</span></div>
                                            <div className="flex items-center justify-between text-sm"><span className="text-gray-500">Vermelhos</span><span className="tabular-nums font-medium">{p.totalRedCards ?? 0}</span></div>
                                            <div className="flex items-center justify-between text-sm"><span className="text-gray-500">Nota</span><span className="tabular-nums font-medium">{(p.avgRating ?? 0).toFixed(2)}</span></div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Tabela desktop */}
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full table-auto text-xs sm:text-sm border text-center">
                                <thead>
                                    <tr className="bg-gray-50">
                                        <th className="p-2 text-left">Jogador</th>
                                        <th className="p-1.5 sm:p-2">Gols</th>
                                        <th className="p-1.5 sm:p-2">Assistências</th>
                                        <th className="p-1.5 sm:p-2">Chutes</th>
                                        <th className="p-1.5 sm:p-2">Chutes %</th>
                                        <th className="p-1.5 sm:p-2">Passes</th>
                                        <th className="p-1.5 sm:p-2">Tentativas</th>
                                        <th className="p-1.5 sm:p-2">Passes %</th>
                                        <th className="p-1.5 sm:p-2">Desarmes</th>
                                        <th className="p-1.5 sm:p-2">Tentativas</th>
                                        <th className="p-1.5 sm:p-2">Desarmes %</th>
                                        <th className="p-1.5 sm:p-2">Clean Sheets</th>
                                        <th className="p-1.5 sm:p-2">Defesas (GK)</th>
                                        <th className="p-1.5 sm:p-2">Vermelhos</th>
                                        <th className="p-1.5 sm:p-2">Nota</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {clubPlayers.map((p) => {
                                        const isGK = gk?.playerId === p.playerId;
                                        return (
                                            <tr key={p.playerId} className={`border-t ${p.totalMom > 0 ? "bg-amber-50" : ""}`}>
                                                <td className="p-2 text-left">
                                                    <div className="flex items-center justify-between">
                                                        <Link className="text-blue-700 underline" to={`/statistics/player/${matchId}/${p.playerId}`}>
                                                            {p.playerName}
                                                        </Link>
                                                        <span className="inline-flex items-center gap-1">
                                                            {isGK && <span title="Goleiro">🧤</span>}
                                                            {p.totalMom > 0 && <span title="Homem da Partida">⭐</span>}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="p-2 tabular-nums">{p.totalGoals}</td>
                                                <td className="p-2 tabular-nums">{p.totalAssists}</td>
                                                <td className="p-2 tabular-nums">{p.totalShots}</td>
                                                <td className="p-2 tabular-nums">{fmt(p.goalAccuracyPercent)}</td>
                                                <td className="p-2 tabular-nums">{p.totalPassesMade}</td>
                                                <td className="p-2 tabular-nums">{p.totalPassAttempts}</td>
                                                <td className="p-2 tabular-nums">{fmt(p.passAccuracyPercent)}</td>
                                                <td className="p-2 tabular-nums">{p.totalTacklesMade}</td>
                                                <td className="p-2 tabular-nums">{p.totalTackleAttempts}</td>
                                                <td className="p-2 tabular-nums">{fmt(p.tackleSuccessPercent)}</td>
                                                <td className="p-2 tabular-nums">{p.totalCleanSheets ?? 0}</td>
                                                <td className="p-2 tabular-nums">{p.totalSaves ?? 0}</td>
                                                <td className="p-2 tabular-nums">{p.totalRedCards ?? 0}</td>
                                                <td className="p-2 tabular-nums">{(p.avgRating ?? 0).toFixed(2)}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
