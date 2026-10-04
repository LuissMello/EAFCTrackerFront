// Contrato de /api/clubs/{clubId}/player-cards e /api/clubs/{clubId}/player-compare (camelCase).

export type CardTier = "bronze" | "prata" | "ouro" | "elite";
export type PositionGroup = "ATAQUE" | "MEIO" | "DEFESA" | "GOLEIRO";

/** Notas 0–99 em escala absoluta. `ata` é null para goleiros; `gol` só existe para goleiros. */
export interface CardAxes {
  ata: number | null;
  pas: number;
  cri: number;
  def: number;
  imp: number;
  reg: number;
  gol: number | null;
}

export type AxisKey = "ata" | "pas" | "cri" | "def" | "imp" | "reg" | "gol";

export interface CardStats {
  goals: number;
  assists: number;
  preAssists: number;
  goalsPerMatch: number;
  assistsPerMatch: number;
  shotAccuracyPct: number;
  passAccuracyPct: number;
  tackleAccuracyPct: number;
  savePct: number | null;
  avgRating: number;
  motm: number;
  redCards: number;
  cleanSheets: number | null;
}

export interface CardAttributes {
  overall: number | null;
  height: string | null;
}

export interface PlayerCard {
  playerEntityId: number;
  name: string;
  position: string;
  positionGroup: PositionGroup;
  matches: number;
  minutes: number;
  tier: CardTier;
  overall: number;
  provisional: boolean;
  axes: CardAxes;
  stats: CardStats;
  /** Últimas notas (até 5), a mais recente primeiro. */
  form: number[];
  attributes: CardAttributes | null;
  lastPlayedAt: string | null;
}

export interface PlayerCardsResponse {
  clubId: number;
  clubName: string | null;
  from: string | null;
  to: string | null;
  gameVersion: number | null;
  totalMatches: number;
  minMatches: number;
  cards: PlayerCard[];
}

export interface CardFilters {
  from: string;
  to: string;
  gameVersion: number | null;
  minMatches: number;
}

export type CompareWinner = "a" | "b" | "tie" | null;

export interface CompareMetric {
  key: string;
  label: string;
  a: number | null;
  b: number | null;
  higherIsBetter: boolean;
  winner: CompareWinner;
}

/** Resultados do clube em um recorte (juntos / só A / só B). */
export interface CompareStats {
  matches: number;
  wins: number;
  draws: number;
  losses: number;
  winRatePct: number | null;
  pointsPerMatch: number | null;
  goalsForPerMatch: number | null;
  goalsAgainstPerMatch: number | null;
}

export interface RatingSeriesPoint {
  matchId: number | string;
  timestamp: string;
  a: number | null;
  b: number | null;
}

export interface PlayerCompareResponse {
  clubId: number;
  a: PlayerCard;
  b: PlayerCard;
  metrics: CompareMetric[];
  together: CompareStats | null;
  onlyA: CompareStats | null;
  onlyB: CompareStats | null;
  ratingSeries: RatingSeriesPoint[];
}

export type CardSortKey = "overall" | "ata" | "pas" | "cri" | "def" | "imp" | "jogos";
