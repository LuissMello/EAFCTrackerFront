import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../services/api.ts";

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
  const [searchParams, setSearchParams] = useSearchParams();
  const [isInitialized, setIsInitialized] = useState(false);

  // ? Initialize from URL or localStorage on mount
  useEffect(() => {
    const urlClubId = searchParams.get("clubId");

    if (urlClubId) {
      const clubId = parseInt(urlClubId, 10);
      if (!isNaN(clubId)) {
        //?  Check localStorage for full club data
        const stored = localStorage.getItem("club");
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            if (parsed.clubId === clubId) {
              setClubState(parsed);
              setIsInitialized(true);
              return;
            }
          } catch {
            /* silent catch */
          }
        }

        // ? If not in localStorage, fetch from API
        api
          .get<{ clubId: number; name: string; crestAssetId?: string | null }[]>(
            "https://eafctracker-cvadcceuerbgegdj.brazilsouth-01.azurewebsites.net/api/clubs"
          )
          .then((response) => {
            const foundClub = response.data.find((c) => c.clubId === clubId);
            if (foundClub) {
              const clubData = {
                clubId: foundClub.clubId,
                clubName: foundClub.name || null,
                crestAssetId: foundClub.crestAssetId || null,
              };
              setClubState(clubData);
              localStorage.setItem("club", JSON.stringify(clubData));
            }
          })
          .catch(() => {
            // ? If fetch fails, just set the clubId
            setClubState({ clubId });
          })
          .finally(() => {
            setIsInitialized(true);
          });
      } else {
        setIsInitialized(true);
      }
    } else {
      // ? No URL param, check localStorage
      const stored = localStorage.getItem("club");
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          setClubState(parsed);
        } catch {
          /* silent catch */
        }
      }
      setIsInitialized(true);
    }
  }, []); // ? Run once on mount

  // ? Update URL when club changes (after initialization)
  useEffect(() => {
    if (!isInitialized) return;

    const next = new URLSearchParams(searchParams);

    if (club?.clubId) {
      next.set("clubId", club.clubId.toString());
    } else {
      next.delete("clubId");
    }

    setSearchParams(next, { replace: true });
  }, [club, searchParams, setSearchParams, isInitialized]);

  const setClub = useCallback((c: ClubState | null) => {
    setClubState(c);
    if (c) {
      localStorage.setItem("club", JSON.stringify(c));
    } else {
      localStorage.removeItem("club");
    }
  }, []);

  return <ClubContext.Provider value={{ club, setClub }}>{children}</ClubContext.Provider>;
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
