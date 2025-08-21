import React, { createContext, useContext, useEffect, useState } from "react";

type ClubState = {
    clubId: number;
    clubName?: string | null;
    crestAssetId?: string | null; // <- NOVO
};

type ClubContextType = {
    club: ClubState | null;
    setClub: (c: ClubState | null) => void;
};

const ClubContext = createContext<ClubContextType | undefined>(undefined);

export function ClubProvider({ children }: { children: React.ReactNode }) {
    const [club, setClubState] = useState<ClubState | null>(null);

    useEffect(() => {
        const raw = localStorage.getItem("club");
        if (raw) {
            try {
                const parsed = JSON.parse(raw);
                setClubState(parsed);
            } catch { /* ignore */ }
        }
    }, []);

    const setClub = (c: ClubState | null) => {
        setClubState(c);
        if (c) localStorage.setItem("club", JSON.stringify(c));
        else localStorage.removeItem("club");
    };

    return (
        <ClubContext.Provider value={{ club, setClub }}>
            {children}
        </ClubContext.Provider>
    );
}

export function useClub() {
    const ctx = useContext(ClubContext);
    if (!ctx) throw new Error("useClub deve ser usado dentro de um ClubProvider");
    // helpers convenientes
    const clubId = ctx.club?.clubId ?? null;
    const clubName = ctx.club?.clubName ?? null;
    const crestAssetId = ctx.club?.crestAssetId ?? null;
    return { ...ctx, clubId, clubName, crestAssetId };
}