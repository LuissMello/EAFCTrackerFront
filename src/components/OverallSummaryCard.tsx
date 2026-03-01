import React from "react";
import api from "../services/api.ts";
import { crestUrl, divisionCrestUrl, reputationTierUrl, FALLBACK_LOGO } from "../config/urls.ts";

export type PlayoffAchievementDto = {
    seasonId: string;
    seasonName?: string | null;
    bestDivision?: string | null;
    bestFinishGroup?: string | null;
    retrievedAtUtc?: string | null;
    updatedAtUtc?: string | null;
};

export type ClubOverallRow = {
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
    wstreak?: string | null;
    unbeatenstreak?: string | null;
    skillRating?: string | null;
    reputationtier?: string | null;
    leagueAppearances?: string | null;
    currentDivision?: string | null;
    updatedAtUtc?: string | null;
};

type Props = {
    clubId: number;
    clubName: string;
    crestAssetId?: string | null;
    /** Se vierem, NÃO busca na API */
    overall?: ClubOverallRow | null;
    playoffs?: PlayoffAchievementDto[] | null;
    maxPlayoffs?: number; // default 20
    className?: string;
};

/** ===== Helpers locais ===== */
const toNum = (s?: string | null) => {
    if (s === null || s === undefined) return 0;
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
};
const asNonNegativeIntString = (s?: string | null) => {
    const n = Number(String(s ?? "").trim());
    return Number.isFinite(n) && n >= 0 ? String(Math.trunc(n)) : null;
};

function formatTimeAgo(iso?: string | null): string {
    if (!iso) return "–";
    const diffSec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (diffSec < 60) return "agora";
    if (diffSec < 3600) return `há ${Math.floor(diffSec / 60)}min`;
    if (diffSec < 86400) return `há ${Math.floor(diffSec / 3600)}h`;
    return `há ${Math.floor(diffSec / 86400)}d`;
}

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
const PLAYOFF_BORDER_CLASS: Record<string, string> = {
    "1": "border-yellow-400 bg-yellow-50",
    "2": "border-gray-400 bg-gray-50",
    "3": "border-amber-600 bg-amber-50",
};

const TinyBar: React.FC<{ pct: number; className?: string; title?: string; color?: string }> = ({
    pct,
    className = "",
    title,
    color = "bg-blue-600",
}) => {
    const w = Math.max(0, Math.min(100, pct));
    return (
        <div className={`w-full ${className}`} title={title} aria-label={title}>
            <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div className={`h-full ${color}`} style={{ width: `${w}%` }} />
            </div>
        </div>
    );
};

const RecordBar: React.FC<{ wins: number; draws: number; losses: number }> = ({ wins, draws, losses }) => {
    const total = wins + draws + losses;
    if (total === 0) return <div className="h-2 bg-gray-200 rounded-full" />;
    const wPct = (wins / total) * 100;
    const dPct = (draws / total) * 100;
    const lPct = (losses / total) * 100;
    return (
        <div className="flex h-2 rounded-full overflow-hidden w-full gap-px">
            {wins > 0 && <div className="bg-green-500" style={{ width: `${wPct}%` }} title={`${wins} vitórias`} />}
            {draws > 0 && <div className="bg-gray-400" style={{ width: `${dPct}%` }} title={`${draws} empates`} />}
            {losses > 0 && <div className="bg-red-500" style={{ width: `${lPct}%` }} title={`${losses} derrotas`} />}
        </div>
    );
};

function SkeletonCard({ colSpan = 1 }: { colSpan?: number }) {
    return (
        <div className={`p-2 rounded-lg border animate-pulse ${colSpan === 2 ? "col-span-2" : ""}`}>
            <div className="h-2.5 bg-gray-200 rounded w-1/2 mb-2" />
            <div className="h-5 bg-gray-200 rounded w-3/4" />
        </div>
    );
}
/** ===== Fim helpers ===== */

