import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
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
// Tipos (espelham /api/Matches/statistics/{matchId})
// ======================
interface PlayerRow {
    playerId: number;
    playerName: string;
    clubId: number;
    totalGoals: number;
    totalAssists: number;
    totalShots: number;
    goalAccuracyPercent: number;
    totalPassesMade: number;
    totalPassAttempts: number;
    passAccuracyPercent: number;
    totalTacklesMade: number;
    totalTackleAttempts: number;
    tackleSuccessPercent: number;
    avgRating: number;
}

interface ClubRow {
    clubId: number;
    clubName: string;
    clubCrestAssetId?: string | null;
    matchesPlayed: number;
    totalGoals: number;
    totalAssists: number;
    totalShots: number;
    goalAccuracyPercent: number;
    totalPassesMade: number;
    totalPassAttempts: number;
    passAccuracyPercent: number;
    totalTacklesMade: number;
    totalTackleAttempts: number;
    tackleSuccessPercent: number;
    avgRating: number;
}

interface FullMatchStatisticsDto {
    overall: any;
    players: PlayerRow[];
    clubs: ClubRow[];
}

// ======================
// Helpers
// ======================
const FALLBACK_LOGO = "https://via.placeholder.com/96?text=Logo";
const crestUrl = (id?: string | null) =>
    id
        ? `https://eafc24.content.easports.com/fifa/fltOnlineAssets/24B23FDE-7835-41C2-87A2-F453DFDB2E82/2024/fcweb/crests/256x256/l${id}.png`
        : FALLBACK_LOGO;

// cor determinística baseada no id (evita flicker)
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

const comparisonStats = [
    { label: "Gols", key: "totalGoals" as const },
    { label: "Assistências", key: "totalAssists" as const },
    { label: "Chutes", key: "totalShots" as const },
    { label: "Precisão de Chutes (%)", key: "goalAccuracyPercent" as const },
    { label: "Passes Certos", key: "totalPassesMade" as const },
    { label: "Passes Tentados", key: "totalPassAttempts" as const },
    { label: "Precisão de Passe (%)", key: "passAccuracyPercent" as const },
    { label: "Desarmes Certos", key: "totalTacklesMade" as const },
    { label: "Desarmes Tentados", key: "totalTackleAttempts" as const },
    { label: "Precisão de Desarmes (%)", key: "tackleSuccessPercent" as const },
    { label: "Nota Média", key: "avgRating" as const },
];

type StatKey = (typeof comparisonStats)[number]["key"];

