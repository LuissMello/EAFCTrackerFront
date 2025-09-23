import React, { useEffect, useMemo, useRef, useState, useId, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api from "../services/api.ts";
import { useClub } from "../hooks/useClub.tsx";
import { Crown, Hand, Star, Square } from "lucide-react";

/* ======================
   Tipos
====================== */
interface ClubDetailsDto {
    name?: string | null;
    clubId?: number | null;
    regionId?: number | null;
    teamId?: number | null;
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
    selectedKitType?: string | null;
    // PascalCase aliases
    Name?: string | null;
    StadName?: string | null;
    CrestAssetId?: string | null;
    TeamId?: number | null;
}

interface ClubMatchSummaryDto {
    redCards: number;
    hadHatTrick: boolean;
    hatTrickPlayerNames: Array<string | null>;
    goalkeeperPlayerName?: string | null;
    manOfTheMatchPlayerName?: string | null;
}

interface MatchResultDto {
    matchId: number;
    timestamp: string;

    clubAName: string;
    clubAGoals: number;
    clubARedCards?: number | null;
    clubAPlayerCount?: number | null;
    clubADetails?: ClubDetailsDto | null;
    clubASummary?: ClubMatchSummaryDto | null;

    clubBName: string;
    clubBGoals: number;
    clubBRedCards?: number | null;
    clubBPlayerCount?: number | null;
    clubBDetails?: ClubDetailsDto | null;
    clubBSummary?: ClubMatchSummaryDto | null;

    resultText?: string | null;
}

type MatchTypeFilter = "All" | "League" | "Playoff";
type SortKey = "recent" | "oldest" | "gf" | "ga";
type RedCardFilter = "all" | "none" | "1plus" | "2plus";

/* ======================
   Helpers
====================== */
const fmtDateTime = new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" });
const rtf = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });

const FALLBACK_LOGO = "https://via.placeholder.com/96?text=Logo";
const AVATAR_PX = 40;

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

/** Perspectiva antiga (fallback) */
function perspectiveForByNameOrTeam(
    m: MatchResultDto,
    myClubName?: string | null,
    myTeamIdNum?: number
) {
    if (typeof myTeamIdNum === "number" && Number.isFinite(myTeamIdNum)) {
        if (m.clubADetails?.teamId === myTeamIdNum || m.clubADetails?.TeamId === myTeamIdNum)
            return { myGoals: m.clubAGoals, oppGoals: m.clubBGoals, isMineA: true };
        if (m.clubBDetails?.teamId === myTeamIdNum || m.clubBDetails?.TeamId === myTeamIdNum)
            return { myGoals: m.clubBGoals, oppGoals: m.clubAGoals, isMineA: false };
    }
    const name = (myClubName ?? "").toLowerCase();
    if (name) {
        if ((m.clubAName ?? "").toLowerCase() === name) return { myGoals: m.clubAGoals, oppGoals: m.clubBGoals, isMineA: true };
        if ((m.clubBName ?? "").toLowerCase() === name) return { myGoals: m.clubBGoals, oppGoals: m.clubAGoals, isMineA: false };
    }
    return { myGoals: m.clubAGoals, oppGoals: m.clubBGoals, isMineA: true };
}

/** Nova perspectiva para multi seleção de clubes */
function perspectiveForSelected(
    m: MatchResultDto,
    selectedClubIds: number[],
    fallbackClubName?: string | null,
    fallbackTeamId?: number
) {
    const aId = m.clubADetails?.clubId ?? null;
    const bId = m.clubBDetails?.clubId ?? null;

    if (aId && selectedClubIds.includes(Number(aId))) {
        return { myGoals: m.clubAGoals, oppGoals: m.clubBGoals, isMineA: true };
    }
    if (bId && selectedClubIds.includes(Number(bId))) {
        return { myGoals: m.clubBGoals, oppGoals: m.clubAGoals, isMineA: false };
    }

    // fallback (ex.: dados sem clubId nas details)
    return perspectiveForByNameOrTeam(m, fallbackClubName, fallbackTeamId);
}

/* ======================
   UI
====================== */
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

const PersonIcon = ({ className = "" }: { className?: string }) => (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden className={className}>
        <path fill="currentColor" d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5Zm0 2c-4.42 0-8 2.24-8 5v1h16v-1c0-2.76-3.58-5-8-5Z" />
    </svg>
);

/* ======================
   Jersey (SVG)
====================== */
type JerseyPattern = "plain" | "hoops" | "stripes" | "sash" | "halves" | "quarters";
const KNOWN_TEMPLATES: Record<string, JerseyPattern> = {};