const OverallSummaryCard: React.FC<Props> = ({
    clubId,
    clubName,
    crestAssetId,
    overall,
    playoffs,
    maxPlayoffs = 20,
    className,
}) => {
    const [o, setO] = React.useState<ClubOverallRow | null>(overall ?? null);
    const [po, setPo] = React.useState<PlayoffAchievementDto[] | null>(playoffs ?? null);
    const [loading, setLoading] = React.useState<boolean>(!overall && !playoffs);
    const [error, setError] = React.useState<string | null>(null);

    React.useEffect(() => { setO(overall ?? null); }, [overall]);
    React.useEffect(() => { setPo(playoffs ?? null); }, [playoffs]);

    React.useEffect(() => {
        const needFetch = overall == null || playoffs == null;
        if (!needFetch) { setLoading(false); return; }
        let cancel = false;
        (async () => {
            try {
                setLoading(true);
                setError(null);
                const [overallRes, playoffsRes] = await Promise.all([
                    api.get<ClubOverallRow[]>(`/api/Clubs/${clubId}/overall`),
                    api.get<{ clubId: number; achievements: PlayoffAchievementDto[] }[]>(`/api/Clubs/${clubId}/playoffs`),
                ]);
                const nextOverall = overallRes.data?.[0] ?? null;
                const playoffsBlock = playoffsRes.data?.find((x) => x.clubId === clubId) ?? playoffsRes.data?.[0];
                const nextPlayoffs = playoffsBlock?.achievements ?? [];
                if (!cancel) { setO(nextOverall); setPo(nextPlayoffs); setLoading(false); }
            } catch (e: any) {
                if (!cancel) { setError(e?.message ?? "Falha ao carregar histórico do clube"); setLoading(false); }
            }
        })();
        return () => { cancel = true; };
    }, [clubId, overall, playoffs]);

    const wins = toNum(o?.wins);
    const draws = toNum(o?.ties);
    const losses = toNum(o?.losses);
    const games = toNum(o?.gamesPlayed);
    const goalsFor = toNum(o?.goals);
    const goalsAgainst = toNum(o?.goalsAgainst);
    const goalDiff = goalsFor - goalsAgainst;
    const winPct = games > 0 ? (wins * 100) / games : 0;
    const wstreak = toNum(o?.wstreak);
    const unbeaten = toNum(o?.unbeatenstreak);
    const promotions = toNum(o?.promotions);
    const relegations = toNum(o?.relegations);

    const repUrl = reputationTierUrl(o?.reputationtier);
    const repKey = asNonNegativeIntString(o?.reputationtier) ?? "0";
    const repLabel = REPUTATION_LABELS[repKey] ?? o?.reputationtier ?? "–";

    const highestKey = asNonNegativeIntString(o?.bestFinishGroup) ?? "6";
    const highestLabel = HIGHEST_PLACEMENT_LABELS[highestKey] ?? o?.bestFinishGroup ?? "–";

    const currDivUrl = divisionCrestUrl(o?.currentDivision);
    const bestDivUrl = divisionCrestUrl(o?.bestDivision);

    const repNum = Number(repKey);
    const repPct = Number.isFinite(repNum) ? (repNum / 3) * 100 : 0;
    const hpNum = Number(highestKey);
    const hpPct = Number.isFinite(hpNum) ? ((6 - hpNum) / 5) * 100 : 0;

    return (
        <div className={`rounded-xl border p-3 bg-white ${className ?? ""}`}>
            {/* Cabeçalho */}
            <div className="flex items-center justify-between pb-2 border-b mb-3">
                <div className="flex items-center gap-2">
                    <img
                        src={crestUrl(crestAssetId)}
                        onError={(e) => (e.currentTarget.src = FALLBACK_LOGO)}
                        alt={`Escudo ${clubName}`}
                        className="w-8 h-8 rounded-full bg-white border"
                    />
                    <div className="font-semibold">{clubName ?? `Clube ${clubId}`}</div>
                </div>
                {o?.updatedAtUtc && (
                    <span className="text-xs text-gray-400" title={new Date(o.updatedAtUtc).toLocaleString()}>
                        Atualizado {formatTimeAgo(o.updatedAtUtc)}
                    </span>
                )}
            </div>

            {loading ? (
                <div className="grid grid-cols-2 gap-2">
                    <SkeletonCard />
                    <SkeletonCard />
                    <SkeletonCard />
                    <SkeletonCard />
                    <SkeletonCard colSpan={2} />
                    <SkeletonCard colSpan={2} />
                    <SkeletonCard />
                    <SkeletonCard />
                    <SkeletonCard />
                    <SkeletonCard />
                    <SkeletonCard colSpan={2} />
                </div>
            ) : error ? (
                <div className="mt-3 text-sm text-red-700">{error}</div>
            ) : !o ? (
                <div className="mt-3 text-sm text-gray-600">Sem dados históricos para este clube.</div>
            ) : (
                <div className="grid grid-cols-2 gap-2 text-sm">
                    {/* Skill Rating + Reputation */}
                    <div className="p-2 rounded-lg border">
                        <div className="text-xs text-gray-500 mb-1">Skill Rating</div>
                        <div className="text-xl font-bold text-gray-900">{o?.skillRating ?? "–"}</div>
                        <TinyBar pct={repPct} className="mt-1.5" title={`Reputation: ${repLabel}`} />
                        <div className="mt-1.5 flex items-center justify-between">
                            <div className="text-[11px] text-gray-600">{repLabel}</div>
                            {repUrl && <img src={repUrl} alt={`Reputação ${repKey}`} className="w-8 h-8 object-contain" />}
                        </div>
                    </div>

                    {/* Divisão Atual */}
                    <div className="p-2 rounded-lg border flex flex-col">
                        <div className="text-xs text-gray-500 mb-1">Divisão Atual</div>
                        <div className="flex-1 flex flex-col items-center justify-center">
                            {currDivUrl ? (
                                <>
                                    <img
                                        src={currDivUrl}
                                        alt={`Divisão ${o?.currentDivision ?? ""}`}
                                        className="w-10 h-10 object-contain"
                                        onError={(e) => (e.currentTarget.src = FALLBACK_LOGO)}
                                    />
                                </>
                            ) : (
                                <div className="text-sm text-gray-400">–</div>
                            )}
                        </div>
                    </div>

                    {/* Melhor Divisão */}
                    <div className="p-2 rounded-lg border">
                        <div className="text-xs text-gray-500 mb-1">Melhor Divisão</div>
                        <TinyBar pct={hpPct} className="mt-0.5" title={`Placement: ${highestLabel}`} />
                        <div className="mt-1.5 flex items-center justify-between">
                            <div className="text-[11px] font-medium text-gray-700">{highestLabel}</div>
                            {bestDivUrl && (
                                <img
                                    src={bestDivUrl}
                                    alt={`Divisão ${o?.bestDivision ?? ""}`}
                                    className="w-8 h-8 object-contain"
                                    onError={(e) => (e.currentTarget.src = FALLBACK_LOGO)}
                                />
                            )}
                        </div>
                    </div>

                    {/* Jogos */}
                    <div className="p-2 rounded-lg border">
                        <div className="text-xs text-gray-500 mb-1">Jogos (Total / Liga / Playoff)</div>
                        <div className="font-semibold">
                            {games} / {toNum(o?.leagueAppearances)} / {toNum(o?.gamesPlayedPlayoff)}
                        </div>
                    </div>

                    {/* V/E/D com RecordBar */}
                    <div className="p-2 rounded-lg border col-span-2">
                        <div className="text-xs text-gray-500 mb-1.5">Resultados</div>
                        <RecordBar wins={wins} draws={draws} losses={losses} />
                        <div className="mt-1.5 flex items-center justify-between text-xs">
                            <span className="flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                                <span className="font-semibold text-green-700">{wins}V</span>
                            </span>
                            <span className="flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-gray-400 inline-block" />
                                <span className="font-semibold text-gray-600">{draws}E</span>
                            </span>
                            <span className="flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
                                <span className="font-semibold text-red-700">{losses}D</span>
                            </span>
                            <span className="text-gray-400">{winPct.toFixed(1)}% vitórias</span>
                        </div>
                    </div>

                    {/* Gols com diferença */}
                    <div className="p-2 rounded-lg border col-span-2">
                        <div className="text-xs text-gray-500 mb-1">Gols</div>
                        <div className="flex items-center gap-3">
                            <span className="font-semibold">
                                {goalsFor} <span className="text-gray-400 font-normal text-xs">feitos</span>
                            </span>
                            <span className="text-gray-300">/</span>
                            <span className="font-semibold">
                                {goalsAgainst} <span className="text-gray-400 font-normal text-xs">sofridos</span>
                            </span>
                            <span className={`ml-auto text-sm font-bold ${goalDiff > 0 ? "text-green-600" : goalDiff < 0 ? "text-red-600" : "text-gray-400"}`}>
                                {goalDiff > 0 ? `+${goalDiff}` : goalDiff}
                            </span>
                        </div>
                    </div>

                    {/* Promoções */}
                    <div className={`p-2 rounded-lg border ${promotions > 0 ? "bg-green-50 border-green-200" : ""}`}>
                        <div className="text-xs text-gray-500 mb-1">Promoções</div>
                        <div className={`font-semibold flex items-center gap-1 ${promotions > 0 ? "text-green-700" : "text-gray-700"}`}>
                            {promotions > 0 && <span>↑</span>}
                            {promotions}
                        </div>
                    </div>

                    {/* Rebaixamentos */}
                    <div className={`p-2 rounded-lg border ${relegations > 0 ? "bg-red-50 border-red-200" : ""}`}>
                        <div className="text-xs text-gray-500 mb-1">Rebaixamentos</div>
                        <div className={`font-semibold flex items-center gap-1 ${relegations > 0 ? "text-red-700" : "text-gray-700"}`}>
                            {relegations > 0 && <span>↓</span>}
                            {relegations}
                        </div>
                    </div>

                    {/* Win Streak */}
                    <div className="p-2 rounded-lg border">
                        <div className="text-xs text-gray-500 mb-1">Win Streak</div>
                        <div className={`font-semibold flex items-center gap-1 ${wstreak >= 5 ? "text-orange-600" : wstreak > 0 ? "text-green-700" : "text-gray-700"}`}>
                            {wstreak > 0 && <span>{wstreak >= 5 ? "🔥" : "✓"}</span>}
                            {wstreak}
                        </div>
                    </div>

                    {/* Unbeaten Streak */}
                    <div className="p-2 rounded-lg border">
                        <div className="text-xs text-gray-500 mb-1">Sem Derrota</div>
                        <div className={`font-semibold flex items-center gap-1 ${unbeaten >= 10 ? "text-orange-600" : unbeaten > 0 ? "text-green-700" : "text-gray-700"}`}>
                            {unbeaten > 0 && <span>{unbeaten >= 10 ? "🔥" : "✓"}</span>}
                            {unbeaten}
                        </div>
                    </div>

                    {/* Histórico de Playoffs */}
                    <div className="p-2 rounded-lg border col-span-2">
                        <div className="text-xs text-gray-500 mb-1.5">Histórico de Playoffs</div>
                        {(po ?? []).length === 0 ? (
                            <div className="text-xs text-gray-600">Sem temporadas concluídas.</div>
                        ) : (
                            <div className="flex items-stretch gap-2 overflow-x-auto pb-1">
                                {(po ?? []).slice(0, maxPlayoffs).map((p) => {
                                    const crest = divisionCrestUrl(p.bestDivision) ?? FALLBACK_LOGO;
                                    const hpKey = asNonNegativeIntString(p.bestFinishGroup) ?? "";
                                    const hpLabel = HIGHEST_PLACEMENT_LABELS[hpKey] ?? p.bestFinishGroup ?? "–";
                                    const cardCls = PLAYOFF_BORDER_CLASS[hpKey] ?? "border-gray-200 bg-white";
                                    return (
                                        <div
                                            key={`${p.seasonId}-${p.bestDivision}-${p.bestFinishGroup}`}
                                            className={`min-w-[68px] px-2 py-1.5 border-2 rounded-lg flex flex-col items-center text-center transition-shadow hover:shadow-md ${cardCls}`}
                                            title={`${p.seasonName ?? p.seasonId ?? ""} • ${hpLabel}`}
                                        >
                                            <img
                                                src={crest}
                                                onError={(e) => (e.currentTarget.src = FALLBACK_LOGO)}
                                                alt={`Divisão ${p.bestDivision ?? ""}`}
                                                className="w-9 h-9 object-contain"
                                            />
                                            <div className="mt-1 text-[10px] leading-tight font-semibold">{hpLabel}</div>
                                            <div className="text-[9px] text-gray-500 leading-tight">{p.seasonName ?? p.seasonId}</div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default OverallSummaryCard;
