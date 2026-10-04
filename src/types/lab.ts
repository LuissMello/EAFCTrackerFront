// Contrato: /api/clubs/{clubId}/lab/*

export type Reliability = "low" | "medium" | "high";

export interface LabStats {
  matches: number;
  wins: number;
  draws: number;
  losses: number;
  winRatePct: number;
  pointsPerMatch: number;
  goalsForPerMatch: number;
  goalsAgainstPerMatch: number;
}

export interface PlayerImpactRow {
  playerEntityId: number;
  name: string;
  with: LabStats;
  without: LabStats | null;
  delta: { winRatePct: number; pointsPerMatch: number; goalDiffPerMatch: number } | null;
  reliability: Reliability;
  note: string | null;
}

export interface PlayerImpactResponse {
  clubId: number;
  from: string | null;
  to: string | null;
  totalMatches: number;
  baseline: LabStats;
  players: PlayerImpactRow[];
}

export type WeekdayRow = LabStats & { weekday: number };
export type HourRow = LabStats & { hour: number };
export type SessionPositionRow = LabStats & { position: number };
export type PlayersCountRow = LabStats & { players: number };
export type OpponentBand = "mais fraco" | "parecido" | "mais forte";
export type OpponentStrengthRow = LabStats & { band: OpponentBand; srGapMin: number | null; srGapMax: number | null };

export interface LabContextResponse {
  clubId: number;
  timeZoneId: string | null;
  baseline: LabStats;
  byWeekday: WeekdayRow[];
  byHour: HourRow[];
  bySessionPosition: SessionPositionRow[];
  byOurPlayers: PlayersCountRow[];
  byOpponentPlayers: PlayersCountRow[];
  byOpponentStrength: OpponentStrengthRow[] | null;
}

export interface Duo {
  aPlayerEntityId: number;
  aName: string;
  bPlayerEntityId: number;
  bName: string;
  together: LabStats;
  apart: LabStats | null;
  delta: { winRatePct: number; pointsPerMatch: number } | null;
  reliability: Reliability;
}

export interface DuosResponse {
  best: Duo[];
  worst: Duo[];
}

/** Filtros da página (datas locais yyyy-MM-dd; vazio = sem limite). */
export interface LabFilters {
  from: string;
  to: string;
  gameVersion: number | null;
  minMatches: number;
}
