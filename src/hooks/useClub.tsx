import React, { createContext, useContext, useEffect, useState } from "react";

export type Club = {
    clubId: number;
    clubName?: string;
};

type Ctx = {
    club: Club | null;
    setClub: (c: Club | null) => void;
};

const ClubContext = createContext<Ctx>({ club: null, setClub: () => { } });

export function ClubProvider({ children }: { children: React.ReactNode }) {
    const [club, setClub] = useState<Club | null>(() => {
        try {
            const raw = localStorage.getItem("clubCtx");
            return raw ? (JSON.parse(raw) as Club) : null;
        } catch {
            return null;
        }
    });

    useEffect(() => {
        localStorage.setItem("clubCtx", JSON.stringify(club));
    }, [club]);

    return (
        <ClubContext.Provider value={{ club, setClub }}>
            {children}
        </ClubContext.Provider>
    );
}

export function useClub() {
    const ctx = useContext(ClubContext);
    if (!ctx) throw new Error("useClub deve ser usado dentro de um ClubProvider");
    return ctx;
}
