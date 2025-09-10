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
// Tipos (espelham /api/Matches/statistics/{matchId})
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
    totalMom: number; // homem do jogo

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

interface FullMatchStatisticsDto {
    overall: OverallRow;
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

function fmt(value: number | undefined | null) {
    if (value === undefined || value === null) return "–";
    return Number.isInteger(value)
        ? String(value)
        : (Math.round((value as number) * 100) / 100).toFixed(2);
}

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

// Cartão de jogador (mobile)
const StatItem: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
    <div className="flex items-center justify-between text-sm">
        <span className="text-gray-500">{label}</span>
        <span className="tabular-nums font-medium">{value}</span>
    </div>
);

const PlayerMobileCard: React.FC<{ p: PlayerRow; matchId?: string }> = ({ p, matchId }) => (
    <div className="rounded-lg border p-3 bg-white">
        <div className="flex items-center justify-between">
            <Link className="text-blue-700 underline font-medium" to={`/statistics/player/${matchId}/${p.playerId}`}>{p.playerName}</Link>
            {p.totalMom > 0 && <span title="Homem da Partida">⭐</span>}
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
            <StatItem label="Gols" value={p.totalGoals} />
            <StatItem label="Assist." value={p.totalAssists} />
            <StatItem label="Chutes" value={p.totalShots} />
            <StatItem label="Chutes %" value={fmt(p.goalAccuracyPercent)} />
            <StatItem label="Passes" value={p.totalPassesMade} />
            <StatItem label="Passes %" value={fmt(p.passAccuracyPercent)} />
            <StatItem label="Desarmes" value={p.totalTacklesMade} />
            <StatItem label="Desarmes %" value={fmt(p.tackleSuccessPercent)} />
            <StatItem label="Vermelhos" value={p.totalRedCards ?? 0} />
            <StatItem label="Nota" value={(p.avgRating ?? 0).toFixed(2)} />
        </div>
    </div>
);


