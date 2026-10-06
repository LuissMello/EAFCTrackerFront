import type { ArchetypeRef, ArchetypeUsage } from "./archetypes.ts";

export interface PlayerStats {
  playerId: number;
  playerEntityId: number;
  playerName: string;
  clubId: number;
  matchesPlayed: number;
  totalGoals: number;
  totalGoalsConceded: number;
  totalAssists: number;
  totalPreAssists: number;
  totalShots: number;
  totalPassesMade: number;
  totalPassAttempts: number;
  totalTacklesMade: number;
  totalTackleAttempts: number;
  totalWins: number;
  totalLosses: number;
  totalDraws: number;
  totalCleanSheets: number;
  totalRedCards: number;
  totalSaves: number;
  hasGoalkeeperAppearance?: boolean;
  totalMom: number;
  avgRating: number;
  passAccuracyPercent: number;
  tackleSuccessPercent: number;
  goalAccuracyPercent: number;
  winPercent: number;
  proHeight: number;
  proName: string;
  proOverallStr: string;
  totalSecondsPlayed: number;
  totalGameTime: number;
  /** Arquétipo principal no recorte (ou o da partida, em linhas de uma partida); null/ausente = sem dado. */
  archetype?: ArchetypeRef | null;
  archetypeId?: number;
  /** Uso de cada arquétipo no recorte, quando mais de um. */
  archetypes?: ArchetypeUsage[];
  /** Posição (texto da EA) e grupo da linha; nos segmentos, os da combinação. */
  position?: string | null;
  pos?: string | null;
  positionGroup?: string | null;
  /**
   * Só quando há mais de uma combinação (arquétipo, grupo de posição) no recorte: uma linha por combinação, com os mesmos
   * campos da linha do jogador recalculados só com os jogos dela (somas aditivas = total da linha principal).
   */
  segments?: PlayerStats[];
}

export interface ClubStats {
  clubId: number;
  clubName: string;
  matchesPlayed: number;
  totalGoals: number;
  totalGoalsConceded: number;
  totalAssists: number;
  totalPreAssists: number;
  avgPreAssists: number;
  totalShots: number;
  totalPassesMade: number;
  totalPassAttempts: number;
  totalTacklesMade: number;
  totalTackleAttempts: number;
  totalWins: number;
  totalLosses: number;
  totalDraws: number;
  totalCleanSheets: number;
  totalRedCards: number;
  totalSaves: number;
  totalMom: number;
  avgRating: number;
  winPercent: number;
  passAccuracyPercent: number;
  goalAccuracyPercent: number;
  totalGoalsAgainst?: number;
}
