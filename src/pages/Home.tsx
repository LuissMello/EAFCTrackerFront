import React, { useEffect, useMemo, useRef, useState, useId } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api from "../services/api.ts";
import { useClub } from "../hooks/useClub.tsx";

// ======================
// Tipos (mantidos para compatibilidade)
// ======================
interface ClubDetailsDto {
    name?: string | null;
    regionId?: number;
    teamId?: number;
    stadName?: string | null;
    kitId?: string | null;
    customKitId?: string | null;
    customAwayKitId?: string | null;
    customThirdKitId?: string | null;
    customKeeperKitId?: string | null;
    kitColor1?: string | number | null;
    kitColor2?: string | number | null;
    kitColor3?: string | number | null;
    kitColor4?: string | number | null;
    kitAColor1?: string | number | null;
    kitAColor2?: string | number | null;
    kitAColor3?: string | number | null;
    kitAColor4?: string | number | null;
    kitThrdColor1?: string | number | null;
    kitThrdColor2?: string | number | null;
    kitThrdColor3?: string | number | null;
    kitThrdColor4?: string | number | null;
    dCustomKit?: string | null;
    crestColor?: string | null;
    crestAssetId?: string | null;
}

interface MatchResultDto {
    matchId: number;
    timestamp: string;
    clubAName: string;
    clubAGoals: number;
    clubADetails?: ClubDetailsDto | null;

    clubBName: string;
    clubBGoals: number;
    clubBDetails?: ClubDetailsDto | null;

    clubARedCards?: number | null;
    clubBRedCards?: number | null;

    resultText?: string;
}

type MatchTypeFilter = "All" | "League" | "Playoff";

type SortKey = "recent" | "oldest" | "gf" | "ga";

// NOVO: filtro por cartões vermelhos
type RedCardFilter = "all" | "none" | "1plus" | "2plus";

// ======================
// Helpers
// ======================
const fmtDateTime = new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" });
const rtf = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });

const FALLBACK_LOGO = "https://via.placeholder.com/96?text=Logo";
const AVATAR_PX = 40; // mesmo tamanho para logo e camisa

function crestUrl(crestAssetId?: string | null) {
    if (!crestAssetId) return FALLBACK_LOGO;
    return `https://eafc24.content.easports.com/fifa/fltOnlineAssets/24B23FDE-7835-41C2-87A2-F453DFDB2E82/2024/fcweb/crests/256x256/l${crestAssetId}.png`;
}

