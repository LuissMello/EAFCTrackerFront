import React from "react";
import api from "../services/api.ts";

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
    currentDivision?: string | null; // <- usado no novo bloco
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
const FALLBACK_LOGO = "https://via.placeholder.com/96?text=Logo";
const crestUrl = (id?: string | null) =>
    id
        ? `https://eafc24.content.easports.com/fifa/fltOnlineAssets/24B23FDE-7835-41C2-87A2-F453DFDB2E82/2024/fcweb/crests/256x256/l${id}.png`
        : FALLBACK_LOGO;

const toNum = (s?: string | null) => {
    if (s === null || s === undefined) return 0;
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
};
const asNonNegativeIntString = (s?: string | null) => {
    const n = Number(String(s ?? "").trim());
    return Number.isFinite(n) && n >= 0 ? String(Math.trunc(n)) : null;
};
const asPositiveIntString = (s?: string | null) => {
    if (s == null) return null;
    const n = Number(String(s).trim());
    return Number.isFinite(n) && n > 0 ? String(Math.trunc(n)) : null;
};
const divisionCrestUrl = (division?: string | null) => {
    const n = asPositiveIntString(division);
    return n ? `https://media.contentapi.ea.com/content/dam/eacom/fc/pro-clubs/divisioncrest${n}.png` : null;
};
const reputationTierUrl = (tier?: string | null) => {
    const n = Number(tier);
    return `https://media.contentapi.ea.com/content/dam/eacom/fc/pro-clubs/reputation-tier${n}.png`;
};
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
const TinyBar: React.FC<{ pct: number; className?: string; title?: string }> = ({ pct, className = "", title }) => {
    const w = Math.max(0, Math.min(100, pct));
    return (
        <div className={`w-full ${className}`} title={title} aria-label={title}>
            <div className="w-full h-1 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-blue-600" style={{ width: `${w}%` }} />
            </div>
        </div>
    );
};
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
    // estado local (pode vir por props OU via fetch)
    const [o, setO] = React.useState<ClubOverallRow | null>(overall ?? null);
    const [po, setPo] = React.useState<PlayoffAchievementDto[] | null>(playoffs ?? null);
    const [loading, setLoading] = React.useState<boolean>(!overall && !playoffs);
    const [error, setError] = React.useState<string | null>(null);

    // sincroniza quando props mudarem
    React.useEffect(() => {
        setO(overall ?? null);
    }, [overall]);
    React.useEffect(() => {
        setPo(playoffs ?? null);
    }, [playoffs]);

    // busca nos endpoints separados apenas se não veio por props
    React.useEffect(() => {
        // If data is provided via props, no need to fetch
        const needFetch = overall == null || playoffs == null;
        if (!needFetch) {
            setLoading(false);
            return;
        }

        let cancel = false;

        (async () => {
            try {
                setLoading(true);
                setError(null);

                // Fetch both endpoints in parallel
                const [overallRes, playoffsRes] = await Promise.all([
                    api.get<ClubOverallRow[]>(`/api/Clubs/${clubId}/overall`),
                    api.get<{ clubId: number; achievements: PlayoffAchievementDto[] }[]>(`/api/Clubs/${clubId}/playoffs`),
                ]);

                const nextOverall = overallRes.data?.[0] ?? null;
                const playoffsBlock = playoffsRes.data?.find((x) => x.clubId === clubId) ?? playoffsRes.data?.[0];
                const nextPlayoffs = playoffsBlock?.achievements ?? [];

                if (!cancel) {
                    setO(nextOverall);
                    setPo(nextPlayoffs);
                    setLoading(false);
                }
            } catch (e: any) {
                if (!cancel) {
                    setError(e?.message ?? "Falha ao carregar histórico do clube");
                    setLoading(false);
                }
            }
        })();

        return () => {
            cancel = true;
        };
    }, [clubId, overall, playoffs]);

    const wins = toNum(o?.wins);
    const draws = toNum(o?.ties);
    const losses = toNum(o?.losses);
    const games = toNum(o?.gamesPlayed);
    const goalsFor = toNum(o?.goals);
    const goalsAgainst = toNum(o?.goalsAgainst);
    const winPct = games > 0 ? (wins * 100) / games : 0;

    const repUrl = reputationTierUrl(o?.reputationtier);
    const repKey = asNonNegativeIntString(o?.reputationtier) ?? "0";
    const repLabel = REPUTATION_LABELS[repKey] ?? o?.reputationtier ?? "–";

    const highestKey = asNonNegativeIntString(o?.bestFinishGroup) ?? "6";
    const highestLabel = HIGHEST_PLACEMENT_LABELS[highestKey] ?? o?.bestFinishGroup ?? "–";

    // imagens das divisões
    const currDivUrl = divisionCrestUrl(o?.currentDivision);
    const bestDivUrl = divisionCrestUrl(o?.bestDivision);

    // barras
    const repNum = Number(repKey);
    const repPct = Number.isFinite(repNum) ? (repNum / 3) * 100 : 0;
    const hpNum = Number(highestKey);
    const hpPct = Number.isFinite(hpNum) ? ((6 - hpNum) / 5) * 100 : 0;

    return (
        <div className={`rounded-lg border p-3 bg-white ${className ?? ""}`}>
            {/* Cabeçalho */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <img
                        src={crestUrl(crestAssetId)}
                        onError={(e) => (e.currentTarget.src = FALLBACK_LOGO)}
                        alt={`Escudo ${clubName}`}
                        className="w-8 h-8 rounded-full bg-white border"
                    />
                    <div className="font-semibold">{clubName ?? `Clube ${clubId}`}</div>
                </div>
                <div className="flex items-center gap-2">
                    {o?.updatedAtUtc && (
                        <span className="text-xs text-gray-500">Atualizado: {new Date(o.updatedAtUtc).toLocaleString()}</span>
                    )}
                </div>
            </div>

            {loading ? (
                <div className="mt-3 text-sm text-gray-600">Carregando…</div>
            ) : error ? (
                <div className="mt-3 text-sm text-red-700">{error}</div>
            ) : !o ? (
                <div className="mt-3 text-sm text-gray-600">Sem dados históricos para este clube.</div>
            ) : (
                <>
                    {/* Grid de métricas */}
                    <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                        {/* Skill + Reputation */}
                        <div className="p-2 rounded border">
                            <div className="text-gray-500">Skill Rating</div>
                            <TinyBar pct={repPct} className="mt-1" title={`Reputation: ${repLabel}`} />
                            <div className="mt-1 flex items-start justify-between gap-3">
                                <div>
                                    <div className="font-semibold">{o?.skillRating ?? "–"}</div>
                                </div>
                                <div className="flex flex-col items-center min-w-[48px]">
                                    {repUrl && <img src={repUrl} alt={`Reputação ${repKey ?? ""}`} className="w-10 h-10 object-contain" />}
                                    <div className="mt-1 text-[11px] leading-tight text-gray-600 text-center">{repLabel}</div>
                                </div>
                            </div>
                        </div>

                        {/* NOVO BLOCO: Divisão Atual */}
                        <div className="p-2 rounded border">
                            <div className="text-gray-500">Divisão Atual</div>
                            <div className="mt-1 flex items-start justify-between gap-3">
                                <div>
                                </div>
                                <div className="flex flex-col items-center min-w-[48px]">
                                    {currDivUrl && (
                                        <img
                                            src={currDivUrl}
                                            alt={`Divisão Atual ${o?.currentDivision ?? ""}`}
                                            className="w-10 h-10 object-contain"
                                            onError={(e) => (e.currentTarget.src = FALLBACK_LOGO)}
                                        />
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Melhor divisão */}
                        <div className="p-2 rounded border">
                            <div className="text-gray-500">Melhor Divisão</div>
                            <TinyBar pct={hpPct} className="mt-1" title={`Placement: ${highestLabel}`} />
                            <div className="mt-1 flex items-start justify-between gap-3">
                                <div>
                                    <div className="font-semibold">{highestLabel}</div>
                                </div>
                                <div className="flex flex-col items-center min-w-[48px]">
                                    {bestDivUrl && (
                                        <img
                                            src={bestDivUrl}
                                            alt={`Divisão ${o?.bestDivision ?? ""}`}
                                            className="w-10 h-10 object-contain"
                                            onError={(e) => (e.currentTarget.src = FALLBACK_LOGO)}
                                        />
                                    )}
                                    <div className="mt-1 text-[11px] leading-tight text-gray-600 text-center">{highestLabel}</div>
                                </div>
                            </div>
                        </div>

                        {/* Linhas de estatísticas */}
                        <div className="p-2 rounded border">
                            <div className="text-gray-500">Jogos (Total / Liga / Playoff)</div>
                            <div className="font-semibold">
                                {games}
                                {" / "}
                                {toNum(o?.leagueAppearances)}
                                {" / "}
                                {toNum(o?.gamesPlayedPlayoff)}
                            </div>
                        </div>
                        <div className="p-2 rounded border">
                            <div className="text-gray-500">V / E / D</div>
                            <div className="font-semibold">
                                {wins}-{draws}-{losses}{" "}
                                <span className="text-gray-500 ml-1">({(Math.round(winPct * 100) / 100).toFixed(2)}%)</span>
                            </div>
                        </div>
                        <div className="p-2 rounded border">
                            <div className="text-gray-500">Gols (Feitos / Levados)</div>
                            <div className="font-semibold">
                                {goalsFor} / {goalsAgainst}
                            </div>
                        </div>

                        <div className="p-2 rounded border">
                            <div className="text-gray-500">Promoções</div>
                            <div className="font-semibold">{toNum(o?.promotions)}</div>
                        </div>
                        <div className="p-2 rounded border">
                            <div className="text-gray-500">Rebaixamentos</div>
                            <div className="font-semibold">{toNum(o?.relegations)}</div>
                        </div>
                        <div className="p-2 rounded border">
                            <div className="text-gray-500">Win Streak</div>
                            <div className="font-semibold">{toNum(o?.wstreak)}</div>
                        </div>

                        {/* Histórico de Playoffs (col-span-2) */}
                        <div className="p-2 rounded border col-span-2">
                            <div className="text-gray-500 mb-1">Histórico de Playoffs</div>

                            {(po ?? []).length === 0 ? (
                                <div className="text-xs text-gray-600">Sem temporadas concluídas.</div>
                            ) : (
                                <div className="flex items-stretch gap-3 overflow-x-auto pb-1">
                                    {(po ?? []).slice(0, maxPlayoffs).map((p) => {
                                        const crest = divisionCrestUrl(p.bestDivision) ?? FALLBACK_LOGO;
                                        const hpKey = asNonNegativeIntString(p.bestFinishGroup) ?? "";
                                        const hpLabel = HIGHEST_PLACEMENT_LABELS[hpKey] ?? p.bestFinishGroup ?? "–";
                                        return (
                                            <div
                                                key={`${p.seasonId}-${p.bestDivision}-${p.bestFinishGroup}`}
                                                className="min-w-[72px] px-2 py-1 border rounded-lg bg-white flex flex-col items-center text-center"
                                                title={`${p.seasonName ?? p.seasonId ?? ""} • ${hpLabel}`}
                                            >
                                                <img
                                                    src={crest}
                                                    onError={(e) => (e.currentTarget.src = FALLBACK_LOGO)}
                                                    alt={`Divisão ${p.bestDivision ?? ""}`}
                                                    className="w-10 h-10 object-contain"
                                                />
                                                <div className="mt-1 text-[11px] leading-tight font-medium">{hpLabel}</div>
                                                <div className="text-[10px] text-gray-500">{p.seasonName ?? p.seasonId}</div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default OverallSummaryCard;
