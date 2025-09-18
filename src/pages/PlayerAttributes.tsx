// src/pages/PlayerAttributesPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import api from "../services/api.ts";
import { useClub } from "../hooks/useClub.tsx";

/******** Helpers ********/
function isAbort(err: any) {
    return (
        err?.name === "CanceledError" ||
        err?.message === "canceled" ||
        err?.code === "ERR_CANCELED" ||
        err?.__CANCEL__ === true
    );
}
function pick<T = any>(obj: any, camel: string, pascal: string): T {
    if (!obj) return undefined as any;
    if (camel in obj) return obj[camel];
    if (pascal in obj) return obj[pascal];
    return undefined as any;
}
function clamp01to100(x: number) {
    if (!Number.isFinite(x)) return 0;
    return Math.max(0, Math.min(100, x));
}

/******** Tipos ********/
type PlayerMatchStats = {
    aceleracao: number; pique: number; finalizacao: number; falta: number; cabeceio: number; forcaDoChute: number; chuteLonge: number; voleio: number; penalti: number; visao: number; cruzamento: number; lancamento: number; passeCurto: number; curva: number; agilidade: number; equilibrio: number; posAtaqueInutil: number; controleBola: number; conducao: number; interceptacaos: number; nocaoDefensiva: number; divididaEmPe: number; carrinho: number; impulsao: number; folego: number; forca: number; reacao: number; combatividade: number; frieza: number; elasticidadeGL: number; manejoGL: number; chuteGL: number; reflexosGL: number; posGL: number;
};
type PlayerAttrRow = {
    playerId: number;
    playerName: string;
    clubId: number;
    pos?: string | null;
    statistics: PlayerMatchStats | null;
};

