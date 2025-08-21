import React, { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../services/api.ts";

// ========================
// Tipos
// ========================
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

// ========================
// Helpers
// ========================
function clamp01to100(x: number) {
    if (Number.isNaN(x)) return 0;
    return Math.max(0, Math.min(100, x));
}

function ProgressBar({ value, label }: { value: number; label: string }) {
    const pct = clamp01to100(value);
    const color = pct < 40 ? "bg-red-500" : pct < 70 ? "bg-yellow-400" : "bg-green-500";
    return (
        <div className="mb-3">
            <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1">{label}</label>
            <div className="relative flex items-center">
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div className={`h-2.5 rounded-full ${color}`} style={{ width: `${pct}%` }} />
                </div>
                <span className="ml-2 text-xs sm:text-sm font-semibold text-gray-700 w-10 text-right">{Math.round(pct)}</span>
            </div>
        </div>
    );
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

function Skeleton({ className = "" }: { className?: string }) {
    return <div className={`animate-pulse bg-gray-200 rounded ${className}`} />;
}

// ========================
// Página
// ========================
export default function PlayerStats() {
    const { matchId, playerId } = useParams<PlayerStatsParams>();
    const [data, setData] = useState<MatchPlayerStatsDto | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!matchId || !playerId) return;
        let cancel = false;
        (async () => {
            try {
                setLoading(true);
                setError(null);
                const { data } = await api.get<MatchPlayerStatsDto>(
                    `https://eafctracker-cvadcceuerbgegdj.brazilsouth-01.azurewebsites.net/api/Matches/statistics/player/${matchId}/${playerId}`
                );
                if (!cancel) setData(data);
            } catch (err: any) {
                if (!cancel) setError(err?.message ?? "Erro ao carregar estatísticas do jogador");
            } finally {
                if (!cancel) setLoading(false);
            }
        })();
        return () => {
            cancel = true;
        };
    }, [matchId, playerId]);

    const attrEntries = useMemo(() => {
        const atts = data?.statistics;
        if (!atts) return [] as Array<[keyof PlayerMatchStatsDto, number]>;
        return (Object.keys(ATTR_LABELS) as Array<keyof PlayerMatchStatsDto>)
            .map((k) => [k, (atts as any)[k] as number])
            .filter(([, v]) => typeof v === "number");
    }, [data]);

    if (loading)
        return (
            <div className="p-4 max-w-5xl mx-auto">
                <Skeleton className="h-8 w-64 mb-4" />
                <Skeleton className="h-24 w-full mb-6" />
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {Array.from({ length: 12 }).map((_, i) => (
                        <Skeleton key={i} className="h-12" />
                    ))}
                </div>
            </div>
        );

    if (error) return <div className="p-4 text-red-600">{error}</div>;
    if (!data) return <div className="p-4">Dados indisponíveis.</div>;

    return (
        <div className="p-4 max-w-5xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-blue-800">{data.playerName}</h1>
                    <p className="text-gray-600">{data.position}</p>
                </div>
                <Link to={`/match/${matchId}`} className="text-blue-700 hover:underline text-sm">
                    ← Voltar para a partida
                </Link>
            </div>

            {/* Estatísticas resumidas */}
            <div className="bg-white rounded-xl shadow-sm border p-4 mb-6">
                <h2 className="text-lg font-semibold mb-3 text-gray-800">Estatísticas da Partida</h2>
                <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-6 gap-y-2 text-sm text-gray-700">
                    <li><strong>Gols:</strong> {data.goals}</li>
                    <li><strong>Assistências:</strong> {data.assists}</li>
                    <li><strong>Chutes:</strong> {data.shots}</li>
                    <li><strong>Passes Certos:</strong> {data.passesMade}</li>
                    <li><strong>Passes Tentados:</strong> {data.passAttempts}</li>
                    <li><strong>Precisão de Passe:</strong> {Number.isFinite(data.passAccuracy) ? data.passAccuracy.toFixed(1) : "0.0"}%</li>
                    <li><strong>Desarmes Certos:</strong> {data.tacklesMade}</li>
                    <li><strong>Desarmes Tentados:</strong> {data.tackleAttempts}</li>
                    <li><strong>Defesas:</strong> {data.saves}</li>
                    <li><strong>Gols Sofridos:</strong> {data.goalsConceded}</li>
                    <li><strong>Cartões Vermelhos:</strong> {data.redCards}</li>
                    <li><strong>Nota:</strong> {Number.isFinite(data.rating) ? data.rating.toFixed(2) : "0.00"}</li>
                    <li><strong>Melhor em Campo:</strong> {data.mom ? "Sim" : "Não"}</li>
                    <li><strong>Vitórias:</strong> {data.wins}</li>
                    <li><strong>Derrotas:</strong> {data.losses}</li>
                    <li><strong>Score:</strong> {data.score}</li>
                    <li><strong>Namespace:</strong> {data.namespace}</li>
                    {data.vproAttr && <li className="col-span-2"><strong>VPro Attr:</strong> {data.vproAttr}</li>}
                    {data.vproHackReason && <li className="col-span-2"><strong>Hack Reason:</strong> {data.vproHackReason}</li>}
                </ul>
            </div>

            {/* Atributos técnicos */}
            {data.statistics && (
                <div className="bg-white rounded-xl shadow-sm border p-4">
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
