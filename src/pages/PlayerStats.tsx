import React, { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../services/api.ts";

/***************************
 * Tipos
 ***************************/
interface PlayerStatsParams {
    matchId?: string;
    playerId?: string;
}

interface PlayerMatchStatsDto {
    aceleracao: number; pique: number; finalizacao: number; falta: number; cabeceio: number; forcaDoChute: number; chuteLonge: number; voleio: number; penalti: number; visao: number; cruzamento: number; lancamento: number; passeCurto: number; curva: number; agilidade: number; equilibrio: number; posAtaqueInutil: number; controleBola: number; conducao: number; interceptacaos: number; nocaoDefensiva: number; divididaEmPe: number; carrinho: number; impulsao: number; folego: number; forca: number; reacao: number; combatividade: number; frieza: number; elasticidadeGL: number; manejoGL: number; chuteGL: number; reflexosGL: number; posGL: number;
}

interface MatchPlayerStatsDto {
    playerId: number;
    playerName: string;
    assists: number;
    cleansheetsAny: number;
    cleansheetsDef: number;
    cleansheetsGk: number;
    goals: number;
    goalsConceded: number;
    losses: number;
    mom: boolean;
    namespace: number;
    passAttempts: number;
    passesMade: number;
    passAccuracy: number; // %
    position: string;
    rating: number;
    realtimeGame: string;
    realtimeIdle: string;
    redCards: number;
    saves: number;
    score: number;
    shots: number;
    tackleAttempts: number;
    tacklesMade: number;
    vproAttr: string;
    vproHackReason: string;
    wins: number;
    statistics?: PlayerMatchStatsDto;
}

/***************************
 * Helpers
 ***************************/
function clamp01to100(x: number) {
    if (!Number.isFinite(x)) return 0;
    return Math.max(0, Math.min(100, x));
}

function fmtPct(n: number | undefined | null) {
    if (!Number.isFinite(Number(n))) return "0.0%";
    return `${Number(n).toFixed(1)}%`;
}

function fmtNumber(n: number | undefined | null) {
    if (!Number.isFinite(Number(n))) return "0";
    return String(Number(n));
}

const ATTR_LABELS: Record<keyof PlayerMatchStatsDto, string> = {
    aceleracao: "ACELERAÇÃO",
    pique: "PIQUE",
    finalizacao: "FINALIZAÇÃO",
    falta: "FALTA",
    cabeceio: "CABECEIO",
    forcaDoChute: "FORÇA DO CHUTE",
    chuteLonge: "CHUTE LONGE",
    voleio: "VOLEIO",
    penalti: "PÊNALTI",
    visao: "VISÃO",
    cruzamento: "CRUZAMENTO",
    lancamento: "LANÇAMENTO",
    passeCurto: "PASSE CURTO",
    curva: "CURVA",
    agilidade: "AGILIDADE",
    equilibrio: "EQUILÍBRIO",
    posAtaqueInutil: "POSIÇÃO ATAQUE",
    controleBola: "CONTROLE DE BOLA",
    conducao: "CONDUÇÃO",
    interceptacaos: "INTERCEPTAÇÕES",
    nocaoDefensiva: "NOÇÃO DEFENSIVA",
    divididaEmPe: "DIVIDIDA EM PÉ",
    carrinho: "CARRINHO",
    impulsao: "IMPULSÃO",
    folego: "FÔLEGO",
    forca: "FORÇA",
    reacao: "REAÇÃO",
    combatividade: "COMBATIVIDADE",
    frieza: "FRIEZA",
    elasticidadeGL: "ELASTICIDADE (GL)",
    manejoGL: "MANEJO (GL)",
    chuteGL: "CHUTE (GL)",
    reflexosGL: "REFLEXOS (GL)",
    posGL: "POSICIONAMENTO (GL)",
};

const GROUPS: Array<{ name: string; keys: (keyof PlayerMatchStatsDto)[]; onlyGK?: boolean }> = [
    { name: "Ritmo", keys: ["aceleracao", "pique"] },
    { name: "Finalização", keys: ["finalizacao", "cabeceio", "forcaDoChute", "chuteLonge", "voleio", "penalti", "frieza"] },
    { name: "Passe", keys: ["visao", "cruzamento", "lancamento", "passeCurto", "curva"] },
    { name: "Drible", keys: ["agilidade", "equilibrio", "posAtaqueInutil", "controleBola", "conducao", "reacao"] },
    { name: "Defesa", keys: ["interceptacaos", "nocaoDefensiva", "divididaEmPe", "carrinho", "combatividade"] },
    { name: "Físico", keys: ["impulsao", "folego", "forca"] },
    { name: "Goleiro", keys: ["elasticidadeGL", "manejoGL", "chuteGL", "reflexosGL", "posGL"], onlyGK: true },
];

/***************************
 * UI Atômicos
 ***************************/
function StatTile({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
    return (
        <div className="rounded-2xl border bg-white p-3 shadow-sm hover:shadow transition-shadow" title={hint}>
            <div className="text-xs text-gray-500">{label}</div>
            <div className="mt-1 text-lg font-semibold text-gray-900">{value}</div>
        </div>
    );
}

function ProgressBar({ value, label }: { value: number; label: string }) {
    const pct = clamp01to100(value);
    const color = pct < 40 ? "bg-rose-500" : pct < 70 ? "bg-amber-400" : "bg-emerald-500";
    return (
        <div className="mb-3" aria-label={`${label}: ${Math.round(pct)}`}>
            <label className="block text-[11px] sm:text-xs font-semibold text-gray-700 mb-1 tracking-wide">{label}</label>
            <div className="relative flex items-center">
                <div className="w-full bg-gray-200/70 rounded-full h-2.5 overflow-hidden">
                    <div className={`h-2.5 rounded-full ${color} transition-all duration-500`} style={{ width: `${pct}%` }} />
                </div>
                <span className="ml-2 text-xs sm:text-sm font-semibold text-gray-700 w-10 text-right">{Math.round(pct)}</span>
            </div>
        </div>
    );
}

function Skeleton({ className = "" }: { className?: string }) {
    return <div className={`animate-pulse bg-gray-200 rounded ${className}`} />;
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
    return (
        <div className="mx-auto my-8 max-w-xl rounded-2xl border bg-white p-6 text-center shadow-sm">
            <div className="text-red-600 font-semibold">Erro ao carregar</div>
            <p className="mt-2 text-sm text-gray-600">{message}</p>
            <button onClick={onRetry} className="mt-4 rounded-xl bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-200">
                Tentar novamente
            </button>
        </div>
    );
}

/***************************
 * Página
 ***************************/
export default function PlayerStats() {
    const { matchId, playerId } = useParams<PlayerStatsParams>();
    const [data, setData] = useState<MatchPlayerStatsDto | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [sort, setSort] = useState<"valor" | "nome">("valor");
    const [limit, setLimit] = useState<number>(0); // 0 = todos, 5 = top5

    // Fetch DENTRO do useEffect (sem eslint-disable)
    useEffect(() => {
        if (!matchId || !playerId) return;

        const controller = new AbortController();

        (async () => {
            try {
                setLoading(true);
                setError(null);
                const { data } = await api.get<MatchPlayerStatsDto>(
                    `https://eafctracker-cvadcceuerbgegdj.brazilsouth-01.azurewebsites.net/api/Matches/statistics/player/${matchId}/${playerId}`,
                    { signal: controller.signal }
                );
                setData(data);
            } catch (err: any) {
                if (err?.name !== "CanceledError" && err?.message !== "canceled") {
                    setError(err?.message ?? "Erro ao carregar estatísticas do jogador");
                }
            } finally {
                setLoading(false);
            }
        })();

        return () => controller.abort();
    }, [matchId, playerId]);

    const isGK = useMemo(() => {
        const pos = (data?.position || "").toLowerCase();
        return pos.includes("gk") || pos.includes("gol") || pos.includes("gl");
    }, [data?.position]);

    const computedPassAcc = useMemo(() => {
        if (!data) return 0;
        if (Number.isFinite(data.passAccuracy)) return data.passAccuracy;
        if (data.passAttempts > 0) return (data.passesMade / data.passAttempts) * 100;
        return 0;
    }, [data]);

    const attrEntries = useMemo(() => {
        const atts = data?.statistics;
        if (!atts) return [] as Array<[keyof PlayerMatchStatsDto, number]>;
        const keys = Object.keys(ATTR_LABELS) as Array<keyof PlayerMatchStatsDto>;
        let arr = keys
            .map((k) => [k, (atts as any)[k] as number])
            .filter(([, v]) => typeof v === "number" && Number.isFinite(v));

        // Filtra atributos de GK se não for GK
        arr = arr.filter(([k]) => {
            const gkOnly = GROUPS.find((g) => g.onlyGK && g.keys.includes(k as any));
            return !gkOnly || isGK;
        });

        if (sort === "valor") arr.sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0));
        if (sort === "nome") arr.sort((a, b) => ATTR_LABELS[a[0]].localeCompare(ATTR_LABELS[b[0]]));

        if (limit > 0) arr = arr.slice(0, limit);
        return arr;
    }, [data, isGK, sort, limit]);

    const groupAverages = useMemo(() => {
        const atts = data?.statistics;
        if (!atts) return [] as { group: string; value: number }[];
        return GROUPS
            .filter((g) => (g.onlyGK ? isGK : true))
            .map((g) => {
                const vals = g.keys
                    .map((k) => Number((atts as any)[k]))
                    .filter((v) => Number.isFinite(v));
                const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
                return { group: g.name, value: Math.round(avg) };
            });
    }, [data?.statistics, isGK]);

    const shareUrl = typeof window !== "undefined" ? window.location.href : "";

    if (loading)
        return (
            <div className="p-4 max-w-6xl mx-auto">
                <div className="flex items-center justify-between mb-4">
                    <Skeleton className="h-8 w-64" />
                    <Skeleton className="h-6 w-40" />
                </div>
                <Skeleton className="h-24 w-full mb-6" />
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {Array.from({ length: 12 }).map((_, i) => (
                        <Skeleton key={i} className="h-14" />
                    ))}
                </div>
                <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Skeleton className="h-80" />
                    <Skeleton className="h-80" />
                </div>
            </div>
        );

    if (error) return <ErrorState message={error} onRetry={() => { /* refaz com o mesmo efeito */ setError(null); setLoading(true); }} />;
    if (!data) return <div className="p-4">Dados indisponíveis.</div>;

    return (
        <div className="p-4 max-w-6xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-blue-800 flex items-center gap-2">
                        {data.playerName}
                        {data.mom && (
                            <span className="ml-1 rounded-full bg-yellow-400/90 px-2 py-0.5 text-xs font-semibold text-yellow-900" title="Melhor em Campo">
                                MOM
                            </span>
                        )}
                    </h1>
                </div>
                <Link to={`/match/${matchId}`} className="text-blue-700 hover:underline text-sm">
                    ← Voltar para a partida
                </Link>
            </div>

            {/* RESUMO */}
            <div className="bg-white rounded-2xl shadow-sm border p-4 mb-6">
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-lg font-semibold text-gray-800">Resumo da Partida</h2>
                </div>

                {/* KPIs principais */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                    <StatTile label="Gols" value={fmtNumber(data.goals)} />
                    <StatTile label="Assistências" value={fmtNumber(data.assists)} />
                    <StatTile label="Chutes" value={fmtNumber(data.shots)} />
                    <StatTile label="Passes certos" value={fmtNumber(data.passesMade)} />
                    <StatTile label="Passes tentados" value={fmtNumber(data.passAttempts)} />
                    <StatTile label="Precisão de passe" value={fmtPct(computedPassAcc)} />
                    <StatTile label="Desarmes certos" value={fmtNumber(data.tacklesMade)} />
                    <StatTile label="Desarmes tentados" value={fmtNumber(data.tackleAttempts)} />
                    {isGK && <StatTile label="Defesas" value={fmtNumber(data.saves)} />}
                    {isGK && <StatTile label="Gols sofridos" value={fmtNumber(data.goalsConceded)} />}
                    <StatTile label="Nota" value={Number.isFinite(data.rating) ? Number(data.rating).toFixed(2) : "0.00"} />
                    <StatTile label="Cartões vermelhos" value={fmtNumber(data.redCards)} />
                    <StatTile label="Score" value={fmtNumber(data.score)} />
                </div>

                {/* Metadados extras */}
                <div className="mt-4 text-xs text-gray-600 grid grid-cols-1 md:grid-cols-2 gap-2">
                    {data.vproAttr && <div><span className="font-semibold">VPro Attr:</span> {data.vproAttr}</div>}
                    {data.vproHackReason && <div><span className="font-semibold">Hack Reason:</span> {data.vproHackReason}</div>}
                    <div><span className="font-semibold">Namespace:</span> {fmtNumber(data.namespace)}</div>
                </div>
            </div>

            {/* GRÁFICO DE MÉDIAS POR GRUPO */}
            {groupAverages.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
                    <div className="rounded-2xl border bg-white p-4 shadow-sm">
                        <h3 className="text-base font-semibold text-gray-800 mb-3">Médias por Grupo</h3>
                        <RadarSVG data={groupAverages} />
                    </div>
                    <div className="rounded-2xl border bg-white p-4 shadow-sm">
                        <h3 className="text-base font-semibold text-gray-800 mb-3">Pontos fortes</h3>
                        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                            {attrEntries.slice(0, 6).map(([k, v]) => (
                                <li key={k} className="flex items-center justify-between rounded-xl border p-2">
                                    <span className="text-gray-700">{ATTR_LABELS[k]}</span>
                                    <span className="font-semibold text-gray-900">{Math.round(v)}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            )}

            <div className="flex items-center gap-2 text-xs">
                <span className="text-gray-600">Ajustes de lista:</span>
                <select value={sort} onChange={(e) => setSort(e.target.value as any)} className="rounded-md border px-2 py-1 text-xs">
                    <option value="valor">Ordenar por valor</option>
                    <option value="nome">Ordenar por nome</option>
                </select>
                <select value={String(limit)} onChange={(e) => setLimit(Number(e.target.value))} className="rounded-md border px-2 py-1 text-xs">
                    <option value="0">Mostrar todos</option>
                    <option value="5">Top 5</option>
                    <option value="10">Top 10</option>
                </select>
            </div>
            {/* ATRIBUTOS TÉCNICOS */}
            {data.statistics && (
                <div className="bg-white rounded-2xl shadow-sm border p-4">
                    <h2 className="text-lg font-semibold mb-3 text-gray-800">Atributos Técnicos</h2>
                    <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 text-sm text-gray-700">
                        {attrEntries.map(([key, val]) => (
                            <li key={key} className="col-span-1">
                                <ProgressBar value={val} label={ATTR_LABELS[key]} />
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}

/***************************
 * Gráfico Radar em SVG (sem libs externas)
 ***************************/
function RadarSVG({ data }: { data: { group: string; value: number }[] }) {
    const size = 260; // viewBox
    const center = size / 2;
    const radius = 100;
    const points = data.length;

    const angleFor = (i: number) => (Math.PI * 2 * i) / points - Math.PI / 2; // começa no topo
    const toXY = (r: number, angle: number) => ({ x: center + r * Math.cos(angle), y: center + r * Math.sin(angle) });

    const webLines = Array.from({ length: 5 }).map((_, ring) => {
        const r = radius * ((ring + 1) / 5);
        const d = data
            .map((_, i) => {
                const a = angleFor(i);
                const { x, y } = toXY(r, a);
                return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
            })
            .join(" ") + " Z";
        return <path key={ring} d={d} fill="none" stroke="#e5e7eb" strokeWidth={1} />;
    });

    const spokes = data.map((_, i) => {
        const a = angleFor(i);
        const { x, y } = toXY(radius, a);
        return <line key={i} x1={center} y1={center} x2={x} y2={y} stroke="#e5e7eb" strokeWidth={1} />;
    });

    const polygon = data
        .map((d, i) => {
            const a = angleFor(i);
            const r = (clamp01to100(d.value) / 100) * radius;
            const { x, y } = toXY(r, a);
            return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
        })
        .join(" ") + " Z";

    return (
        <div className="w-full flex items-center justify-center">
            <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-sm">
                <g>{webLines}</g>
                <g>{spokes}</g>
                <path d={polygon} fill="#3b82f6" fillOpacity={0.25} stroke="#3b82f6" strokeWidth={2} />
                {data.map((d, i) => {
                    const a = angleFor(i);
                    const { x, y } = toXY(radius + 16, a);
                    return (
                        <text key={i} x={x} y={y} textAnchor="middle" dominantBaseline="middle" className="fill-gray-600 text-[10px]">
                            {d.group}
                        </text>
                    );
                })}
            </svg>
        </div>
    );
}
