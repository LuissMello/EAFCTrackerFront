// Contrato de /api/clubs/{clubId}/player-cards e /api/clubs/{clubId}/player-compare (camelCase).
import type { ArchetypeRef, ArchetypeUsage } from "./archetypes.ts";

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
  /** Arquétipo principal (mais jogos no recorte); null sem dado (id 0). */
  archetype?: ArchetypeRef | null;
  /** Uso de cada arquétipo no recorte, mais jogos primeiro. */
  archetypes?: ArchetypeUsage[];
  /** Só em view=archetype: "<playerEntityId>-<archetypeId>" (id 0 = segmento sem arquétipo). */
  segmentKey?: string | null;
  /** "archetype" = overall com os pesos do arquétipo (carta de UM arquétipo); "position" = pesos da posição. */
  scoring?: "archetype" | "position";
  /** Overall pelos pesos da posição (para comparar com `overall` quando scoring = "archetype"). */
  overallByPosition?: number;
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
  /** Eco do filtro `archetypeId` (null = sem filtro). */
  archetypeId?: number | null;
  /** Opções do filtro, calculadas SEM o filtro de arquétipo. */
  availableArchetypes?: AvailableArchetype[];
  /** "player" (padrão) ou "archetype" (uma carta por jogador+arquétipo). */
  view?: "player" | "archetype";
  /** Eco do filtro `positionGroup` (null = todas as posições). */
  positionGroup?: string | null;
  /** Posições com jogos no recorte (sem nenhum dos dois filtros). */
  availablePositionGroups?: { positionGroup: string; matches: number }[];
  /** Eco do filtro `playerEntityId` (null = todos os jogadores). */
  playerEntityId?: number | null;
  /** Jogadores com cartas no recorte (calculado sem o filtro de jogador). */
  availablePlayers?: AvailablePlayer[];
}

export interface AvailablePlayer {
  playerEntityId: number;
  name: string;
  matches: number;
}

export interface AvailableArchetype {
  archetype: ArchetypeRef;
  players: number;
  matches: number;
}

export interface CardFilters {
  from: string;
  to: string;
  gameVersion: number | null;
  minMatches: number;
  /** Só as partidas deste arquétipo (null = todos). */
  archetypeId?: number | null;
  /** Só as partidas jogadas neste grupo de posição (null = todas). */
  positionGroup?: string | null;
  /** "archetype" = uma carta por (jogador, arquétipo). */
  view?: "player" | "archetype";
  /** Só as cartas deste jogador (null = todos). */
  playerEntityId?: number | null;
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
  /** Arquétipo pedido para cada lado (null = sem). */
  archetypeIdA?: number | null;
  archetypeIdB?: number | null;
}

export type CardSortKey = "overall" | "ata" | "pas" | "cri" | "def" | "imp" | "jogos";