function guessPattern(details?: ClubDetailsDto | null): JerseyPattern {
    const txt =
        ((details?.customKitId || details?.KitId || details?.kitId) ?? "") +
        "|" +
        ((details?.kitId || details?.KitId) ?? "") +
        "|" +
        (details?.dCustomKit ?? (details as any)?.DCustomKit ?? "");

    for (const key of Object.keys(KNOWN_TEMPLATES)) {
        if (txt.includes(key)) return KNOWN_TEMPLATES[key];
    }
    const hasC4 = !!(details?.kitColor4 ?? (details as any)?.KitColor4);
    const hint = txt.toLowerCase();
    if (hint.includes("sash")) return "sash";
    if (hint.includes("stripe")) return "stripes";
    if (hint.includes("hoop")) return "hoops";
    if (hint.includes("half")) return "halves";
    if (hint.includes("quarter")) return "quarters";
    return hasC4 ? "hoops" : "plain";
}

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
    const raw = useId();
    const uidRef = useRef(`jersey-${raw.replace(/[^a-zA-Z0-9_-]/g, "")}-${Math.random().toString(36).slice(2, 7)}`);
    const uid = uidRef.current;

    const idBody = `${uid}-body`;
    const idSlL = `${uid}-slL`;
    const idSlR = `${uid}-slR`;
    const needsSleeveClips = pattern === "hoops" || pattern === "stripes" || pattern === "sash";

    const [c1, c2, c3, c4] = [
        toHex(colors[0]) ?? "#9CA3AF",
        toHex(colors[1]) ?? undefined,
        toHex(colors[2]) ?? "#111827",
        toHex(colors[3]) ?? undefined,
    ];

    const body = c1;
    const sleeves = c2 ?? body;
    const collar = c3!;
    const accent = c4 ?? sleeves;

    const bodyX = 20, bodyY = 18, bodyW = 24, bodyH = 34;
    const slLy1 = 18, slLy2 = 32;
    const slRy1 = 18, slRy2 = 32;

    const renderHoops = () => {
        const stripeCount = 5;
        const gap = 2;
        const h = (bodyH - (stripeCount - 1) * gap) / stripeCount;
        const rows: JSX.Element[] = [];
        for (let i = 0; i < stripeCount; i++) {
            const y = bodyY + i * (h + gap);
            rows.push(<rect key={`b-${i}`} x={bodyX} y={y} width={bodyW} height={h} fill={accent} />);
        }
        const sleeveTop = slLy1, sleeveBottom = slLy2;
        const sleeveH = sleeveBottom - sleeveTop;
        const stripeCountS = 4, gapS = 1.5;
        const hS = (sleeveH - (stripeCountS - 1) * gapS) / stripeCountS;
        const slRowsL: JSX.Element[] = [], slRowsR: JSX.Element[] = [];
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
            <g clipPath={`url(#${idSlL})`}>
                <rect x={12} y={26} width={8} height={3} fill={accent} />
            </g>
            <g clipPath={`url(#${idSlR})`}>
                <rect x={44} y={22} width={8} height={3} fill={accent} />
            </g>
        </>
    );

    const renderHalves = () => (
        <>
            <rect x={20} y={18} width={bodyW / 2} height={bodyH} rx={0} fill={body} />
            <rect x={20 + bodyW / 2} y={18} width={bodyW / 2} height={bodyH} rx={0} fill={accent} />
        </>
    );

    const renderQuarters = () => (
        <>
            <rect x={20} y={18} width={bodyW / 2} height={bodyH / 2} fill={body} />
            <rect x={20 + bodyW / 2} y={18} width={bodyW / 2} height={bodyH / 2} fill={accent} />
            <rect x={20} y={18 + bodyH / 2} width={bodyW / 2} height={bodyH / 2} fill={accent} />
            <rect x={20 + bodyW / 2} y={18 + bodyH / 2} width={bodyW / 2} height={bodyH / 2} fill={body} />
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
            style={{ overflow: "visible", display: "block" }}
        >
            <defs>
                <clipPath id={idBody}>
                    <rect x={20} y={18} width={24} height={34} rx={4} />
                </clipPath>
                {needsSleeveClips && (
                    <>
                        <clipPath id={idSlL}>
                            <polygon points="20,18 12,22 12,32 20,28" />
                        </clipPath>
                        <clipPath id={idSlR}>
                            <polygon points="44,18 52,22 52,32 44,28" />
                        </clipPath>
                    </>
                )}
            </defs>

            {/* mangas */}
            <polygon points="20,18 12,22 12,32 20,28" fill={sleeves} />
            <polygon points="44,18 52,22 52,32 44,28" fill={sleeves} />

            {/* tronco */}
            <rect x={20} y={18} width={24} height={34} rx={4} fill={body} />

            {pattern === "hoops" && renderHoops()}
            {pattern === "stripes" && renderStripes()}
            {pattern === "sash" && renderSash()}
            {pattern === "halves" && renderHalves()}
            {pattern === "quarters" && renderQuarters()}

            {/* gola + contornos */}
            <polygon points="28,14 32,20 36,14" fill={collar} />
            <rect x={20} y={18} width={24} height={34} rx={4} fill="none" stroke="rgba(0,0,0,0.15)" />
            <polyline points="20,18 12,22 12,32 20,28" fill="none" stroke="rgba(0,0,0,0.15)" />
            <polyline points="44,18 52,22 52,32 44,28" fill="none" stroke="rgba(0,0,0,0.15)" />
        </svg>
    );
}

