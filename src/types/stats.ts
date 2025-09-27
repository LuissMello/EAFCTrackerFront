export interface PlayerStats {
  playerId: number;
  playerName: string;
  clubId: number;
  matchesPlayed: number;
  totalGoals: number;
  totalGoalsConceded: number;
  totalAssists: number;
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
  passAccuracyPercent: number;
  tackleSuccessPercent: number;
  goalAccuracyPercent: number;
  winPercent: number;
  proHeight: number;
  proName: string;
  proOverallStr: string;
}

export interface ClubStats {
  clubId: number;
  clubName: string;
  matchesPlayed: number;
  totalGoals: number;
  totalGoalsConceded: number;
  totalAssists: number;
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