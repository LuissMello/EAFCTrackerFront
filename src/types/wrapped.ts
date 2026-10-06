// Contrato: GET /api/clubs/{clubId}/wrapped?gameVersion=
import type { ArchetypeRef, ArchetypeUsage } from "./archetypes.ts";

export interface WrappedStreak {
  length: number;
  /** yyyy-MM-dd local */
  from: string;
  to: string;
}

export interface WrappedMatchRef {
  matchId: number;
  opponentName: string | null;
  goalsFor: number;
  goalsAgainst: number;
}

export interface WrappedSessionRef {
  sessionId: number;
  date: string;
  wins: number;
  draws: number;
  losses: number;
}

export interface WrappedPlayerStat {
  playerEntityId: number;
  name: string;
  value: number;
  /** Arquétipo principal do jogador no recorte (opcional: só quando o backend envia). */
  archetype?: ArchetypeRef | null;
  archetypes?: ArchetypeUsage[];
  [extra: string]: unknown;
}

export interface WrappedOppRecord {
  opponentClubId: number;
  name: string | null;
  crestAssetId: string | null;
  customCrestAssetId: string | null;
  matches: number;
  wins: number;
  draws: number;
  losses: number;
}

export interface WrappedMonth {
  month: string; // "2026-09"
  matches: number;
  wins: number;
  draws: number;
  losses: number;
}

export interface WrappedData {
  clubId: number;
  clubName: string | null;
  gameVersion: number | null;
  gameVersionName: string | null;
  from: string | null;
  to: string | null;
  timeZoneId: string | null;
  totals: {
    matches: number;
    wins: number;
    draws: number;
    losses: number;
    winRatePct: number;
    goalsFor: number;
    goalsAgainst: number;
    cleanSheets: number;
    sessions: number;
    activeDays: number;
    estimatedMinutes: number;
  };
  streaks: {
    longestWin: WrappedStreak | null;
    longestUnbeaten: WrappedStreak | null;
    longestWinless: WrappedStreak | null;
    longestCleanSheet: WrappedStreak | null;
  };
  bigMoments: {
    biggestWin: WrappedMatchRef | null;
    worstLoss: WrappedMatchRef | null;
    highestScoring: WrappedMatchRef | null;
    bestSession: WrappedSessionRef | null;
    worstSession: WrappedSessionRef | null;
  };
  players: {
    topScorer: WrappedPlayerStat | null;
    topAssister: WrappedPlayerStat | null;
    mostMotm: WrappedPlayerStat | null;
    bestAvgRating: WrappedPlayerStat | null;
    mostMatches: WrappedPlayerStat | null;
    mostRedCards: WrappedPlayerStat | null;
    hatTricks: number;
  };
  bestDuo: { scorerName: string; assisterName: string; goals: number } | null;
  opponents: {
    mostFaced: WrappedOppRecord | null;
    favoriteVictim: WrappedOppRecord | null;
    nemesis: WrappedOppRecord | null;
  };
  rhythm: {
    busiestWeekday: { weekday: number; matches: number } | null;
    busiestHour: { hour: number; matches: number } | null;
    bestMonth: { month: string; winRatePct: number; matches: number } | null;
    monthly: WrappedMonth[];
  };
  progression: {
    skillRating: {
      start: number | null;
      end: number | null;
      peak: { value: number; date: string } | null;
      low: { value: number; date: string } | null;
    };
    division: { start: number | null; end: number | null; promotions: number; relegations: number };
    srSeries: Array<{ date: string; value: number }>;
  };
  funFacts: string[];
  /** Arquétipos usados pelo clube no recorte (opcional: backends antigos não enviam). */
  archetypes?: WrappedArchetypes;
}

export interface WrappedArchetypes {
  mostUsed: ArchetypeUsage | null;
  /** Total de trocas de arquétipo (somando os jogadores). */
  switches: number;
  list: ArchetypeUsage[];
}