/* ======================
   Novo: Card de Resumo
====================== */
function Chip({
    children,
    className = "",
    title,
}: {
    children: React.ReactNode;
    className?: string;
    title?: string;
}) {
    return (
        <span
            title={title}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border text-[12px] ${className}`}
        >
            {children}
        </span>
    );
}

function SummaryItem({
    title,
    redCards,
    hatTrickNames,
    goalkeeperName,
    motmName,
    align = "left",
}: {
    title: string;
    redCards?: number | null;
    hatTrickNames?: Array<string | null>;
    goalkeeperName?: string | null;
    motmName?: string | null;
    align?: "left" | "right";
}) {
    const reds = typeof redCards === "number" ? redCards : 0;
    const textAlign = align === "right" ? "text-right" : "text-left";
    const dir = align === "right" ? "justify-end" : "justify-start";

    const hatList = (hatTrickNames ?? []).filter((n): n is string => !!n);

    return (
        <div className={`flex flex-col gap-1 ${textAlign}`}>
            <div className={`flex ${dir} gap-2 flex-wrap items-center`}>
                {/* Vermelhos */}
                <Chip
                    title={`Cartões vermelhos: ${reds}`}
                    className={`${reds > 0 ? "bg-red-50 border-red-200 text-red-700" : "bg-gray-50 border-gray-200 text-gray-400"}`}
                >
                    <Square className={`${reds > 0 ? "text-red-600" : "text-gray-300"}`} size={14} />
                    <span className="tabular-nums">{reds}</span>
                </Chip>

                {/* Hat-tricks */}
                {hatList.length === 0 ? (
                    <Chip className="bg-gray-50 border-gray-200 text-gray-400" title="Sem hat-trick">
                        <Crown size={14} className="text-gray-400" />
                        <span>—</span>
                    </Chip>
                ) : (
                    hatList.map((name, i) => (
                        <Chip
                            key={`${name}-${i}`}
                            className="bg-green-50 border-green-200 text-green-700"
                            title={`Hat-trick: ${name}`}
                        >
                            <Crown size={14} className="text-green-700" />
                            <span className="truncate max-w-[180px]">{name}</span>
                        </Chip>
                    ))
                )}

                {/* Goleiro */}
                <Chip
                    className={`${goalkeeperName ? "bg-blue-50 border-blue-200 text-blue-700" : "bg-gray-50 border-gray-200 text-gray-400"}`}
                    title={goalkeeperName ? `Goleiro: ${goalkeeperName}` : "Goleiro não identificado"}
                >
                    <Hand size={14} className={`${goalkeeperName ? "text-blue-700" : "text-gray-400"}`} />
                    <span className="truncate max-w-[180px]">{goalkeeperName ?? "—"}</span>
                </Chip>

                {/* Man of the Match */}
                <Chip
                    className={`${motmName ? "bg-amber-50 border-amber-200 text-amber-700" : "bg-gray-50 border-gray-200 text-gray-400"}`}
                    title={motmName ? `Man of the Match: ${motmName}` : "Sem Man of the Match"}
                >
                    <Star size={14} className={`${motmName ? "text-amber-600" : "text-gray-400"}`} />
                    <span className="truncate max-w-[180px]">{motmName ?? "—"}</span>
                </Chip>
            </div>
        </div>
    );
}

function SummaryCard({ m }: { m: MatchResultDto }) {
    const a = m.clubASummary;
    const b = m.clubBSummary;
    return (
        <div className="mt-3 p-3 sm:p-4 rounded-lg border bg-white/70">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-6">
                <SummaryItem
                    title={m.clubAName}
                    redCards={a?.redCards ?? m.clubARedCards ?? 0}
                    hatTrickNames={a?.hatTrickPlayerNames}
                    goalkeeperName={a?.goalkeeperPlayerName ?? null}
                    motmName={a?.manOfTheMatchPlayerName ?? null}
                    align="left"
                />
                <SummaryItem
                    title={m.clubBName}
                    redCards={b?.redCards ?? m.clubBRedCards ?? 0}
                    hatTrickNames={b?.hatTrickPlayerNames}
                    goalkeeperName={b?.goalkeeperPlayerName ?? null}
                    motmName={b?.manOfTheMatchPlayerName ?? null}
                    align="right"
                />
            </div>
        </div>
    );
}

/* ======================
   Card de partida
====================== */
function MatchCard({
    m,
    matchType,
    selectedClubIds,
    fallbackClubName,
    fallbackTeamId,
}: {
    m: MatchResultDto;
    matchType: MatchTypeFilter;
    selectedClubIds: number[];
    fallbackClubName?: string | null;
    fallbackTeamId?: number;
}) {
    const patternA = guessPattern(m.clubADetails);
    const patternB = guessPattern(m.clubBDetails);

    const p = perspectiveForSelected(m, selectedClubIds, fallbackClubName, fallbackTeamId);
    const outcome = p.myGoals === p.oppGoals ? "draw" : p.myGoals > p.oppGoals ? "win" : "loss";
    const borderClass = outcome === "win" ? "border-green-200" : outcome === "loss" ? "border-red-200" : "border-gray-200";

    const stadiumName =
        m.clubADetails?.stadName ?? m.clubADetails?.StadName ?? m.clubADetails?.name ?? m.clubADetails?.Name ?? m.clubAName;

    return (
        <Link
            to={`/match/${m.matchId}?matchType=${matchType}`}
            className={`block bg-white rounded-lg sm:rounded-xl p-3 sm:p-4 border transition shadow-sm hover:shadow ${borderClass}`}
            title="Ver detalhes da partida"
        >
            {/* Topo: data + selo de resultado */}
            <div className="flex items-center justify-between gap-2">
                <div className="text-xs text-gray-500">
                    <span className="hidden sm:inline">{fmtDateTime.format(new Date(m.timestamp))}</span>
                    <span className="sm:hidden">{fmtDateTime.format(new Date(m.timestamp))}</span>
                </div>
                <OutcomeBadge a={p.myGoals} b={p.oppGoals} />
            </div>

            {/* DESKTOP: times + placar */}
            <div className="hidden sm:grid items-center justify-center grid-cols-[auto_auto_auto] sm:gap-6 sm:max-w-[820px] sm:mx-auto mt-2">
                {/* A */}
                <div className="flex items-center gap-2 min-w-0">
                    <div className="w-10 shrink-0">
                        <img
                            src={crestUrl(m.clubADetails?.crestAssetId ?? m.clubADetails?.CrestAssetId ?? null)}
                            onError={(e) => ((e.currentTarget.src = FALLBACK_LOGO))}
                            alt={`Escudo ${m.clubAName}`}
                            style={{ width: AVATAR_PX, height: AVATAR_PX }}
                            className="rounded-full object-contain bg-white border"
                            loading="lazy"
                        />
                    </div>
                    <div className="min-w-0">
                        <div className="leading-tight font-medium sm:truncate" title={m.clubAName}>{m.clubAName}</div>
                        <div className="flex items-center gap-2 mt-1">
                            <div className="w-10 shrink-0 flex justify-center overflow-visible">
                                <KitJersey
                                    colors={[
                                        m.clubADetails?.kitColor1 ?? (m.clubADetails as any)?.KitColor1,
                                        m.clubADetails?.kitColor2 ?? (m.clubADetails as any)?.KitColor2,
                                        m.clubADetails?.kitColor3 ?? (m.clubADetails as any)?.KitColor3,
                                        m.clubADetails?.kitColor4 ?? (m.clubADetails as any)?.KitColor4,
                                    ]}
                                    pattern={patternA}
                                    sizePx={AVATAR_PX}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Placar */}
                <div className="justify-self-center place-self-center px-3 py-1 rounded bg-gray-50 font-semibold text-base sm:text-lg border text-center min-w-[72px]">
                    <span className={`${p.isMineA ? (p.myGoals > p.oppGoals ? "text-green-700" : p.myGoals < p.oppGoals ? "text-red-700" : "") : ""}`}>{m.clubAGoals}</span>
                    <span className="text-gray-400"> x </span>
                    <span className={`${!p.isMineA ? (p.myGoals > p.oppGoals ? "text-green-700" : p.myGoals < p.oppGoals ? "text-red-700" : "") : ""}`}>{m.clubBGoals}</span>
                </div>

                {/* B */}
                <div className="flex items-center gap-2 min-w-0 justify-end">
                    <div className="w-10 shrink-0">
                        <img
                            src={crestUrl(m.clubBDetails?.crestAssetId ?? m.clubBDetails?.CrestAssetId ?? null)}
                            onError={(e) => ((e.currentTarget.src = FALLBACK_LOGO))}
                            alt={`Escudo ${m.clubBName}`}
                            style={{ width: AVATAR_PX, height: AVATAR_PX }}
                            className="rounded-full object-contain bg-white border"
                            loading="lazy"
                        />
                    </div>
                    <div className="min-w-0 text-right">
                        <div className="leading-tight font-medium sm:truncate" title={m.clubBName}>{m.clubBName}</div>
                        <div className="flex items-center gap-2 mt-1 justify-end">
                            <div className="w-10 shrink-0 flex justify-end overflow-visible">
                                <KitJersey
                                    colors={[
                                        m.clubBDetails?.kitColor1 ?? (m.clubBDetails as any)?.KitColor1,
                                        m.clubBDetails?.kitColor2 ?? (m.clubBDetails as any)?.KitColor2,
                                        m.clubBDetails?.kitColor3 ?? (m.clubBDetails as any)?.KitColor3,
                                        m.clubBDetails?.kitColor4 ?? (m.clubBDetails as any)?.KitColor4,
                                    ]}
                                    pattern={patternB}
                                    sizePx={AVATAR_PX}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* MOBILE: times + placar */}
            <div className="sm:hidden mt-2 space-y-2">
                {/* Linha 1: nomes + escudos */}
                <div className="flex items-center justify-between gap-3">
                    {/* A */}
                    <div className="flex items-center gap-2 min-w-0">
                        <img
                            src={crestUrl(m.clubADetails?.crestAssetId ?? m.clubADetails?.CrestAssetId ?? null)}
                            onError={(e) => ((e.currentTarget.src = FALLBACK_LOGO))}
                            alt={`Escudo ${m.clubAName}`}
                            style={{ width: AVATAR_PX, height: AVATAR_PX }}
                            className="rounded-full object-contain bg-white border shrink-0"
                            loading="lazy"
                        />
                        <div className="min-w-0">
                            <div className="font-medium leading-snug whitespace-normal break-words">{m.clubAName}</div>
                        </div>
                    </div>

                    {/* B */}
                    <div className="flex items-center gap-2 min-w-0">
                        <div className="min-w-0 text-right">
                            <div className="font-medium leading-snug whitespace-normal break-words">{m.clubBName}</div>
                        </div>
                        <img
                            src={crestUrl(m.clubBDetails?.crestAssetId ?? m.clubBDetails?.CrestAssetId ?? null)}
                            onError={(e) => ((e.currentTarget.src = FALLBACK_LOGO))}
                            alt={`Escudo ${m.clubBName}`}
                            style={{ width: AVATAR_PX, height: AVATAR_PX }}
                            className="rounded-full object-contain bg-white border shrink-0"
                            loading="lazy"
                        />
                    </div>
                </div>

                {/* Linha 2: camisas */}
                <div className="flex items-start justify-between">
                    <div className="flex flex-col items-start gap-1">
                        <KitJersey
                            colors={[
                                m.clubADetails?.kitColor1 ?? (m.clubADetails as any)?.KitColor1,
                                m.clubADetails?.kitColor2 ?? (m.clubADetails as any)?.KitColor2,
                                m.clubADetails?.kitColor3 ?? (m.clubADetails as any)?.KitColor3,
                                m.clubADetails?.kitColor4 ?? (m.clubADetails as any)?.KitColor4,
                            ]}
                            pattern={guessPattern(m.clubADetails)}
                            sizePx={AVATAR_PX}
                        />
                    </div>

                    <div className="flex flex-col items-end gap-1">
                        <KitJersey
                            colors={[
                                m.clubBDetails?.kitColor1 ?? (m.clubBDetails as any)?.KitColor1,
                                m.clubBDetails?.kitColor2 ?? (m.clubBDetails as any)?.KitColor2,
                                m.clubBDetails?.kitColor3 ?? (m.clubBDetails as any)?.KitColor3,
                                m.clubBDetails?.kitColor4 ?? (m.clubBDetails as any)?.KitColor4,
                            ]}
                            pattern={guessPattern(m.clubBDetails)}
                            sizePx={AVATAR_PX}
                        />
                    </div>
                </div>

                {/* Placar centralizado */}
                <div className="mt-1 px-3 py-2 rounded-lg bg-gray-50 font-semibold text-lg border text-center mx-auto w-40">
                    <span className={`${p.isMineA ? (p.myGoals > p.oppGoals ? "text-green-700" : p.myGoals < p.oppGoals ? "text-red-700" : "") : ""}`}>{m.clubAGoals}</span>
                    <span className="text-gray-400"> x </span>
                    <span className={`${!p.isMineA ? (p.myGoals > p.oppGoals ? "text-green-700" : p.myGoals < p.oppGoals ? "text-red-700" : "") : ""}`}>{m.clubBGoals}</span>
                </div>
            </div>

            {/* Contagem de jogadores */}
            <div className="mt-3 flex items-center justify-center gap-3 text-base sm:text-sm">
                <div className="inline-flex items-center gap-1">
                    <PersonIcon className="text-gray-700" />
                    <span className="font-semibold tabular-nums">{m.clubAPlayerCount ?? "-"}</span>
                </div>
                <span className="text-gray-400">-</span>
                <div className="inline-flex items-center gap-1">
                    <span className="font-semibold tabular-nums">{m.clubBPlayerCount ?? "-"}</span>
                    <PersonIcon className="text-gray-700" />
                </div>
            </div>

            {/* Estádio */}
            <div className="mt-2 text-xs sm:text-sm text-gray-600 text-center font-medium">
                {stadiumName || "Estádio não informado"}
            </div>

            {/* Resumo com ícones */}
            <SummaryCard m={m} />
        </Link>
    );
}

/* ======================
   Página
====================== */
export default function Home() {
    const { club } = useClub();

    const [searchParams, setSearchParams] = useSearchParams();

    // Lê seleção múltipla da URL (?clubIds=1,2,3). Se não houver, usa o clubId único do contexto.
    const selectedClubIds: number[] = useMemo(() => {
        const raw = searchParams.get("clubIds");
        if (raw && raw.trim().length) {
            return raw.split(",").map(s => parseInt(s, 10)).filter(n => !Number.isNaN(n));
        }
        const single = searchParams.get("clubId");
        if (single && !Number.isNaN(parseInt(single, 10))) return [parseInt(single, 10)];
        if (club?.clubId) return [club.clubId];
        return [];
    }, [searchParams, club?.clubId]);

    const fallbackClubName = club?.clubName ?? null;
    const fallbackTeamId = (club as any)?.teamId as number | undefined;

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

    const initialRc = (() => {
        const v = searchParams.get("rc");
        if (v === "none") return "none" as RedCardFilter;
        if (v === "1" || v === "1plus") return "1plus" as RedCardFilter;
        if (v === "2" || v === "2plus") return "2plus" as RedCardFilter;
        return "all" as RedCardFilter;
    })();
    const [redFilter, setRedFilter] = useState<RedCardFilter>(initialRc);

    const initialOpp = (() => {
        const v = searchParams.get("opp");
        const n = v ? Number(v) : NaN;
        return Number.isFinite(n) && n >= 2 && n <= 11 ? n : null;
    })();
    const [opponentCount, setOpponentCount] = useState<number | null>(initialOpp);

    const [visible, setVisible] = useState(30);

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

    // Persistir filtros na URL (preservando clubIds/clubId)
    useEffect(() => {
        const rcParam =
            redFilter === "all" ? undefined :
                redFilter === "none" ? "none" :
                    redFilter === "1plus" ? "1" : "2";

        const oppParam = opponentCount ? String(opponentCount) : undefined;

        // clone seguro do estado atual da URL
        const next = new URLSearchParams(searchParams.toString());

        // atualiza apenas os filtros (preserva clubIds/clubId já presentes)
        if (search) next.set("q", search); else next.delete("q");
        if (matchType !== "All") next.set("type", matchType); else next.delete("type");
        if (sortKey !== "recent") next.set("sort", sortKey); else next.delete("sort");
        if (rcParam) next.set("rc", rcParam); else next.delete("rc");
        if (oppParam) next.set("opp", oppParam); else next.delete("opp");

        // evita setSearchParams desnecessário (e re-render em loop)
        const prevStr = searchParams.toString();
        const nextStr = next.toString();
        if (nextStr !== prevStr) {
            setSearchParams(next, { replace: true });
        }
    }, [
        search,
        matchType,
        sortKey,
        redFilter,
        opponentCount,
        searchParams,     // OK ter como dependência, com o guard acima não entra em loop
        setSearchParams
    ]);


    // Carregar resultados (multi seleção)
    useEffect(() => {
        let mounted = true;
        const controller = new AbortController();

        (async () => {
            try {
                setLoading(true);
                setError(null);
                setResults([]);

                if (selectedClubIds.length === 0) {
                    if (mounted) setLoading(false);
                    return;
                }

                const params: any = {};
                if (matchType !== "All") params.matchType = matchType;

                if (selectedClubIds.length === 1) {
                    // caso simples
                    const id = selectedClubIds[0];
                    const { data } = await api.get<MatchResultDto[]>(
                        `https://eafctracker-cvadcceuerbgegdj.brazilsouth-01.azurewebsites.net/api/clubs/${id}/matches/results`,
                        { params, signal: (controller as any).signal }
                    );
                    if (!mounted) return;
                    setResults(Array.isArray(data) ? data : []);
                    setVisible(30);
                    return;
                }

                // múltiplos clubes → busca em paralelo e agrega
                const reqs = selectedClubIds.map((id) =>
                    api.get<MatchResultDto[]>(
                        `https://eafctracker-cvadcceuerbgegdj.brazilsouth-01.azurewebsites.net/api/clubs/${id}/matches/results`,
                        { params, signal: (controller as any).signal }
                    ).then(r => r.data).catch(() => [])
                );

                const arrays = await Promise.all(reqs);
                if (!mounted) return;

                // merge + dedupe por matchId
                const merged = ([] as MatchResultDto[]).concat(...arrays);
                const byId = new Map<number, MatchResultDto>();
                for (const m of merged) {
                    if (!byId.has(m.matchId)) byId.set(m.matchId, m);
                }
                const unique = Array.from(byId.values());

                setResults(unique);
                setVisible(30);
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
    }, [selectedClubIds.join(","), matchType]);

    // Filtros + ordenação em memória
    const filtered = useMemo(() => {
        const term = search.trim().toLowerCase();

        const byText = (m: MatchResultDto) =>
            term ? `${m.clubAName} ${m.clubBName}`.toLowerCase().includes(term) : true;

        const byReds = (m: MatchResultDto) => {
            const redsA = m.clubASummary?.redCards ?? (m.clubARedCards ?? 0);
            const redsB = m.clubBSummary?.redCards ?? (m.clubBRedCards ?? 0);
            const reds = redsA + redsB;
            if (redFilter === "none") return reds === 0;
            if (redFilter === "1plus") return reds >= 1;
            if (redFilter === "2plus") return reds >= 2;
            return true;
        };

        const byOppCount = (m: MatchResultDto) => {
            if (!opponentCount) return true;
            const p = perspectiveForSelected(m, selectedClubIds, fallbackClubName, fallbackTeamId);
            const opp = p.isMineA ? (m.clubBPlayerCount ?? null) : (m.clubAPlayerCount ?? null);
            return opp === opponentCount;
        };

        const base = results.filter((m) => byText(m) && byReds(m) && byOppCount(m));

        const sorted = [...base].sort((a, b) => {
            if (sortKey === "recent") return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
            if (sortKey === "oldest") return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();

            if (sortKey === "gf" || sortKey === "ga") {
                const pa = perspectiveForSelected(a, selectedClubIds, fallbackClubName, fallbackTeamId);
                const pb = perspectiveForSelected(b, selectedClubIds, fallbackClubName, fallbackTeamId);
                const va = sortKey === "gf" ? pa.myGoals : pa.oppGoals;
                const vb = sortKey === "gf" ? pb.myGoals : pb.oppGoals;
                if (vb !== va) return vb - va;
                return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
            }

            return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
        });

        return sorted;
    }, [results, search, sortKey, redFilter, opponentCount, selectedClubIds.join(","), fallbackClubName, fallbackTeamId]);

    const summary = useMemo(() => {
        const s = filtered.reduce(
            (acc, m) => {
                const p = perspectiveForSelected(m, selectedClubIds, fallbackClubName, fallbackTeamId);
                acc.jogos++;
                acc.golsPro += p.myGoals;
                acc.golsContra += p.oppGoals;
                if (p.myGoals > p.oppGoals) acc.v++;
                else if (p.myGoals < p.oppGoals) acc.d++;
                else acc.e++;
                const redsA = m.clubASummary?.redCards ?? (m.clubARedCards ?? 0);
                const redsB = m.clubBSummary?.redCards ?? (m.clubBRedCards ?? 0);
                acc.cartoes += redsA + redsB;
                return acc;
            },
            { jogos: 0, v: 0, e: 0, d: 0, golsPro: 0, golsContra: 0, cartoes: 0 }
        );
        return { ...s, saldo: s.golsPro - s.golsContra };
    }, [filtered, selectedClubIds.join(","), fallbackClubName, fallbackTeamId]);

    const hasSelection = selectedClubIds.length > 0;
    const hasResults = filtered.length > 0;

    const refresh = useCallback(() => {
        if (hasSelection) {
            const ev = new Event("visibilitychange");
            document.dispatchEvent(ev);
        }
        setVisible((v) => v);
    }, [hasSelection]);

    const headerRight = hasSelection
        ? (selectedClubIds.length > 1
            ? <>Clubes atuais: <span className="font-medium">{selectedClubIds.join(", ")}</span></>
            : <>Clube atual: <span className="font-medium">{selectedClubIds[0]}</span></>)
        : <>Selecione clubes no topo para carregar os resultados.</>;

    return (
        <div className="p-4 max-w-5xl mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold">Resultados das Partidas</h1>
                    <p className="text-sm text-gray-600">{headerRight}</p>
                </div>

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

                        {/* Filtro vermelhos */}
                        <div className="flex items-center gap-2 text-sm">
                            <span className="text-gray-600">Vermelhos:</span>
                            <select className="border rounded-lg px-2 py-2" value={redFilter} onChange={(e) => setRedFilter(e.target.value as RedCardFilter)}>
                                <option value="all">Todos</option>
                                <option value="none">Nenhum</option>
                                <option value="1plus">1+</option>
                                <option value="2plus">2+</option>
                            </select>
                        </div>

                        {/* Filtro por quantidade do adversário */}
                        <div className="flex items-center gap-2 text-sm">
                            <span className="text-gray-600">Adversário (jogadores):</span>
                            <select
                                className="border rounded-lg px-2 py-2"
                                value={opponentCount ?? ""}
                                onChange={(e) => {
                                    const v = e.target.value;
                                    if (v === "") setOpponentCount(null);
                                    else {
                                        const n = Number(v);
                                        setOpponentCount(n >= 2 && n <= 11 ? n : null);
                                    }
                                }}
                            >
                                <option value="">Todos</option>
                                {Array.from({ length: 10 }, (_, i) => i + 2).map((n) => (
                                    <option key={n} value={n}>{n}</option>
                                ))}
                            </select>
                        </div>

                        {/* Ordenação */}
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
                        <button className="px-3 py-2 rounded-lg border bg-white hover:bg-gray-50" onClick={refresh}>
                            Atualizar
                        </button>
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
                    <button className="px-3 py-1.5 rounded-lg border bg-white hover:bg-red-50" onClick={refresh}>Tentar novamente</button>
                </div>
            )}

            {!loading && !error && hasSelection && filtered.length === 0 && (
                <div className="mt-4 p-3 bg-gray-50 border rounded text-gray-700">
                    Nenhum resultado encontrado.
                    <ul className="list-disc ml-5 mt-2 text-sm text-gray-600">
                        <li>Verifique a grafia dos clubes.</li>
                        <li>Altere o tipo (Todos/Liga/Playoff).</li>
                        <li>Ajuste o filtro de cartões ou de jogadores do adversário.</li>
                    </ul>
                </div>
            )}

            {!hasSelection && (
                <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-yellow-800">
                    Selecione clubes no menu (botão “Clubes”) para começar.
                </div>
            )}

            {/* Lista */}
            <div className="mt-4 grid gap-2">
                {filtered.slice(0, visible).map((m) => (
                    <MatchCard
                        key={m.matchId}
                        m={m}
                        matchType={matchType}
                        selectedClubIds={selectedClubIds}
                        fallbackClubName={fallbackClubName ?? undefined}
                        fallbackTeamId={fallbackTeamId}
                    />
                ))}
            </div>

            {/* Paginação */}
            {filtered.length > 0 && visible < filtered.length && (
                <div className="flex justify-center mt-4">
                    <button className="px-4 py-2 rounded-lg border bg-white hover:bg-gray-50" onClick={() => setVisible((v) => v + 30)}>
                        Mostrar mais ({Math.min(filtered.length - visible, 30)})
                    </button>
                </div>
            )}

            {filtered.length > 0 && (
                <div className="mt-8 text-xs text-gray-500 text-center">
                    Exibindo {Math.min(visible, filtered.length)} de {filtered.length} partidas.
                </div>
            )}
        </div>
    );
}