// ======================
export default function MatchDetails() {
    const { matchId } = useParams();
    const { club } = useClub(); // <- clube selecionado no menu (contexto)
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

    const overall = stats?.overall;
    const players = stats?.players ?? [];
    const clubs = stats?.clubs ?? [];

    // Ordena clubes mantendo o selecionado (se existir) à esquerda
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

    // flags de destaque
    const leftIsSelected = !!selectedClubId && orderedClubs[0]?.clubId === selectedClubId;
    const rightIsSelected = !!selectedClubId && orderedClubs[1]?.clubId === selectedClubId;

    // Qual é o escopo da estatística selecionada?
    const selectedMeta = useMemo(() => comparisonStats.find((s) => s.key === selectedStat) ?? comparisonStats[0], [selectedStat]);

    // ======================
    // Chart de jogadores (horizontal)
    // ======================
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

    // ======================
    // Chart de clubes (horizontal) - somente para a estatística selecionada
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
                plugins: { title: { display: true, text: `Clubes - ${label}` } },
                scales: { x: { beginAtZero: true } },
                elements: { bar: { borderWidth: 2, barThickness: 18 } },
            },
        };
    }, [orderedClubs, selectedStat]);

    // ======================
    // Ordenação e filtro de jogadores por clube
    // ======================
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

    // ======================
    // UI helpers
    // ======================
    const cellHeat = (va?: number, vb?: number) => {
        const a = Number(va ?? 0); const b = Number(vb ?? 0);
        if (a === b) return { a: "", b: "" };
        return a > b
            ? { a: "bg-emerald-50 font-semibold", b: "bg-red-50" }
            : { a: "bg-red-50", b: "bg-emerald-50 font-semibold" };
    };

    // MVP
    const mom = (stats?.players ?? []).find((p) => (p.totalMom ?? 0) > 0);
    const sentOff = (stats?.players ?? []).filter((p) => (p.totalRedCards ?? 0) > 0);

    // ============ Render ==========
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
        </div >
        <Skeleton className="h-48" />
        <Skeleton className="h-72" />
      </div >
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

      {/* Cabeçalho dos clubes + placar e highlights */ }
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

    {/* Direita */ }
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
        </div >

    {/* Tabela comparativa com heat */ }
    <div className="overflow-x-auto mt-4">
        <table className="w-full table-auto text-xs sm:text-sm border text-center">
            <thead>
                <tr className="bg-gray-50">
                    <th className="p-1.5 sm:p-2">{orderedClubs[0].clubName}</th>
                <th className="p-1.5 sm:p-2">Estatística</th>
            <th className="p-1.5 sm:p-2">{orderedClubs[1].clubName}</th>
    </tr>
            </thead >
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
          </table >
        </div >

        {/* MVP */ }
    {
        mom && (
            <div className="mt-4 p-3 rounded-lg border bg-amber-50 text-amber-900 inline-flex items-center gap-2">
                <span aria-hidden>⭐</span>
                <span className="font-medium">Homem da Partida:</span>
                <span>{mom.playerName}</span>
            </div>
        )
    }
      </div >

        {/* Disciplina */ }
        < div className = "bg-white shadow-sm rounded-xl p-4 border" >
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

    {
        sentOff.length > 0 ? (
            <div className="mt-3 text-sm">
                <div className="font-medium mb-1">Expulsos:</div>
                <ul className="list-disc pl-5 space-y-1">
                    {sentOff.map((p) => (
                        <li key={p.playerId}>
                            <span className="font-medium">{p.playerName}</span>
                            <span className="text-gray-500">
                                {" "}- {orderedClubs.find((c) => c.clubId === p.clubId)?.clubName ?? "Clube"}
                            </span>
                        </li>
                    ))}
                </ul>
            </div>
        ) : (
        <div className="mt-3 text-sm text-gray-600">Nenhum jogador expulso.</div>
    )
    }
      </div >

        {/* Controles de gráficos */ }
        < div className = "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between" >
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
        </div >

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
      </div >

        {/* Gráficos + Top 5 */ }
        < div className = "grid grid-cols-1 xl:grid-cols-3 gap-6" >
            {/* Clubes */ }
            < div className = "bg-white shadow-sm rounded-xl p-4 border h-[200px] sm:h-[240px] md:h-[260px] xl:col-span-1" >
                <h2 className="text-lg font-semibold mb-2">Comparativo entre Clubes</h2>
    { clubChart && <Bar data={clubChart.data} options={clubChart.options as any} /> }
        </div >

        {/* Jogadores */ }
        < div className = "bg-white shadow-sm rounded-xl p-4 border min-h-[200px] xl:col-span-2" >
            <div className="flex items-center justify-between mb-2">
                <h2 className="text-lg font-semibold">Comparativo de Jogadores</h2>
                {playerChart.supported && playerChart.top.length > 0 && (
                    <div className="text-xs text-gray-600">Top {playerChart.top.length} para "{selectedMeta.label}"</div>
                )}
            </div>
    {
        !playerChart.supported ? (
            <div className="p-3 text-sm text-gray-600">
                Esta estatística não é suportada por jogadores. Selecione uma métrica de jogadores (ex.: Gols, Assistências, Passes…) para ver o gráfico.
            </div>
        ) : (
        <div className="h-[300px] sm:h-[340px] md:h-[360px]">
            < Bar data = { playerChart.data } options = { playerChart.options as any } />
            </div >
          )
    }
        </div >
      </div >

        {/* Tabelas de jogadores por clube */ }
    {
        orderedClubs.map((clubRow) => (
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
          </div >

            <div className="md:hidden grid gap-3">
  {(playersByClub.get(clubRow.clubId) ?? []).map((p) => (
                <PlayerMobileCard key={p.playerId} p={p} matchId={matchId} />
            ))}
</div >

        <div className="hidden md:block overflow-x-auto">
            < table className = "w-full table-auto text-xs sm:text-sm border text-center" >
              <thead>
                <tr className="bg-gray-50">
                  <th className="p-2 text-left">Jogador</th>
                  <th className="p-1.5 sm:p-2">Gols</th>
                  <th className="p-1.5 sm:p-2">Assistências</th>
                  <th className="p-1.5 sm:p-2">Chutes</th>
        < th className ="p-1.5 sm:p-2">Chutes %</th>
            < th className ="p-1.5 sm:p-2">Passes</th>
                < th className ="p-1.5 sm:p-2">Tentativas</th>
                    < th className ="p-1.5 sm:p-2">Passes %</th>
                        < th className ="p-1.5 sm:p-2">Desarmes</th>
                            < th className ="p-1.5 sm:p-2">Tentativas</th>
                                < th className ="p-1.5 sm:p-2">Desarmes %</th>
                                    < th className ="p-1.5 sm:p-2">Vermelhos</th>
                                        < th className ="p-1.5 sm:p-2">Nota</th>
                </tr >
              </thead >
        <tbody>
            {(playersByClub.get(clubRow.clubId) ?? []).map((p) => (
                <tr key={p.playerId} className={`border-t ${p.totalMom > 0 ? "bg-amber-50" : ""}`}>
                    <td className="p-2 text-left">
                        <Link className="text-blue-700 underline" to={`/statistics/player/${matchId}/${p.playerId}`}>
                            {p.playerName}
                        </Link>
                        {p.totalMom > 0 && <span className="ml-2" title="Homem da Partida">⭐</span>}
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
                    <td className="p-2 tabular-nums">{p.totalRedCards ?? 0}</td>
                    <td className="p-2 tabular-nums">{(p.avgRating ?? 0).toFixed(2)}</td>
                </tr>
            ))}
        </tbody>
            </table >
          </div >
        </div >
      ))
}
    </div >
  );
}
