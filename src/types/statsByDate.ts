// src/types/statsByDate.ts — tipos das telas de estatísticas por data (time e jogador individual)
import type { PlayerStats } from "./stats.ts";

export type FullMatchStatisticsDto = {
  overall?: {
    totalMatches?: number;
    totalWins?: number;
    totalDraws?: number;
    totalLosses?: number;

    passAccuracyPercent?: number;
    PassAccuracyPercent?: number;
    tackleSuccessPercent?: number;
    TackleSuccessPercent?: number;
  };
  players?: PlayerStats[];
  clubs?: Array<{
    clubId?: number;
    ClubId?: number;
    goalsFor?: number;
    GoalsFor?: number;
    goalsAgainst?: number;
    GoalsAgainst?: number;
  }>;
};

export type FullMatchStatisticsByDayDto = {
  date: string; // "YYYY-MM-DD"
  statistics: FullMatchStatisticsDto;
};

export type DayBlock = {
  date: string;
  matchesCount: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  players: PlayerStats[];
};

// Endpoint agrupado por dia para UM jogador
export type PlayerStatisticsByDayDto = {
  date: string; // "YYYY-MM-DD"
  statistics: PlayerStats[]; // uma entrada por jogo desse jogador nesse dia (com Date)
};

export type SimplePlayerOption = {
  playerId: number;
  name: string;
};

export type SummaryBox = {
  scopeLabel: string;
  totalMatches: number;
  totalWins: number;
  totalDraws: number;
  totalLosses: number;
  totalGoals: number;
  totalAssists: number;
  totalPreAssists: number;
  totalPassesMade: number;
  totalPassAttempts: number;
  totalTacklesMade: number;
  totalTackleAttempts: number;
  totalSaves: number;
  avgRating: number;
  passPct: number;
  tacklePct: number;
  goalsPerGame: number;
  daysCount: number;
  matchesPerDay: number;
};

export type PlayerDaySummary = {
  date: string;
  matches: number;
  goals: number;
  assists: number;
  preAssists: number;
  shots: number;
  passesMade: number;
  passesAttempted: number;
  passPct: number;
  tacklesMade: number;
  tacklesAttempted: number;
  tacklePct: number;
  saves: number;
  rating: number;
  firstMatchTime?: string | null;
  lastMatchTime?: string | null;
};

// Estrutura genérica para ranking (serve para jogos e para dias)
export type GameRow = {
  id: string;
  dateISO: string | null;
  time: string | null;
  goals: number;
  assists: number;
  preAssists: number;
  passesMade: number;
  passesAttempted: number;
  passPct: number;
  tacklesMade: number;
  tacklesAttempted: number;
  tacklePct: number;
  rating: number;
};

export type GameHighlight = {
  item: PlayerStats;
  time: string | null;
  goals: number;
  assists: number;
  passesMade: number;
  passesAttempted: number;
  passPct: number;
  tacklesMade: number;
  tacklesAttempted: number;
  tacklePct: number;
  saves: number;
  rating: number;
  participations: number;
};