/******** Constantes de UI ********/
const ATTR_LABELS: Record<keyof PlayerMatchStats, string> = {
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

function isGk(pos?: string | null) {
    if (!pos) return false;
    const p = pos.trim().toLowerCase();
    return p === "gk" || p === "gol" || p === "goalkeeper" || p === "goleiro";
}

/******** UI atômicos ********/
const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = "" }) => (
    <div className={`bg-white rounded-2xl shadow-sm border p-4 ${className}`}>{children}</div>
);
function Skeleton({ className = "" }: { className?: string }) {
    return <div className={`animate-pulse bg-gray-200 rounded ${className}`} />;
}
function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
    return (
        <div className="mx-auto my-8 max-w-xl rounded-2xl border bg-white p-6 text-center shadow-sm">
            <div className="text-red-600 font-semibold">Erro ao carregar</div>
            <p className="mt-2 text-sm text-gray-600">{message}</p>
            <button
                onClick={onRetry}
                className="mt-4 rounded-xl bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-200"
            >
                Tentar novamente
            </button>
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

/******** Página ********/
export default function PlayerAttributesPage() {
    const { clubId, clubName } = useClub();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [rows, setRows] = useState<PlayerAttrRow[]>([]);

    // seleção
    const [basePlayerId, setBasePlayerId] = useState<number | "">("");
    const [compareMode, setCompareMode] = useState<"media" | "player">("media");
    const [comparePlayerId, setComparePlayerId] = useState<number | "">("");

    useEffect(() => {
        if (!clubId) {
            setError("Nenhum clube selecionado.");
            setLoading(false);
            return;
        }

        const controller = new AbortController();
        setLoading(true);
        setError(null);

        (async () => {
            try {
                // sem count => pega o snapshot mais novo por jogador
                const { data } = await api.get(`/api/clubs/${clubId}/players/attributes`, {
                    signal: controller.signal,
                });
                const arr: any[] = Array.isArray(data) ? data : [];

                const mapped: PlayerAttrRow[] = arr.map((row) => ({
                    playerId: Number(pick(row, "playerId", "PlayerId")),
                    playerName: String(pick(row, "playerName", "PlayerName") ?? ""),
                    clubId: Number(pick(row, "clubId", "ClubId") ?? 0),
                    pos: pick<string>(row, "pos", "Pos") ?? null, 
                    statistics: mapAttr(pick(row, "statistics", "Statistics")),
                }));

                setRows(mapped);
                // default: primeiro jogador da lista como base
                if (mapped.length > 0) {
                    setBasePlayerId(mapped[0].playerId);
                }
            } catch (e: any) {
                if (isAbort(e)) return;
                setError(e?.message ?? "Erro ao buscar atributos do clube");
            } finally {
                setLoading(false);
            }
        })();

        return () => controller.abort();
    }, [clubId]);

    const base = useMemo(
        () => rows.find((r) => String(r.playerId) === String(basePlayerId)),
        [rows, basePlayerId]
    );

    const teamAverage = useMemo(() => {
        if (rows.length === 0) return null;

        // desconsidera goleiros por garantia
        const fieldPlayers = rows.filter(r => !isGk(r.pos));
        const statsAll = fieldPlayers
            .map((r) => r.statistics)
            .filter(Boolean) as PlayerMatchStats[];

        if (statsAll.length === 0) return null;

        const keys = Object.keys(ATTR_LABELS) as (keyof PlayerMatchStats)[];
        const avg: Record<string, number> = {};
        keys.forEach((k) => {
            const vals = statsAll.map((s) => Number((s as any)[k])).filter((v) => Number.isFinite(v));
            avg[k] = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
        });
        return avg as Record<keyof PlayerMatchStats, number>;
    }, [rows]);

    const compare = useMemo(() => {
        if (compareMode === "media") return teamAverage;
        if (!comparePlayerId) return null;
        const pl = rows.find((r) => String(r.playerId) === String(comparePlayerId));
        return pl?.statistics ?? null;
    }, [compareMode, comparePlayerId, teamAverage, rows]);

    /******** Render ********/
    if (loading) {
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
            </div>
        );
    }
    if (error) {
        return <ErrorState message={error} onRetry={() => window.location.reload()} />;
    }
    if (!clubId) {
        return <div className="p-4">Nenhum clube selecionado.</div>;
    }
    if (rows.length === 0) {
        return <div className="p-4">Nenhum atributo encontrado para o clube {clubName ?? clubId}.</div>;
    }

    const allPlayersForSelect = rows
        .map((r) => ({ id: r.playerId, name: r.playerName }))
        .sort((a, b) => a.name.localeCompare(b.name));

    return (
        <div className="p-4 max-w-6xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <h1 className="text-2xl sm:text-3xl font-bold text-blue-800">
                    Atributos do Clube {clubName ? `— ${clubName}` : `#${clubId}`}
                </h1>
            </div>

            <Card>
                {/* Seleções */}
                <div className="flex flex-col md:flex-row md:items-end gap-3">
                    <div>
                        <label className="block text-xs font-semibold mb-1">Jogador base</label>
                        <select
                            className="border rounded px-3 py-2 text-sm min-w-[220px]"
                            value={basePlayerId}
                            onChange={(e) => setBasePlayerId(e.target.value ? Number(e.target.value) : "")}
                        >
                            {allPlayersForSelect.map((p) => (
                                <option key={p.id} value={p.id}>
                                    {p.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold mb-1">Comparar com</label>
                        <select
                            className="border rounded px-3 py-2 text-sm"
                            value={compareMode}
                            onChange={(e) => {
                                const v = e.target.value as "media" | "player";
                                setCompareMode(v);
                                if (v === "media") setComparePlayerId("");
                            }}
                        >
                            <option value="media">Média do clube</option>
                            <option value="player">Outro jogador</option>
                        </select>
                    </div>

                    {compareMode === "player" && (
                        <div>
                            <label className="block text-xs font-semibold mb-1">Jogador para comparar</label>
                            <select
                                className="border rounded px-3 py-2 text-sm min-w-[220px]"
                                value={comparePlayerId}
                                onChange={(e) => setComparePlayerId(e.target.value ? Number(e.target.value) : "")}
                            >
                                <option value="">Selecionar…</option>
                                {allPlayersForSelect
                                    .filter((p) => String(p.id) !== String(basePlayerId))
                                    .map((p) => (
                                        <option key={p.id} value={p.id}>
                                            {p.name}
                                        </option>
                                    ))}
                            </select>
                        </div>
                    )}
                </div>

                {/* Comparação */}
                <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Base: lista de atributos */}
                    <Card>
                        <h3 className="text-base font-semibold mb-3">Atributos — {base?.playerName ?? "—"}</h3>
                        {base?.statistics ? (
                            <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 text-sm text-gray-700">
                                {(Object.keys(ATTR_LABELS) as (keyof PlayerMatchStats)[]).map((key) => (
                                    <li key={String(key)} className="col-span-1">
                                        <ProgressBar
                                            value={Number((base.statistics as any)[key]) || 0}
                                            label={ATTR_LABELS[key]}
                                        />
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <div className="text-sm text-gray-600">Sem snapshot de atributos para este jogador.</div>
                        )}
                    </Card>

                    {/* Comparação com média ou outro jogador */}
                    <Card>
                        <h3 className="text-base font-semibold mb-3">
                            Comparação — {compareMode === "media" ? "Média do clube" : rows.find((r) => String(r.playerId) === String(comparePlayerId))?.playerName ?? "—"}
                        </h3>

                        {compare ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {(Object.keys(ATTR_LABELS) as (keyof PlayerMatchStats)[]).map((key) => {
                                    const mine = clamp01to100(Number((base?.statistics as any)?.[key] ?? 0));
                                    const other = clamp01to100(Number((compare as any)?.[key] ?? 0));

                                    // tolerância para considerar "igual"
                                    const EPS = 0.5; // 0.5 ponto ~ ajuste se quiser mais/menos rígido
                                    const diff = Number(mine - other);
                                    const isEqual = Math.abs(diff) <= EPS;
                                    const isAbove = diff > EPS;
                                    const isBelow = diff < -EPS;

                                    const badgeClass = isEqual
                                        ? "bg-blue-100 text-blue-800"
                                        : isAbove
                                            ? "bg-emerald-100 text-emerald-800"
                                            : "bg-rose-100 text-rose-800";

                                    const badgeText = isEqual ? "Igual" : isAbove ? "Acima" : "Abaixo";

                                    // Mostra o delta com sinal (ex.: +3 / -2)
                                    const deltaText =
                                        (isEqual ? "±0" : `${diff > 0 ? "+" : ""}${Math.round(diff)}`) + "";

                                    return (
                                        <div key={String(key)} className="rounded-xl border p-3">
                                            <div className="flex items-center justify-between text-sm">
                                                <span className="font-medium text-gray-800">
                                                    {ATTR_LABELS[key]}
                                                </span>
                                                <span className={`text-xs px-2 py-0.5 rounded-full ${badgeClass}`}>
                                                    {badgeText} <span className="opacity-70">({deltaText})</span>
                                                </span>
                                            </div>

                                            <div className="mt-2">
                                                <div className="text-[11px] text-gray-500">
                                                    Base: {Math.round(mine)}
                                                </div>
                                                <div className="w-full bg-gray-200 rounded h-2 overflow-hidden">
                                                    <div className="h-2 bg-blue-600" style={{ width: `${mine}%` }} />
                                                </div>
                                            </div>

                                            <div className="mt-2">
                                                <div className="text-[11px] text-gray-500">
                                                    {compareMode === "media" ? "Clube (média)" : "Comparação"}:{" "}
                                                    {Math.round(other)}
                                                </div>
                                                <div className="w-full bg-gray-200 rounded h-2 overflow-hidden">
                                                    <div
                                                        className="h-2 bg-slate-500"
                                                        style={{ width: `${other}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="text-sm text-gray-600">
                                {compareMode === "player"
                                    ? "Selecione um jogador para comparar."
                                    : "Sem dados para média."}
                            </div>
                        )}

                    </Card>
                </div>
            </Card>
        </div>
    );
}

/******** mapper ********/
function mapAttr(be?: any | null): PlayerMatchStats | null {
    if (!be) return null;
    return {
        aceleracao: pick<number>(be, "aceleracao", "Aceleracao"),
        pique: pick(be, "pique", "Pique"),
        finalizacao: pick(be, "finalizacao", "Finalizacao"),
        falta: pick(be, "falta", "Falta"),
        cabeceio: pick(be, "cabeceio", "Cabeceio"),
        forcaDoChute: pick(be, "forcaDoChute", "ForcaDoChute"),
        chuteLonge: pick(be, "chuteLonge", "ChuteLonge"),
        voleio: pick(be, "voleio", "Voleio"),
        penalti: pick(be, "penalti", "Penalti"),
        visao: pick(be, "visao", "Visao"),
        cruzamento: pick(be, "cruzamento", "Cruzamento"),
        lancamento: pick(be, "lancamento", "Lancamento"),
        passeCurto: pick(be, "passeCurto", "PasseCurto"),
        curva: pick(be, "curva", "Curva"),
        agilidade: pick(be, "agilidade", "Agilidade"),
        equilibrio: pick(be, "equilibrio", "Equilibrio"),
        posAtaqueInutil: pick(be, "posAtaqueInutil", "PosAtaqueInutil"),
        controleBola: pick(be, "controleBola", "ControleBola"),
        conducao: pick(be, "conducao", "Conducao"),
        interceptacaos: pick(be, "interceptacaos", "Interceptacaos"),
        nocaoDefensiva: pick(be, "nocaoDefensiva", "NocaoDefensiva"),
        divididaEmPe: pick(be, "divididaEmPe", "DivididaEmPe"),
        carrinho: pick(be, "carrinho", "Carrinho"),
        impulsao: pick(be, "impulsao", "Impulsao"),
        folego: pick(be, "folego", "Folego"),
        forca: pick(be, "forca", "Forca"),
        reacao: pick(be, "reacao", "Reacao"),
        combatividade: pick(be, "combatividade", "Combatividade"),
        frieza: pick(be, "frieza", "Frieza"),
        elasticidadeGL: pick(be, "elasticidadeGL", "ElasticidadeGL"),
        manejoGL: pick(be, "manejoGL", "ManejoGL"),
        chuteGL: pick(be, "chuteGL", "ChuteGL"),
        reflexosGL: pick(be, "reflexosGL", "ReflexosGL"),
        posGL: pick(be, "posGL", "PosGL"),
    };
}
