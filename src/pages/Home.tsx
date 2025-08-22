import React, { useEffect, useMemo, useState, useId } from "react";
import { Link } from "react-router-dom";
import api from "../services/api.ts";
import { useClub } from "../hooks/useClub.tsx";

// ======================
// Tipos
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

    // ⬇️ novos campos para cartões vermelhos
    clubARedCards?: number | null;
    clubBRedCards?: number | null;

    resultText?: string;
}

type MatchTypeFilter = "All" | "League" | "Playoff";

// ======================
// Helpers
// ======================
const fmtDateTime = new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" });

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

// ======================
// Mini camisa (SVG) com padrões
// patterns: plain | hoops | stripes | sash | halves | quarters
// cores: c1=corpo, c2=mangas (fallback c1), c3=gola, c4=detalhe/listras
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
        // mangas (clip)
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
        // mangas (clip) — verticais “curtas”
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
            {/* mangas com um toque */}
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

            {/* mangas base */}
            <polygon points="20,18 12,22 12,32 20,28" fill={sleeves} />
            <polygon points="44,18 52,22 52,32 44,28" fill={sleeves} />

            {/* corpo base */}
            <rect x={20} y={18} width={24} height={34} rx={4} fill={body} />

            {/* padrões */}
            {pattern === "hoops" && renderHoops()}
            {pattern === "stripes" && renderStripes()}
            {pattern === "sash" && renderSash()}
            {pattern === "halves" && renderHalves()}
            {pattern === "quarters" && renderQuarters()}

            {/* gola (V) */}
            <polygon points="28,14 32,20 36,14" fill={collar} />

            {/* contorno */}
            <rect x={20} y={18} width={24} height={34} rx={4} fill="none" stroke="rgba(0,0,0,0.15)" />
            <polyline points="20,18 12,22 12,32 20,28" fill="none" stroke="rgba(0,0,0,0.15)" />
            <polyline points="44,18 52,22 52,32 44,28" fill="none" stroke="rgba(0,0,0,0.15)" />
        </svg>
    );
}

// ============= Heurística de padrão (até termos o template real) =============
const KNOWN_TEMPLATES: Record<string, JerseyPattern> = {
    // mapeie IDs reais do jogo aqui, ex:
    // "TMP_001": "plain",
    // "TMP_023": "stripes",
    // "SASH_A": "sash",
};

function guessPattern(details?: ClubDetailsDto | null): JerseyPattern {
    const txt =
        (details?.customKitId ?? "") +
        "|" +
        (details?.kitId ?? "") +
        "|" +
        (details?.dCustomKit ?? "");

    // 1) se mapeado explicitamente
    for (const key of Object.keys(KNOWN_TEMPLATES)) {
        if (txt.includes(key)) return KNOWN_TEMPLATES[key];
    }

    // 2) heurísticas leves com base em cores/strings
    const hasC4 = !!details?.kitColor4;
    const hint = txt.toLowerCase();
    if (hint.includes("sash")) return "sash";
    if (hint.includes("stripe")) return "stripes";
    if (hint.includes("hoop")) return "hoops";
    if (hint.includes("half")) return "halves";
    if (hint.includes("quarter")) return "quarters";

    // fallback: se houver 4ª cor, usar hoops; senão liso
    return hasC4 ? "hoops" : "plain";
}

// ======================
// UI helpers
// ======================
function Skeleton({ className = "" }: { className?: string }) {
    return <div className={`animate-pulse bg-gray-200 rounded ${className}`} />;
}