function fmt(value: number | undefined | null) {
    if (value === undefined || value === null) return "–";
    return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

// ======================
export default function MatchDetails() {
    const { matchId } = useParams();
    const { club } = useClub(); // <- clube selecionado no menu (contexto)
    const selectedClubId = club?.clubId ?? null;

    const [stats, setStats] = useState<FullMatchStatisticsDto | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [selectedStat, setSelectedStat] = useState<StatKey>("totalGoals");
    const [onlySelectedClubPlayers, setOnlySelectedClubPlayers] = useState<boolean>(false);

    useEffect(() => {
        if (!matchId) return;
        let cancel = false;
        (async () => {
            try {
                setLoading(true);
                setError(null);
                const { data } = await api.get<FullMatchStatisticsDto>(
                    `https://eafctracker-cvadcceuerbgegdj.brazilsouth-01.azurewebsites.net/api/Matches/statistics/${matchId}`
                );
                if (!cancel) setStats(data);
            } catch (err: any) {
                if (!cancel) setError(err?.message ?? "Erro ao buscar estatísticas");
            } finally {
                if (!cancel) setLoading(false);
            }
        })();
        return () => {
            cancel = true;
        };
    }, [matchId]);

    const players = stats?.players ?? [];
    const clubs = stats?.clubs ?? [];

    // Ordena clubes mantendo o selecionado (se existir) à esquerda
    const orderedClubs = useMemo(() => {
        if (!selectedClubId || clubs.length < 2) return clubs;
        const idx = clubs.findIndex(c => c.clubId === selectedClubId);
        if (idx <= 0) return clubs;
        const clone = [...clubs];
        const [sel] = clone.splice(idx, 1);
        clone.unshift(sel);
        return clone;
    }, [clubs, selectedClubId]);

    // ======================
    // Chart de jogadores (horizontal)
    // ======================
    const playerChart = useMemo(() => {
        const base = onlySelectedClubPlayers && selectedClubId
            ? players.filter(p => p.clubId === selectedClubId)
            : players;

        const rows = base.map((p) => ({
            label: p.playerName,
            value: (p as any)[selectedStat] as number,
            color: colorFromId(p.playerId),
        }));

        const top = rows
            .filter((r) => typeof r.value === "number" && !Number.isNaN(r.value))
            .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
            .slice(0, 20);

        return {
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
                        callbacks: {
                            label: (item: any) => `${item.raw}`,
                        },
                    },
                },
                scales: { x: { beginAtZero: true } },
                elements: { bar: { borderWidth: 1, barThickness: 12 } },
            },
        };
    }, [players, selectedStat, onlySelectedClubPlayers, selectedClubId]);

    // ======================
    // Chart de clubes (horizontal) — somente para a estatística selecionada
    // ======================
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
                plugins: { title: { display: true, text: `Clubes — ${label}` } },
                scales: { x: { beginAtZero: true } },
                elements: { bar: { borderWidth: 2, barThickness: 18 } },
            },
        };
    }, [orderedClubs, selectedStat]);

    if (loading) return <div className="p-4">Carregando…</div>;
    if (error) return <div className="p-4 text-red-600">{error}</div>;
    if (!stats || orderedClubs.length === 0) return <div className="p-4">Dados indisponíveis.</div>;

    // flags de destaque
    const leftIsSelected = selectedClubId && orderedClubs[0]?.clubId === selectedClubId;
    const rightIsSelected = selectedClubId && orderedClubs[1]?.clubId === selectedClubId;

    return (
        <div className="p-4 space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">Detalhes da Partida</h1>
                <Link to="/" className="text-blue-700 hover:underline">← Voltar</Link>
            </div>

            {/* Cabeçalho dos clubes */}
            <div className="bg-white shadow-sm rounded-xl p-4 border">
                <div className="flex items-center justify-between">
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
                                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200">
                                    Clube selecionado
                                </span>
                            )}
                        </div>
                    </div>
                    <div className="text-sm text-gray-500">vs</div>
                    <div className={`flex items-center gap-2 px-2 py-1 rounded ${rightIsSelected ? "border-2 border-blue-600" : ""}`}>
                        <div className="font-semibold flex items-center gap-2">
                            {orderedClubs[1].clubName}
                            {rightIsSelected && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200">
                                    Clube selecionado
                                </span>
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

                {/* Tabela comparativa simples */}
                <div className="overflow-x-auto mt-4">
                    <table className="w-full table-auto text-sm border text-center">
                        <thead>
                            <tr className="bg-gray-50">
                                <th className="p-2">{orderedClubs[0].clubName}</th>
                                <th className="p-2">Estatística</th>
                                <th className="p-2">{orderedClubs[1].clubName}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {comparisonStats.map(({ label, key }) => (
                                <tr key={key} className="border-t">
                                    <td className="p-2">{fmt((orderedClubs[0] as any)[key])}</td>
                                    <td className="p-2 font-medium">{label}</td>
                                    <td className="p-2">{fmt((orderedClubs[1] as any)[key])}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Controles de gráficos */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-700">Estatística:</label>
                    <select
                        value={selectedStat}
                        onChange={(e) => setSelectedStat(e.target.value as StatKey)}
                        className="border rounded px-2 py-1 text-sm"
                    >
                        {comparisonStats.map((s) => (
                            <option key={s.key} value={s.key}>{s.label}</option>
                        ))}
                    </select>
                </div>

                <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                    <input
                        type="checkbox"
                        checked={onlySelectedClubPlayers}
                        onChange={(e) => setOnlySelectedClubPlayers(e.target.checked)}
                        disabled={!selectedClubId}
                    />
                    Mostrar apenas jogadores do clube selecionado
                </label>
            </div>

            {/* Gráficos */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Clubes */}
                <div className="bg-white shadow-sm rounded-xl p-4 border h-[260px]">
                    <h2 className="text-lg font-semibold mb-2">Comparativo entre Clubes</h2>
                    {clubChart && <Bar data={clubChart.data} options={clubChart.options as any} />}
                </div>

                {/* Jogadores */}
                <div className="bg-white shadow-sm rounded-xl p-4 border h-[360px]">
                    <h2 className="text-lg font-semibold mb-2">Comparativo de Jogadores</h2>
                    <Bar data={playerChart.data} options={playerChart.options as any} />
                </div>
            </div>

            {/* Tabelas de jogadores por clube */}
            {orderedClubs.map((club) => (
                <div key={club.clubId} className="bg-white shadow-sm rounded-xl p-4 border">
                    <h3 className="text-lg font-semibold mb-2">{club.clubName} — Jogadores</h3>
                    <div className="overflow-x-auto">
                        <table className="w-full table-auto text-sm border text-center">
                            <thead>
                                <tr className="bg-gray-50">
                                    <th className="p-2 text-left">Jogador</th>
                                    <th className="p-2">Gols</th>
                                    <th className="p-2">Assistências</th>
                                    <th className="p-2">Chutes</th>
                                    <th className="p-2">Chutes %</th>
                                    <th className="p-2">Passes</th>
                                    <th className="p-2">Tentativas</th>
                                    <th className="p-2">Passes %</th>
                                    <th className="p-2">Desarmes</th>
                                    <th className="p-2">Tentativas</th>
                                    <th className="p-2">Desarmes %</th>
                                    <th className="p-2">Nota</th>
                                </tr>
                            </thead>
                            <tbody>
                                {players
                                    .filter((p) => p.clubId === club.clubId)
                                    .map((p) => (
                                        <tr key={p.playerId} className="border-t">
                                            <td className="p-2 text-left text-blue-700 underline">
                                                <Link to={`/statistics/player/${matchId}/${p.playerId}`}>{p.playerName}</Link>
                                            </td>
                                            <td className="p-2">{p.totalGoals}</td>
                                            <td className="p-2">{p.totalAssists}</td>
                                            <td className="p-2">{p.totalShots}</td>
                                            <td className="p-2">{fmt(p.goalAccuracyPercent)}</td>
                                            <td className="p-2">{p.totalPassesMade}</td>
                                            <td className="p-2">{p.totalPassAttempts}</td>
                                            <td className="p-2">{fmt(p.passAccuracyPercent)}</td>
                                            <td className="p-2">{p.totalTacklesMade}</td>
                                            <td className="p-2">{p.totalTackleAttempts}</td>
                                            <td className="p-2">{fmt(p.tackleSuccessPercent)}</td>
                                            <td className="p-2">{p.avgRating.toFixed(2)}</td>
                                        </tr>
                                    ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ))}
        </div>
    );
}
