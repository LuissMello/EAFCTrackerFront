import React, { useEffect, useMemo, useRef, useState, useId, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api from "../services/api.ts";
import { useClub } from "../hooks/useClub.tsx";

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
    // aliases possíveis em PascalCase
    Name?: string | null;
    StadName?: string | null;
    CrestAssetId?: string | null;
    TeamId?: number | null;
}

interface MatchResultDto {
    matchId: number;
    timestamp: string;

    clubAName: string;
    clubAGoals: number;
    clubARedCards?: number | null;
    clubAPlayerCount?: number | null;
    clubADetails?: ClubDetailsDto | null;

    clubBName: string;
    clubBGoals: number;
    clubBRedCards?: number | null;
    clubBPlayerCount?: number | null;
    clubBDetails?: ClubDetailsDto | null;

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

function perspectiveFor(m: MatchResultDto, myClubName?: string | null, myTeamIdNum?: number) {
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

function RedCardBadge({ count }: { count?: number | null }) {
    const c = typeof count === "number" ? count : 0;
    const has = c > 0;
    return (
        <span
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border text-[12px] ${has ? "bg-red-50 border-red-200 text-red-700" : "bg-gray-50 border-gray-200 text-gray-400"}`}
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

const PersonIcon = ({ className = "" }: { className?: string }) => (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden className={className}>
        <path fill="currentColor" d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5Zm0 2c-4.42 0-8 2.24-8 5v1h16v-1c0-2.76-3.58-5-8-5Z" />
    </svg>
);

/* ======================
   Jersey (SVG) – braços/clipPaths OK
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
   Cart de partida
====================== */
function MatchCard({ m, matchType }: { m: MatchResultDto; matchType: MatchTypeFilter }) {
    const patternA = guessPattern(m.clubADetails);
    const patternB = guessPattern(m.clubBDetails);

    const { club } = useClub();
    const tRaw = (club as any)?.teamId;
    const myTeamIdNum = typeof tRaw === "number" ? tRaw : Number(tRaw);
    const p = perspectiveFor(m, club?.clubName, Number.isFinite(myTeamIdNum) ? myTeamIdNum : undefined);
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
                    <span className="sm:hidden">{fromNow(m.timestamp)}</span>
                </div>
                <OutcomeBadge a={p.myGoals} b={p.oppGoals} />
            </div>

            {/* DESKTOP: times + placar na mesma linha centralizada */}
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
                            <RedCardBadge count={m.clubARedCards} />
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
                            <RedCardBadge count={m.clubBRedCards} />
                        </div>
                    </div>
                </div>
            </div>

            {/* MOBILE: linha com A (esquerda) e B (direita), camisas/cartões logo abaixo de cada lado; depois o placar */}
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

                {/* Linha 2: camisas + cartões (abaixo de cada lado) */}
                <div className="flex items-start justify-between">
                    <div className="flex flex-col items-start gap-1">
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
                        <RedCardBadge count={m.clubARedCards} />
                    </div>

                    <div className="flex flex-col items-end gap-1">
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
                        <RedCardBadge count={m.clubBRedCards} />
                    </div>
                </div>

                {/* Placar centralizado abaixo dos times */}
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

            {/* Estádio centralizado (por último no mobile, como na imagem) */}
            <div className="mt-2 text-xs sm:text-sm text-gray-600 text-center font-medium">
                {stadiumName || "Estádio não informado"}
            </div>
        </Link>
    );
}

/* ======================
   Página
====================== */
export default function Home() {
    const { club } = useClub();
    const clubId = club?.clubId;

    const [searchParams, setSearchParams] = useSearchParams();

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

    // Persistir filtros na URL
    useEffect(() => {
        const rcParam = redFilter === "all" ? undefined : redFilter === "none" ? "none" : redFilter === "1plus" ? "1" : "2";
        const oppParam = opponentCount ? String(opponentCount) : undefined;
        const payload = {
            q: search || undefined,
            type: matchType !== "All" ? matchType : undefined,
            sort: sortKey !== "recent" ? sortKey : undefined,
            rc: rcParam,
            opp: oppParam,
        } as Record<string, string | undefined>;
        const next = new URLSearchParams();
        Object.entries(payload).forEach(([k, v]) => v && next.set(k, v));
        setSearchParams(next, { replace: true });
    }, [search, matchType, sortKey, redFilter, opponentCount, setSearchParams]);

    // Carregar resultados
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

    // Filtros + ordenação em memória
    const filtered = useMemo(() => {
        const term = search.trim().toLowerCase();
        const byText = (m: MatchResultDto) => (term ? `${m.clubAName} ${m.clubBName}`.toLowerCase().includes(term) : true);
        const byReds = (m: MatchResultDto) => {
            const reds = (m.clubARedCards ?? 0) + (m.clubBRedCards ?? 0);
            if (redFilter === "none") return reds === 0;
            if (redFilter === "1plus") return reds >= 1;
            if (redFilter === "2plus") return reds >= 2;
            return true;
        };
        const byOppCount = (m: MatchResultDto) => {
            if (!opponentCount) return true;
            const tRaw = (club as any)?.teamId;
            const myTeamIdNum = typeof tRaw === "number" ? tRaw : Number(tRaw);
            const p = perspectiveFor(m, club?.clubName, Number.isFinite(myTeamIdNum) ? myTeamIdNum : undefined);
            const opp = p.isMineA ? (m.clubBPlayerCount ?? null) : (m.clubAPlayerCount ?? null);
            return opp === opponentCount;
        };

        const base = results.filter((m) => byText(m) && byReds(m) && byOppCount(m));

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
                if (vb !== va) return vb - va;
                return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
            }

            return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
        });

        return sorted;
    }, [results, search, sortKey, redFilter, opponentCount, club?.clubName, (club as any)?.teamId]);

    const summary = useMemo(() => {
        const tRaw = (club as any)?.teamId;
        const myTeamIdNum = typeof tRaw === "number" ? tRaw : Number(tRaw);
        const s = filtered.reduce(
            (acc, m) => {
                const p = perspectiveFor(m, club?.clubName, Number.isFinite(myTeamIdNum) ? myTeamIdNum : undefined);
                acc.jogos++;
                acc.golsPro += p.myGoals;
                acc.golsContra += p.oppGoals;
                if (p.myGoals > p.oppGoals) acc.v++;
                else if (p.myGoals < p.oppGoals) acc.d++;
                else acc.e++;
                acc.cartoes += (m.clubARedCards ?? 0) + (m.clubBRedCards ?? 0);
                return acc;
            },
            { jogos: 0, v: 0, e: 0, d: 0, golsPro: 0, golsContra: 0, cartoes: 0 }
        );
        return { ...s, saldo: s.golsPro - s.golsContra };
    }, [filtered, club?.clubName, (club as any)?.teamId]);

    const hasResults = filtered.length > 0;

    const refresh = useCallback(() => {
        if (clubId) {
            const ev = new Event("visibilitychange");
            document.dispatchEvent(ev);
        }
        // força recarga mantendo filtros
        setVisible((v) => v);
    }, [clubId]);

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

            {!loading && !error && clubId && filtered.length === 0 && (
                <div className="mt-4 p-3 bg-gray-50 border rounded text-gray-700">
                    Nenhum resultado encontrado.
                    <ul className="list-disc ml-5 mt-2 text-sm text-gray-600">
                        <li>Verifique a grafia dos clubes.</li>
                        <li>Altere o tipo (Todos/Liga/Playoff).</li>
                        <li>Ajuste o filtro de cartões ou de jogadores do adversário.</li>
                    </ul>
                </div>
            )}

            {!clubId && (
                <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-yellow-800">
                    Informe um clube no menu (botão “Alterar clube”) para começar.
                </div>
            )}

            {/* Lista */}
            <div className="mt-4 grid gap-2">
                {filtered.slice(0, visible).map((m) => (
                    <MatchCard key={m.matchId} m={m} matchType={matchType} />
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