function toHex(dec: string | number | null | undefined): string | null {
    if (dec === null || dec === undefined) return null;
    if (typeof dec === "string") {
        const s = dec.trim();
        if (/^#?[0-9a-fA-F]{6}$/.test(s)) return s.startsWith("#") ? s : `#${s}`;
        const n = Number(s);
        if (!Number.isNaN(n)) return `#${n.toString(16).padStart(6, "0").toUpperCase()}`;
        return null;
    }
    if (typeof dec === "number") return `#${dec.toString(16).padStart(6, "0").toUpperCase()}`;
    return null;
}

function fromNow(ts: string) {
    const d = new Date(ts).getTime();
    const now = Date.now();
    const diffMs = d - now;
    const abs = Math.abs(diffMs);
    const minutes = Math.round(abs / 60000);
    if (minutes < 60) return rtf.format(Math.sign(diffMs) * Math.round(minutes), "minute");
    const hours = Math.round(minutes / 60);
    if (hours < 48) return rtf.format(Math.sign(diffMs) * hours, "hour");
    const days = Math.round(hours / 24);
    return rtf.format(Math.sign(diffMs) * days, "day");
}

// Helpers adicionais: perspectiva pelo clube selecionado
function perspectiveFor(m: MatchResultDto, myClubName?: string | null, myTeamIdNum?: number) {
    if (typeof myTeamIdNum === "number" && Number.isFinite(myTeamIdNum)) {
        if (m.clubADetails?.teamId === myTeamIdNum) return { myGoals: m.clubAGoals, oppGoals: m.clubBGoals, isMineA: true };
        if (m.clubBDetails?.teamId === myTeamIdNum) return { myGoals: m.clubBGoals, oppGoals: m.clubAGoals, isMineA: false };
    }
    const name = (myClubName ?? "").toLowerCase();
    if (name) {
        if ((m.clubAName ?? "").toLowerCase() === name) return { myGoals: m.clubAGoals, oppGoals: m.clubBGoals, isMineA: true };
        if ((m.clubBName ?? "").toLowerCase() === name) return { myGoals: m.clubBGoals, oppGoals: m.clubAGoals, isMineA: false };
    }
    return { myGoals: m.clubAGoals, oppGoals: m.clubBGoals, isMineA: true };
}

// ======================
// Mini camisa (SVG) com padrões
// ======================
type JerseyPattern = "plain" | "hoops" | "stripes" | "sash" | "halves" | "quarters";

function KitJersey({
    colors,
    pattern = "plain",
    sizePx = AVATAR_PX,
    className = "",
    title = "Mini camisa",
}: {
    colors: Array<string | number | null | undefined>;
    pattern?: JerseyPattern;
    sizePx?: number;
    className?: string;
    title?: string;
}) {
    const uidRaw = useId();
    const uid = uidRaw.replace(/[:]/g, "");
    const idBody = `${uid}-body`;
    const idSlL = `${uid}-slL`;
    const idSlR = `${uid}-slR`;

    const [c1, c2, c3, c4] = [
        toHex(colors[0]) ?? "#9CA3AF", // gray-400
        toHex(colors[1]) ?? undefined,
        toHex(colors[2]) ?? "#111827", // gray-900
        toHex(colors[3]) ?? undefined,
    ];

    const body = c1;
    const sleeves = c2 ?? body;
    const collar = c3!;
    const accent = c4 ?? sleeves;

    // geometria
    const bodyX = 20, bodyY = 18, bodyW = 24, bodyH = 34;
    const slLy1 = 18, slLy2 = 32; // esquerda
    const slRy1 = 18, slRy2 = 32; // direita

    const renderHoops = () => {
        const stripeCount = 5;
        const gap = 2;
        const h = (bodyH - (stripeCount - 1) * gap) / stripeCount;
        const rows: JSX.Element[] = [];
        for (let i = 0; i < stripeCount; i++) {
            const y = bodyY + i * (h + gap);
            rows.push(<rect key={`b-${i}`} x={bodyX} y={y} width={bodyW} height={h} fill={accent} />);
        }
        const slRowsL: JSX.Element[] = [], slRowsR: JSX.Element[] = [];
        const sleeveTop = slLy1, sleeveBottom = slLy2;
        const sleeveH = sleeveBottom - sleeveTop;
        const stripeCountS = 4, gapS = 1.5;
        const hS = (sleeveH - (stripeCountS - 1) * gapS) / stripeCountS;
        for (let i = 0; i < stripeCountS; i++) {
            const y = sleeveTop + i * (hS + gapS);
            slRowsL.push(<rect key={`sl-${i}`} x={12} y={y} width={8} height={hS} fill={accent} />);
            slRowsR.push(<rect key={`sr-${i}`} x={44} y={y} width={8} height={hS} fill={accent} />);
        }
        return (
            <>
                <g clipPath={`url(#${idBody})`}>{rows}</g>
                <g clipPath={`url(#${idSlL})`}>{slRowsL}</g>
                <g clipPath={`url(#${idSlR})`}>{slRowsR}</g>
            </>
        );
    };

    const renderStripes = () => {
        const stripeCount = 6;
        const gap = 1.5;
        const w = (bodyW - (stripeCount - 1) * gap) / stripeCount;
        const cols: JSX.Element[] = [];
        for (let i = 0; i < stripeCount; i++) {
            const x = bodyX + i * (w + gap);
            cols.push(<rect key={`bcol-${i}`} x={x} y={bodyY} width={w} height={bodyH} fill={accent} />);
        }
        const slColsL: JSX.Element[] = [], slColsR: JSX.Element[] = [];
        const wS = 2;
        for (let i = 0; i < 4; i++) {
            const xL = 12 + i * (wS + 1);
            const xR = 44 + i * (wS + 1);
            slColsL.push(<rect key={`slc-${i}`} x={xL} y={22} width={wS} height={8} fill={accent} />);
            slColsR.push(<rect key={`src-${i}`} x={xR} y={22} width={wS} height={8} fill={accent} />);
        }
        return (
            <>
                <g clipPath={`url(#${idBody})`}>{cols}</g>
                <g clipPath={`url(#${idSlL})`}>{slColsL}</g>
                <g clipPath={`url(#${idSlR})`}>{slColsR}</g>
            </>
        );
    };

    const renderSash = () => (
        <>
            <polygon points="16,18 24,18 48,52 40,52" fill={accent} opacity={0.95} />
            <rect x={12} y={26} width={8} height={3} fill={accent} />
            <rect x={44} y={22} width={8} height={3} fill={accent} />
        </>
    );

    const renderHalves = () => (
        <>
            <rect x={bodyX} y={bodyY} width={bodyW / 2} height={bodyH} rx={0} fill={body} />
            <rect x={bodyX + bodyW / 2} y={bodyY} width={bodyW / 2} height={bodyH} rx={0} fill={accent} />
        </>
    );

    const renderQuarters = () => (
        <>
            <rect x={bodyX} y={bodyY} width={bodyW / 2} height={bodyH / 2} fill={body} />
            <rect x={bodyX + bodyW / 2} y={bodyY} width={bodyW / 2} height={bodyH / 2} fill={accent} />
            <rect x={bodyX} y={bodyY + bodyH / 2} width={bodyW / 2} height={bodyH / 2} fill={accent} />
            <rect x={bodyX + bodyW / 2} y={bodyY + bodyH / 2} width={bodyW / 2} height={bodyH / 2} fill={body} />
        </>
    );

    return (
        <svg
            width={sizePx}
            height={sizePx}
            viewBox="0 0 64 64"
            className={className}
            role="img"
            aria-label={title}
            preserveAspectRatio="xMidYMid meet"
        >
            <defs>
                <clipPath id={idBody}>
                    <rect x={20} y={18} width={24} height={34} rx={4} />
                </clipPath>
                <clipPath id={idSlL}>
                    <polygon points="20,18 12,22 12,32 20,28" />
                </clipPath>
                <clipPath id={idSlR}>
                    <polygon points="44,18 52,22 52,32 44,28" />
                </clipPath>
            </defs>

            <polygon points="20,18 12,22 12,32 20,28" fill={sleeves} />
            <polygon points="44,18 52,22 52,32 44,28" fill={sleeves} />

            <rect x={20} y={18} width={24} height={34} rx={4} fill={body} />

            {pattern === "hoops" && renderHoops()}
            {pattern === "stripes" && renderStripes()}
            {pattern === "sash" && renderSash()}
            {pattern === "halves" && renderHalves()}
            {pattern === "quarters" && renderQuarters()}

            <polygon points="28,14 32,20 36,14" fill={collar} />

            <rect x={20} y={18} width={24} height={34} rx={4} fill="none" stroke="rgba(0,0,0,0.15)" />
            <polyline points="20,18 12,22 12,32 20,28" fill="none" stroke="rgba(0,0,0,0.15)" />
            <polyline points="44,18 52,22 52,32 44,28" fill="none" stroke="rgba(0,0,0,0.15)" />
        </svg>
    );
}

// ============= Heurística de padrão (até termos o template real) =============
const KNOWN_TEMPLATES: Record<string, JerseyPattern> = {};

function guessPattern(details?: ClubDetailsDto | null): JerseyPattern {
    const txt =
        (details?.customKitId ?? "") +
        "|" +
        (details?.kitId ?? "") +
        "|" +
        (details?.dCustomKit ?? "");

    for (const key of Object.keys(KNOWN_TEMPLATES)) {
        if (txt.includes(key)) return KNOWN_TEMPLATES[key];
    }

    const hasC4 = !!details?.kitColor4;
    const hint = txt.toLowerCase();
    if (hint.includes("sash")) return "sash";
    if (hint.includes("stripe")) return "stripes";
    if (hint.includes("hoop")) return "hoops";
    if (hint.includes("half")) return "halves";
    if (hint.includes("quarter")) return "quarters";
    return hasC4 ? "hoops" : "plain";
}

// ======================
// UI helpers
// ======================
function Skeleton({ className = "" }: { className?: string }) {
    return <div className={`animate-pulse bg-gray-200 rounded ${className}`} />;
}

function Badge({ color = "gray", children }: { color?: "gray" | "green" | "red" | "amber"; children: React.ReactNode }) {
    const palette: Record<string, string> = {
        gray: "bg-gray-50 border-gray-200 text-gray-600",
        green: "bg-green-50 border-green-200 text-green-700",
        red: "bg-red-50 border-red-200 text-red-700",
        amber: "bg-amber-50 border-amber-200 text-amber-700",
    };
    return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] ${palette[color]}`}>{children}</span>;
}

// Badge de cartões vermelhos
function RedCardBadge({ count }: { count?: number | null }) {
    const c = typeof count === "number" ? count : 0;
    const has = c > 0;
    return (
        <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px]  ${has ? "bg-red-50 border-red-200 text-red-700" : "bg-gray-50 border-gray-200 text-gray-400"}`}
            title={`Cartões vermelhos: ${c}`}
            aria-label={`Cartões vermelhos: ${c}`}
        >
            <span className={`inline-block w-2.5 h-3.5 rounded-[2px] ${has ? "bg-red-600" : "bg-gray-300"}`} />
            <span className="tabular-nums">{c}</span>
        </span>
    );
}

