import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api.ts";
import { useClub } from "../hooks/useClub.tsx";

// ======================
// Tipos (alinha com seu endpoint /api/Matches/matches/results)
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
    resultText?: string;
}

// ======================
// Helpers
// ======================
const fmtDateTime = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short",
});

const FALLBACK_LOGO = "https://via.placeholder.com/96?text=Logo";

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

function KitSwatches({ colors }: { colors: Array<string | number | null | undefined> }) {
    const valid = colors.map(toHex).filter((c): c is string => Boolean(c) && c!.length === 7);
    if (valid.length === 0) return null;
    return (
        <div className="flex gap-1 mt-1" aria-label="Cores do kit">
            {valid.map((c, i) => (
                <div key={`${c}-${i}`} className="w-3.5 h-3.5 rounded border" style={{ background: c }} />
            ))}
        </div>
    );
}

function Skeleton({ className = "" }: { className?: string }) {
    return <div className={`animate-pulse bg-gray-200 rounded ${className}`} />;
}

function MatchCard({ m }: { m: MatchResultDto }) {
    return (
        <Link
            to={`/match/${m.matchId}`}
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
                        className="w-10 h-10 rounded-full object-contain bg-white border"
                        loading="lazy"
                    />
                    <div className="min-w-0">
                        <div className="truncate leading-tight">{m.clubAName}</div>
                        <KitSwatches
                            colors={[
                                m.clubADetails?.kitColor1,
                                m.clubADetails?.kitColor2,
                                m.clubADetails?.kitColor3,
                                m.clubADetails?.kitColor4,
                            ]}
                        />
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
                        <KitSwatches
                            colors={[
                                m.clubBDetails?.kitColor1,
                                m.clubBDetails?.kitColor2,
                                m.clubBDetails?.kitColor3,
                                m.clubBDetails?.kitColor4,
                            ]}
                        />
                    </div>
                    <img
                        src={crestUrl(m.clubBDetails?.crestAssetId)}
                        onError={(e) => ((e.currentTarget.src = FALLBACK_LOGO))}
                        alt={`Escudo ${m.clubBName}`}
                        className="w-10 h-10 rounded-full object-contain bg-white border"
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
    const { club } = useClub(); // <- pega clubId/clubName do menu
    const clubId = club?.clubId;

    const [results, setResults] = useState<MatchResultDto[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [search, setSearch] = useState("");
    const [onlyWithLogos, setOnlyWithLogos] = useState(false);

    useEffect(() => {
        // sem clubId, não busca
        if (!clubId) {
            setResults([]);
            return;
        }

        let cancel = false;
        (async () => {
            try {
                setLoading(true);
                setError(null);

                // se o seu axios `api` já tem baseURL, use o caminho relativo:
                // const { data } = await api.get<MatchResultDto[]>("/api/Matches/matches/results", { params: { clubId } });

                // caso contrário, mantenha a URL absoluta:
                const { data } = await api.get<MatchResultDto[]>(
                    "https://localhost:5000/api/Matches/matches/results",
                    { params: { clubId } }
                );

                if (!cancel) setResults(data ?? []);
            } catch (err: any) {
                if (!cancel) setError(err?.message ?? "Erro ao carregar resultados");
            } finally {
                if (!cancel) setLoading(false);
            }
        })();

        return () => {
            cancel = true;
        };
    }, [clubId]);

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

                <div className="flex gap-2 items-end">
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
                    <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                        <input
                            type="checkbox"
                            checked={onlyWithLogos}
                            onChange={(e) => setOnlyWithLogos(e.target.checked)}
                        />
                        Somente com escudos
                    </label>
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
                    Informe um clube no menu (botão “Alterar clube”) para começar.
                </div>
            )}

            <div className="grid gap-3">
                {filtered.map((m) => (
                    <MatchCard key={m.matchId} m={m} />
                ))}
            </div>
        </div>
    );
}
