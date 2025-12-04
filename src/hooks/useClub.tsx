import React, {
    createContext,
    useContext,
    useEffect,
    useState,
    useCallback,
    useMemo,
    useRef,
} from "react";
import { useSearchParams } from "react-router-dom";
import api from "../services/api.ts";
import { API_ENDPOINTS } from "../config/urls.ts";

// ===== Tipos =====
export type ClubState = {
    clubId: number;
    clubName?: string | null;
    crestAssetId?: string | null;
};

type ClubContextType = {
    /** Primeiro clube (retrocompatibilidade) */
    club: ClubState | null;
    /** Define UM clube (substitui a seleção por um único) */
    setClub: (c: ClubState | null) => void;

    /** Seleção múltipla completa */
    selectedClubs: ClubState[];
    setSelectedClubs: (arr: ClubState[]) => void;

    /** IDs selecionados (CSV-friendly) */
    selectedClubIds: number[];

    /** Helpers convenientes */
    clubId: number | null;
    clubName: string | null;
    crestAssetId: string | null;
};

const ClubContext = createContext<ClubContextType | undefined>(undefined);

function parseCsvIds(csv: string | null): number[] {
    if (!csv) return [];
    return csv
        .split(",")
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => Number.isFinite(n) && n > 0);
}

export function ClubProvider({ children }: { children: React.ReactNode }) {
    const [searchParams, setSearchParams] = useSearchParams();
    const [selectedClubs, setSelectedClubsState] = useState<ClubState[]>([]);
    const [isInitialized, setIsInitialized] = useState(false);

    // Guard para rodar a hidratação apenas uma vez (sem precisar desabilitar ESLint)
    const hydratedRef = useRef(false);

    // 1) Inicializa a partir da URL (clubIds primeiro; senão, clubId) ou localStorage
    useEffect(() => {
        if (hydratedRef.current) return;
        hydratedRef.current = true;

        let cancelled = false;

        async function hydrateFromUrlOrStorage() {
            // 1a) URL: clubIds (CSV) tem prioridade
            const urlCsv = searchParams.get("clubIds");
            let ids = parseCsvIds(urlCsv);

            // 1b) Senão, tenta clubId (único) para retrocompatibilidade
            if (ids.length === 0) {
                const urlSingle = searchParams.get("clubId");
                const n = urlSingle ? parseInt(urlSingle, 10) : NaN;
                if (Number.isFinite(n) && n > 0) ids = [n];
            }

            // 1c) Se ainda vazio, tenta localStorage (novo "clubs" ou antigo "club")
            if (ids.length === 0) {
                const storedMulti = localStorage.getItem("clubs");
                if (storedMulti) {
                    try {
                        const arr = JSON.parse(storedMulti);
                        if (Array.isArray(arr) && arr.every((x: any) => typeof x?.clubId === "number")) {
                            if (!cancelled) setSelectedClubsState(arr);
                            setIsInitialized(true);
                            return;
                        }
                    } catch { /* ignore */ }
                }
                const storedSingle = localStorage.getItem("club");
                if (storedSingle) {
                    try {
                        const c = JSON.parse(storedSingle);
                        if (c && typeof c.clubId === "number") {
                            if (!cancelled) setSelectedClubsState([c]);
                            setIsInitialized(true);
                            return;
                        }
                    } catch { /* ignore */ }
                }
                // Nada definido
                setIsInitialized(true);
                return;
            }

            // 1d) Tentar hidratar nome/crest a partir do localStorage (multi) e, se faltar, buscar no backend
            let known: ClubState[] = [];
            const cache = localStorage.getItem("clubs");
            if (cache) {
                try {
                    const arr = JSON.parse(cache);
                    if (Array.isArray(arr)) {
                        known = arr.filter((c: any) => ids.includes(c?.clubId));
                    }
                } catch { /* ignore */ }
            }

            const missingIds = ids.filter((id) => !known.some((c) => c.clubId === id));
            let fetched: ClubState[] = [];
            if (missingIds.length > 0) {
                try {
                    const { data } = await api.get<
                        { clubId: number; name: string; crestAssetId?: string | null }[]
                    >(API_ENDPOINTS.CLUBS);
                    if (Array.isArray(data)) {
                        fetched = data
                            .filter((d) => missingIds.includes(d.clubId))
                            .map((d) => ({
                                clubId: d.clubId,
                                clubName: d.name ?? null,
                                crestAssetId: d.crestAssetId ?? null,
                            }));
                    }
                } catch {
                    // fallback: pelo menos garantir os IDs
                    fetched = missingIds.map((id) => ({
                        clubId: id,
                        clubName: null,
                        crestAssetId: null,
                    }));
                }
            }

            // Manter a ordem dos ids da URL
            const ordered = ids
                .map(
                    (id) =>
                        known.find((c) => c.clubId === id) ??
                        fetched.find((c) => c.clubId === id)
                )
                .filter((x): x is ClubState => !!x);

            if (!cancelled) setSelectedClubsState(ordered);
            setIsInitialized(true);
        }

        hydrateFromUrlOrStorage();
        return () => {
            cancelled = true;
        };
    }, [searchParams]);

    // 2) Sempre que a seleção mudar (após init), sincroniza com URL e localStorage
    useEffect(() => {
        if (!isInitialized) return;

        // Atualiza localStorage
        if (selectedClubs.length > 0) {
            localStorage.setItem("clubs", JSON.stringify(selectedClubs));
            // Mantém também o antigo "club" com o primeiro, para compat.
            localStorage.setItem("club", JSON.stringify(selectedClubs[0]));
        } else {
            localStorage.removeItem("clubs");
            localStorage.removeItem("club");
        }

        // Atualiza URL preservando os demais parâmetros
        const next = new URLSearchParams(searchParams);
        if (selectedClubs.length > 0) {
            const csv = selectedClubs.map((c) => c.clubId).join(",");
            next.set("clubIds", csv);
            next.delete("clubId"); // remove o antigo param
        } else {
            next.delete("clubIds");
            next.delete("clubId");
        }
        setSearchParams(next, { replace: true });
    }, [selectedClubs, isInitialized, searchParams, setSearchParams]);

    // 3) Setters públicos
    const setSelectedClubs = useCallback((arr: ClubState[]) => {
        setSelectedClubsState(Array.isArray(arr) ? arr.filter(Boolean) : []);
    }, []);

    const setClub = useCallback((c: ClubState | null) => {
        setSelectedClubsState(c ? [c] : []);
    }, []);

    // Helpers / retrocompatibilidade
    const club = selectedClubs[0] ?? null;
    const selectedClubIds = useMemo(
        () => selectedClubs.map((c) => c.clubId),
        [selectedClubs]
    );

    const value: ClubContextType = {
        club,
        setClub,
        selectedClubs,
        setSelectedClubs,
        selectedClubIds,

        clubId: club?.clubId ?? null,
        clubName: club?.clubName ?? null,
        crestAssetId: club?.crestAssetId ?? null,
    };

    return <ClubContext.Provider value={value}>{children}</ClubContext.Provider>;
}

export function useClub() {
    const ctx = useContext(ClubContext);
    if (!ctx) throw new Error("useClub deve ser usado dentro de um ClubProvider");
    return ctx;
}