function OutcomeBadge({ a, b }: { a: number; b: number }) {
    if (a > b) return <Badge color="green">Vitória</Badge>;
    if (a < b) return <Badge color="red">Derrota</Badge>;
    return <Badge color="amber">Empate</Badge>;
}

function ToolbarSeparator() {
    return <div className="hidden sm:block w-px self-stretch bg-gray-200" />;
}

function Segmented({ value, onChange }: { value: MatchTypeFilter; onChange: (v: MatchTypeFilter) => void }) {
    const opts: { v: MatchTypeFilter; label: string }[] = [
        { v: "All", label: "Todos" },
        { v: "League", label: "Liga" },
        { v: "Playoff", label: "Playoff" },
    ];
    return (
        <div role="tablist" aria-label="Tipo de partida" className="inline-flex rounded-xl border bg-white p-1">
            {opts.map((o) => (
                <button
                    key={o.v}
                    role="tab"
                    aria-selected={value === o.v}
                    onClick={() => onChange(o.v)}
                    className={`px-3 py-1.5 rounded-lg text-sm transition ${value === o.v ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-50"}`}
                >
                    {o.label}
                </button>
            ))}
        </div>
    );
}

// ======================
// Cart de partida (com responsividade corrigida)
// ======================
function MatchCard({ m, matchType }: { m: MatchResultDto; matchType: MatchTypeFilter }) {
    const patternA = guessPattern(m.clubADetails);
    const patternB = guessPattern(m.clubBDetails);

    // Perspectiva baseada no clube selecionado
    const { club } = useClub();
    const tRaw = (club as any)?.teamId;
    const myTeamIdNum = typeof tRaw === "number" ? tRaw : Number(tRaw);
    const p = perspectiveFor(m, club?.clubName, Number.isFinite(myTeamIdNum) ? myTeamIdNum : undefined);
    const outcome = p.myGoals === p.oppGoals ? "draw" : p.myGoals > p.oppGoals ? "win" : "loss";
    const borderClass = outcome === "win" ? "border-green-200" : outcome === "loss" ? "border-red-200" : "border-gray-200";

    return (
        <Link
            to={`/match/${m.matchId}?matchType=${matchType}`}
            className={`block bg-white rounded-xl p-4 border transition shadow-sm hover:shadow ${borderClass}`}
            title="Ver detalhes da partida"
        >
            {/* Linha de topo: data + resultado segundo o clube selecionado */}
            <div className="flex items-center justify-between gap-2">
                <div className="text-xs text-gray-500">
                    <span className="hidden sm:inline">{fmtDateTime.format(new Date(m.timestamp))}</span>
                    <span className="sm:hidden">{fromNow(m.timestamp)}</span>
                </div>
                <OutcomeBadge a={p.myGoals} b={p.oppGoals} />
            </div>

            {/* Linha principal em 3 colunas SEMPRE */}
            <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
                {/* Clube A */}
                <div className="flex items-center gap-2 min-w-0">
                    <div className="w-10 shrink-0">
                        <img
                            src={crestUrl(m.clubADetails?.crestAssetId)}
                            onError={(e) => ((e.currentTarget.src = FALLBACK_LOGO))}
                            alt={`Escudo ${m.clubAName}`}
                            style={{ width: AVATAR_PX, height: AVATAR_PX }}
                            className="rounded-full object-contain bg-white border"
                            loading="lazy"
                        />
                    </div>
                    <div className="min-w-0">
                        <div className="truncate leading-tight font-medium" title={m.clubAName}>{m.clubAName}</div>
                        <div className="flex items-center gap-2 mt-1">
                            <div className="w-10 shrink-0 flex justify-center">
                                <KitJersey
                                    colors={[m.clubADetails?.kitColor1, m.clubADetails?.kitColor2, m.clubADetails?.kitColor3, m.clubADetails?.kitColor4]}
                                    pattern={patternA}
                                    sizePx={AVATAR_PX}
                                    title={`Camisa ${m.clubAName}`}
                                />
                            </div>
                            <RedCardBadge count={m.clubARedCards} />
                        </div>
                    </div>
                </div>

                {/* Placar centralizado pelo grid */}
                <div className="justify-self-center place-self-center px-3 py-1 rounded bg-gray-50 font-semibold text-lg border text-center min-w-[84px]">
                    <span className={`${p.isMineA ? (p.myGoals > p.oppGoals ? "text-green-700" : p.myGoals < p.oppGoals ? "text-red-700" : "") : ""}`}>{m.clubAGoals}</span>
                    <span className="text-gray-400"> x </span>
                    <span className={`${!p.isMineA ? (p.myGoals > p.oppGoals ? "text-green-700" : p.myGoals < p.oppGoals ? "text-red-700" : "") : ""}`}>{m.clubBGoals}</span>
                </div>

                {/* Clube B */}
                <div className="flex items-center gap-2 min-w-0 md:justify-end md:flex-row-reverse">
                    <div className="w-10 shrink-0">
                        <img
                            src={crestUrl(m.clubBDetails?.crestAssetId)}
                            onError={(e) => ((e.currentTarget.src = FALLBACK_LOGO))}
                            alt={`Escudo ${m.clubBName}`}
                            style={{ width: AVATAR_PX, height: AVATAR_PX }}
                            className="rounded-full object-contain bg-white border"
                            loading="lazy"
                        />
                    </div>
                    <div className="min-w-0 md:text-right">
                        <div className="truncate leading-tight font-medium" title={m.clubBName}>{m.clubBName}</div>
                        <div className="flex items-center gap-2 mt-1 md:justify-end">
                            <div className="w-10 shrink-0 flex justify-center">
                                <KitJersey
                                    colors={[m.clubBDetails?.kitColor1, m.clubBDetails?.kitColor2, m.clubBDetails?.kitColor3, m.clubBDetails?.kitColor4]}
                                    pattern={patternB}
                                    sizePx={AVATAR_PX}
                                    title={`Camisa ${m.clubBName}`}
                                />
                            </div>
                            <RedCardBadge count={m.clubBRedCards} />
                        </div>
                    </div>
                </div>
            </div>

            {m.resultText && (
                <div className="mt-3 text-xs text-gray-500 line-clamp-2" title={m.resultText}>{m.resultText}</div>
            )}
        </Link>
    );
}