// Badge de cartões vermelhos
function RedCardBadge({ count }: { count?: number | null }) {
    const c = typeof count === "number" ? count : 0;
    const has = c > 0;
    return (
        <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] 
            ${has ? "bg-red-50 border-red-200 text-red-700" : "bg-gray-50 border-gray-200 text-gray-400"}`}
            title={`Cartões vermelhos: ${c}`}
            aria-label={`Cartões vermelhos: ${c}`}
        >
            <span className={`inline-block w-2.5 h-3.5 rounded-[2px] ${has ? "bg-red-600" : "bg-gray-300"}`} />
            <span className="tabular-nums">{c}</span>
        </span>
    );
}

function MatchCard({ m, matchType }: { m: MatchResultDto; matchType: MatchTypeFilter }) {
    const patternA = guessPattern(m.clubADetails);
    const patternB = guessPattern(m.clubBDetails);

    return (
        <Link
            to={`/match/${m.matchId}?matchType=${matchType}`}
            className="block bg-white shadow-sm rounded-xl p-4 hover:shadow transition border"
            title="Ver detalhes da partida"
        >
            <div className="text-center text-xs text-gray-500 mb-3">
                {fmtDateTime.format(new Date(m.timestamp))}
            </div>

            <div className="flex items-center justify-between gap-2">
                {/* Clube A */}
                <div className="flex-1 flex items-center gap-2">
                    <img
                        src={crestUrl(m.clubADetails?.crestAssetId)}
                        onError={(e) => ((e.currentTarget.src = FALLBACK_LOGO))}
                        alt={`Escudo ${m.clubAName}`}
                        style={{ width: AVATAR_PX, height: AVATAR_PX }}
                        className="rounded-full object-contain bg-white border"
                        loading="lazy"
                    />
                    <div className="min-w-0">
                        <div className="truncate leading-tight">{m.clubAName}</div>
                        {/* Camisa + badge */}
                        <div className="flex items-center gap-2 mt-1">
                            <KitJersey
                                colors={[
                                    m.clubADetails?.kitColor1,
                                    m.clubADetails?.kitColor2,
                                    m.clubADetails?.kitColor3,
                                    m.clubADetails?.kitColor4,
                                ]}
                                pattern={patternA}
                                sizePx={AVATAR_PX}
                                title={`Camisa ${m.clubAName}`}
                            />
                            <RedCardBadge count={m.clubARedCards} />
                        </div>
                    </div>
                </div>

                {/* Placar */}
                <div className="px-3 py-1 rounded bg-gray-50 font-semibold text-lg border text-center min-w-[72px]">
                    {m.clubAGoals} <span className="text-gray-400">x</span> {m.clubBGoals}
                </div>

                {/* Clube B */}
                <div className="flex-1 flex items-center gap-2 justify-end">
                    <div className="min-w-0 text-right">
                        <div className="truncate leading-tight">{m.clubBName}</div>
                        <div className="flex items-center justify-end gap-2 mt-1">
                            <KitJersey
                                colors={[
                                    m.clubBDetails?.kitColor1,
                                    m.clubBDetails?.kitColor2,
                                    m.clubBDetails?.kitColor3,
                                    m.clubBDetails?.kitColor4,
                                ]}
                                pattern={patternB}
                                sizePx={AVATAR_PX}
                                title={`Camisa ${m.clubBName}`}
                            />
                            <RedCardBadge count={m.clubBRedCards} />
                        </div>
                    </div>
                    <img
                        src={crestUrl(m.clubBDetails?.crestAssetId)}
                        onError={(e) => ((e.currentTarget.src = FALLBACK_LOGO))}
                        alt={`Escudo ${m.clubBName}`}
                        style={{ width: AVATAR_PX, height: AVATAR_PX }}
                        className="rounded-full object-contain bg-white border"
                        loading="lazy"
                    />
                </div>
            </div>
        </Link>
    );
}

// ======================
// Página
// ======================
export default function Home() {
    const { club } = useClub();
    const clubId = club?.clubId;

    const [results, setResults] = useState<MatchResultDto[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [search, setSearch] = useState("");
    const [onlyWithLogos, setOnlyWithLogos] = useState(false);
    const [matchType, setMatchType] = useState<MatchTypeFilter>("All");

    useEffect(() => {
        if (!clubId) {
            setResults([]);
            return;
        }
        let cancel = false;
        (async () => {
            try {
                setLoading(true);
                setError(null);

                const params: any = { clubId };
                if (matchType !== "All") params.matchType = matchType;

                const { data } = await api.get<MatchResultDto[]>(
                    "https://eafctracker-cvadcceuerbgegdj.brazilsouth-01.azurewebsites.net/api/Matches/matches/results",
                    { params }
                );

                if (!cancel) setResults(data ?? []);
            } catch (err: any) {
                if (!cancel) setError(err?.message ?? "Erro ao carregar resultados");
            } finally {
                if (!cancel) setLoading(false);
            }
        })();
        return () => { cancel = true; };
    }, [clubId, matchType]);

    const filtered = useMemo(() => {
        const term = search.trim().toLowerCase();
        return results
            .filter((m) => (term ? `${m.clubAName} ${m.clubBName}`.toLowerCase().includes(term) : true))
            .filter((m) =>
                onlyWithLogos
                    ? Boolean(m.clubADetails?.crestAssetId) && Boolean(m.clubBDetails?.crestAssetId)
                    : true
            )
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }, [results, search, onlyWithLogos]);

    return (
        <div className="p-4 max-w-4xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold">Resultados das Partidas</h1>
                    <p className="text-sm text-gray-600">
                        {clubId ? (
                            <>Clube atual: <span className="font-medium">{club?.clubName ?? clubId}</span></>
                        ) : (
                            <>Selecione um clube no topo (“Alterar clube”) para carregar os resultados.</>
                        )}
                    </p>
                </div>

                <div className="flex gap-3 items-end">
                    {/* Dropdown de tipo */}
                    <div className="flex flex-col">
                        <label htmlFor="matchType" className="text-sm text-gray-600">Tipo</label>
                        <select
                            id="matchType"
                            value={matchType}
                            onChange={(e) => setMatchType(e.target.value as MatchTypeFilter)}
                            className="border rounded-lg px-3 py-2 w-40 bg-white"
                        >
                            <option value="All">Todos</option>
                            <option value="League">League</option>
                            <option value="Playoff">Playoff</option>
                        </select>
                    </div>

                    {/* Buscar */}
                    <div className="flex flex-col">
                        <label htmlFor="search" className="text-sm text-gray-600">Buscar</label>
                        <input
                            id="search"
                            type="text"
                            placeholder="Clube A ou B"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="border rounded-lg px-3 py-2 w-56"
                        />
                    </div>

                    {/* Filtro: somente com logos (opcional) */}
                    <div className="flex items-center gap-2 mt-2 sm:mt-0">
                        <input
                            id="onlyWithLogos"
                            type="checkbox"
                            checked={onlyWithLogos}
                            onChange={(e) => setOnlyWithLogos(e.target.checked)}
                            className="h-4 w-4"
                        />
                        <label htmlFor="onlyWithLogos" className="text-sm text-gray-600">Somente com logos</label>
                    </div>
                </div>
            </div>

            {loading && (
                <div className="grid gap-3">
                    <Skeleton className="h-20" />
                    <Skeleton className="h-20" />
                    <Skeleton className="h-20" />
                </div>
            )}

            {error && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded">{error}</div>
            )}

            {!loading && !error && clubId && filtered.length === 0 && (
                <div className="p-3 bg-gray-50 border rounded text-gray-700">Nenhum resultado encontrado.</div>
            )}

            {!clubId && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded text-yellow-800">
                    Informe um clube no menu (boo “Alterar clube”) para começar.
                </div>
            )}

            <div className="grid gap-3">
                {filtered.map((m) => (
                    <MatchCard key={m.matchId} m={m} matchType={matchType} />
                ))}
            </div>
        </div>
    );
}
