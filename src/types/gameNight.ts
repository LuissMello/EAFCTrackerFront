// Contrato: GET /api/clubs/{clubId}/game-nights e /game-nights/{sessionId}
import type { ArchetypeRef, ArchetypeUsage } from "./archetypes.ts";

export type MatchResultCode = "W" | "D" | "L";

export interface GameNightSummary {
  sessionId: number;
  /** yyyy-MM-dd (data local do clube) */
  date: string;
  startedAtUtc: string;
  endedAtUtc: string;
  matches: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
}

export interface GameNightsResponse {
  clubId: number;
  timeZoneId: string | null;
  /** ascendente por startedAtUtc */
  nights: GameNightSummary[];
}

export interface MatchRef {
  matchId: number;
  opponentName: string | null;
  goalsFor: number;
  goalsAgainst: number;
}

export interface NightRecord {
  matches: number;
  wins: number;
  draws: number;
  losses: number;
  winRatePct: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  cleanSheets: number;
}

export interface NightPlayerRef {
  playerEntityId: number;
  name: string;
}

export interface NightHighlights {
  biggestWin: MatchRef | null;
  worstLoss: MatchRef | null;
  topScorer: (NightPlayerRef & { goals: number }) | null;
  topAssister: (NightPlayerRef & { assists: number }) | null;
  bestRated: (NightPlayerRef & { avgRating: number; matches: number }) | null;
  manOfTheMatch: (NightPlayerRef & { count: number }) | null;
  hatTricks: Array<NightPlayerRef & { matchId: number }>;
  redCards: number;
}

export interface NightPlayerRow {
  playerEntityId: number;
  name: string;
  position: string | null;
  matches: number;
  goals: number;
  assists: number;
  preAssists: number;
  avgRating: number | null;
  motm: number;
  redCards: number;
  /** Arquétipo principal da noite (mais jogos); null sem dado. */
  archetype?: ArchetypeRef | null;
  /** Presente quando o jogador usou mais de um arquétipo na noite. */
  archetypes?: ArchetypeUsage[];
  /**
   * Presente quando há mais de uma combinação (arquétipo, grupo da posição) do jogador na noite; ordenado por jogos desc.
   * Os segmentos somam os totais da linha.
   */
  segments?: NightPlayerSegment[];
}

/** Uma fatia da noite do jogador: mesmos números da linha + o arquétipo e a posição daquela fatia. */
export interface NightPlayerSegment {
  archetype: ArchetypeRef | null;
  position: string | null;
  positionGroup?: string | null;
  matches: number;
  goals: number;
  assists: number;
  preAssists: number;
  avgRating: number | null;
  motm: number;
  redCards: number;
}

export interface NightOpponentRow {
  opponentClubId: number;
  name: string | null;
  crestAssetId: string | null;
  customCrestAssetId: string | null;
  matches: number;
  wins: number;
  draws: number;
  losses: number;
}

export interface NightGoal {
  scorerName: string | null;
  assistName: string | null;
  preAssistName: string | null;
}

export interface NightMatch {
  matchId: number;
  timestamp: string;
  opponentClubId: number | null;
  opponentName: string | null;
  crestAssetId: string | null;
  customCrestAssetId: string | null;
  goalsFor: number;
  goalsAgainst: number;
  result: MatchResultCode;
  ourPlayersCount: number;
  opponentPlayersCount: number;
  skillRatingAfter: number | null;
  goals: NightGoal[];
}

export interface GameNightDetail {
  clubId: number;
  clubName: string | null;
  sessionId: number;
  date: string;
  timeZoneId: string | null;
  startedAtUtc: string;
  endedAtUtc: string;
  durationMinutes: number;
  prevSessionId: number | null;
  nextSessionId: number | null;
  /** 1-based */
  index: number;
  total: number;
  record: NightRecord;
  skillRating: { start: number | null; end: number | null; delta: number | null };
  division: { start: number | null; end: number | null };
  highlights: NightHighlights;
  players: NightPlayerRow[];
  opponents: NightOpponentRow[];
  matches: NightMatch[];
}