// ======================
// Página
// ======================
export default function Home() {
    const { club } = useClub();
    const clubId = club?.clubId;

    const [searchParams, setSearchParams] = useSearchParams();

    // Estado UI
    const [results, setResults] = useState<MatchResultDto[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [search, setSearch] = useState(searchParams.get("q") ?? "");
    const [matchType, setMatchType] = useState<MatchTypeFilter>((searchParams.get("type") as MatchTypeFilter) || "All");
    const [sortKey, setSortKey] = useState<SortKey>(() => {
        const v = (searchParams.get("sort") || "recent").toLowerCase();
        if (v === "goals" || v === "gf" || v === "goalsfor") return "gf";
        if (v === "ga" || v === "goalsagainst") return "ga";
        if (v === "oldest") return "oldest";
        return "recent";
    });

    // NOVO: estado do filtro de cartões vermelhos, inicializando via URL (?rc=none|1|2)
    const initialRc = (() => {
        const v = searchParams.get("rc");
        if (v === "none") return "none" as RedCardFilter;
        if (v === "1" || v === "1plus") return "1plus" as RedCardFilter;
        if (v === "2" || v === "2plus") return "2plus" as RedCardFilter;
        return "all" as RedCardFilter;
    })();
    const [redFilter, setRedFilter] = useState<RedCardFilter>(initialRc);

    const [visible, setVisible] = useState(30); // paginação no cliente

    // Atalhos
    const searchRef = useRef<HTMLInputElement | null>(null);
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "/") {
                e.preventDefault();
                searchRef.current?.focus();
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);

    // Persistência leve
    useEffect(() => {
        const rcParam = redFilter === "all" ? undefined : (redFilter === "none" ? "none" : redFilter === "1plus" ? "1" : "2");
        const payload = { q: search, type: matchType !== "All" ? matchType : undefined, sort: sortKey !== "recent" ? sortKey : undefined, rc: rcParam } as Record<string, string | undefined>;
        const next = new URLSearchParams();
        Object.entries(payload).forEach(([k, v]) => { if (v) next.set(k, v); });
        setSearchParams(next, { replace: true });
    }, [search, matchType, sortKey, redFilter, setSearchParams]);

    // Carregamento
    useEffect(() => {
        if (!clubId) {
            setResults([]);
            return;
        }
        let mounted = true;
        const controller = new AbortController();
        (async () => {
            try {
                setLoading(true);
                setError(null);

                const params: any = { clubId };
                if (matchType !== "All") params.matchType = matchType;

                const { data } = await api.get<MatchResultDto[]>(
                    "https://eafctracker-cvadcceuerbgegdj.brazilsouth-01.azurewebsites.net/api/Matches/matches/results",
                    { params, signal: (controller as any).signal }
                );
                if (mounted) {
                    setResults(Array.isArray(data) ? data : []);
                    setVisible(30);
                }
            } catch (err: any) {
                if (mounted) setError(err?.message ?? "Erro ao carregar resultados");
            } finally {
                if (mounted) setLoading(false);
            }
        })();
        return () => {
            mounted = false;
            controller.abort();
        };
    }, [clubId, matchType]);

    // Filtro + ordenação
    const filtered = useMemo(() => {
        const term = search.trim().toLowerCase();
        const byText = (m: MatchResultDto) => (term ? `${m.clubAName} ${m.clubBName}`.toLowerCase().includes(term) : true);
        const byReds = (m: MatchResultDto) => {
            const reds = (m.clubARedCards ?? 0) + (m.clubBRedCards ?? 0);
            if (redFilter === "none") return reds === 0;
            if (redFilter === "1plus") return reds >= 1;
            if (redFilter === "2plus") return reds >= 2;
            return true; // all
        };

        const base = results.filter((m) => byText(m) && byReds(m));

        // perspectiva do clube para ordenar por gols pró/contra
        const tRaw = (club as any)?.teamId;
        const myTeamIdNum = typeof tRaw === "number" ? tRaw : Number(tRaw);

        const sorted = [...base].sort((a, b) => {
            if (sortKey === "recent") return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
            if (sortKey === "oldest") return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();

            if (sortKey === "gf" || sortKey === "ga") {
                const pa = perspectiveFor(a, club?.clubName, Number.isFinite(myTeamIdNum) ? myTeamIdNum : undefined);
                const pb = perspectiveFor(b, club?.clubName, Number.isFinite(myTeamIdNum) ? myTeamIdNum : undefined);
                const va = sortKey === "gf" ? pa.myGoals : pa.oppGoals;
                const vb = sortKey === "gf" ? pb.myGoals : pb.oppGoals;
                if (vb !== va) return vb - va; // desc
                return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
            }

            // fallback (recent)
            return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
        });

        return sorted;
    }, [results, search, sortKey, redFilter, club?.clubName, (club as any)?.teamId]);

    // Resumo (perspectiva do clube selecionado)
    const summary = useMemo(() => {
        const tRaw = (club as any)?.teamId;
        const myTeamIdNum = typeof tRaw === "number" ? tRaw : Number(tRaw);
        const s = filtered.reduce((acc, m) => {
            const p = perspectiveFor(m, club?.clubName, Number.isFinite(myTeamIdNum) ? myTeamIdNum : undefined);
            acc.jogos++;
            acc.golsPro += p.myGoals;
            acc.golsContra += p.oppGoals;
            if (p.myGoals > p.oppGoals) acc.v++; else if (p.myGoals < p.oppGoals) acc.d++; else acc.e++;
            acc.cartoes += (m.clubARedCards ?? 0) + (m.clubBRedCards ?? 0);
            return acc;
        }, { jogos: 0, v: 0, e: 0, d: 0, golsPro: 0, golsContra: 0, cartoes: 0 });
        return { ...s, saldo: s.golsPro - s.golsContra };
    }, [filtered, club?.clubName, (club as any)?.teamId]);

    const hasResults = filtered.length > 0;

    return (
        <div className="p-4 max-w-5xl mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold">Resultados das Partidas</h1>
                    <p className="text-sm text-gray-600">
                        {clubId ? (
                            <>Clube atual: <span className="font-medium">{club?.clubName ?? clubId}</span></>
                        ) : (
                            <>Selecione um clube no topo (botão “Alterar clube”) para carregar os resultados.</>
                        )}
                    </p>
                </div>

                {/* Resumo rápido */}
                {hasResults && (
                    <div className="flex items-center flex-wrap gap-2 text-xs">
                        <Badge color="green">V: <span className="tabular-nums ml-1">{summary.v}</span></Badge>
                        <Badge color="amber">E: <span className="tabular-nums ml-1">{summary.e}</span></Badge>
                        <Badge color="red">D: <span className="tabular-nums ml-1">{summary.d}</span></Badge>
                        <Badge>GP: <span className="tabular-nums ml-1">{summary.golsPro}</span></Badge>
                        <Badge>GC: <span className="tabular-nums ml-1">{summary.golsContra}</span></Badge>
                        <Badge color={summary.saldo >= 0 ? "green" : "red"}>Saldo: <span className="tabular-nums ml-1">{summary.saldo}</span></Badge>
                        <Badge color={summary.cartoes > 0 ? "red" : "gray"}>Verm.: <span className="tabular-nums ml-1">{summary.cartoes}</span></Badge>
                    </div>
                )}
            </div>

            {/* Toolbar */}
            <div className="sticky top-0 z-20 -mx-4 px-4 py-3 bg-white/80 backdrop-blur border-b">
                <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3 flex-wrap">
                        <Segmented value={matchType} onChange={setMatchType} />
                        <ToolbarSeparator />
                        <div className="relative">
                            <input
                                ref={searchRef}
                                id="search"
                                type="text"
                                placeholder="Buscar clube A ou B (atalho: /)"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="border rounded-lg pl-9 pr-8 py-2 w-72 max-w-[90vw]"
                            />
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔎</span>
                            {search && (
                                <button
                                    aria-label="Limpar busca"
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                                    onClick={() => setSearch("")}
                                >×</button>
                            )}
                        </div>
                        {/* NOVO: Filtro por cartões vermelhos */}
                        <div className="flex items-center gap-2 text-sm">
                            <span className="text-gray-600">Vermelhos:</span>
                            <select className="border rounded-lg px-2 py-2" value={redFilter} onChange={(e) => setRedFilter(e.target.value as RedCardFilter)}>
                                <option value="all">Todos</option>
                                <option value="none">Nenhum</option>
                                <option value="1plus">1+</option>
                                <option value="2plus">2+</option>
                            </select>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                            <span className="text-gray-600">Ordenar:</span>
                            <select className="border rounded-lg px-2 py-2" value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)}>
                                <option value="recent">Mais recentes</option>
                                <option value="oldest">Mais antigas</option>
                                <option value="gf">Mais gols feitos</option>
                                    <option value="ga">Mais gols recebidos</option>
                                    </select>
                                </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                className="px-3 py-2 rounded-lg border bg-white hover:bg-gray-50"
                                onClick={() => {
                                    if (clubId) {
                                        const ev = new Event("visibilitychange");
                                        document.dispatchEvent(ev);
                                    }
                                    setMatchType((t) => t);
                                }}
                            >Atualizar</button>
                        </div>
                    </div>
                </div>

                {/* Estados */}
                {loading && (
                    <div className="grid gap-3 mt-4">
                        <Skeleton className="h-20" />
                        <Skeleton className="h-20" />
                        <Skeleton className="h-20" />
                    </div>
                )}

                {error && (
                    <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded flex items-center justify-between">
                        <span>{error}</span>
                        <button className="px-3 py-1.5 rounded-lg border bg-white hover:bg-red-50" onClick={() => setMatchType((t) => t)}>Tentar novamente</button>
                    </div>
                )}

                {!loading && !error && clubId && filtered.length === 0 && (
                    <div className="mt-4 p-3 bg-gray-50 border rounded text-gray-700">
                        Nenhum resultado encontrado. Dicas:
                        <ul className="list-disc ml-5 mt-2 text-sm text-gray-600">
                            <li>Verifique a grafia dos clubes.</li>
                            <li>Altere o filtro de tipo (Todos/Liga/Playoff).</li>
                            <li>Ajuste o filtro de cartões vermelhos.</li>
                        </ul>
                    </div>
                )}

                {!clubId && (
                    <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-yellow-800">
                        Informe um clube no menu (botão “Alterar clube”) para começar.
                    </div>
                )}

                {/* Lista simples (sem cabeçalho por dia) */}
                <div className="mt-4 grid gap-2">
                    {filtered.slice(0, visible).map((m) => (
                        <MatchCard key={m.matchId} m={m} matchType={matchType} />
                    ))}
                </div>

                {/* Paginação cliente */}
                {hasResults && visible < filtered.length && (
                    <div className="flex justify-center mt-4">
                        <button
                            className="px-4 py-2 rounded-lg border bg-white hover:bg-gray-50"
                            onClick={() => setVisible((v) => v + 30)}
                        >
                            Mostrar mais ({Math.min(filtered.length - visible, 30)})
                        </button>
                    </div>
                )}

                {/* Rodapé */}
                {hasResults && (
                    <div className="mt-8 text-xs text-gray-500 text-center">Exibindo {Math.min(visible, filtered.length)} de {filtered.length} partidas.</div>
                )}
            </div>
            );
}
