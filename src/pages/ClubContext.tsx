import React, { createContext, useContext, useEffect, useState } from "react";

type ClubContextType = {
    clubId: number | null;
    clubName: string | null;
    setClub: (id: number, name: string) => void;
    clearClub: () => void;
};

const ClubContext = createContext<ClubContextType | undefined>(undefined);

export const ClubProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [clubId, setClubId] = useState<number | null>(null);
    const [clubName, setClubName] = useState<string | null>(null);

    // carrega do localStorage (se existir)
    useEffect(() => {
        const savedId = localStorage.getItem("clubId");
        const savedName = localStorage.getItem("clubName");
        if (savedId) setClubId(Number(savedId));
        if (savedName) setClubName(savedName);
    }, []);

    const setClub = (id: number, name: string) => {
        setClubId(id);
        setClubName(name);
        localStorage.setItem("clubId", String(id));
        localStorage.setItem("clubName", name);
    };

    const clearClub = () => {
        setClubId(null);
        setClubName(null);
        localStorage.removeItem("clubId");
        localStorage.removeItem("clubName");
    };

    return (
        <ClubContext.Provider value={{ clubId, clubName, setClub, clearClub }}>
            {children}
        </ClubContext.Provider>
    );
};

export const useClub = () => {
    const ctx = useContext(ClubContext);
    if (!ctx) throw new Error("useClub deve ser usado dentro de ClubProvider");
    return ctx;
};
