// Contrato dos arquétipos (public: /api/archetypes, /api/clubs/{id}/archetypes/summary; admin: /api/admin/archetypes).
// `id` é o archetypeid da EA gravado em cada partida do jogador. 0/ausente => sem dado (campos `archetype` vêm null).

export type ArchetypeGroup = "ATAQUE" | "MEIO" | "DEFESA" | "GOLEIRO";

/** Referência a um arquétipo dentro de qualquer payload. `label` já vem pronto: nome do catálogo ou "Arquétipo #id". */
export interface ArchetypeRef {
  id: number;
  name: string | null;
  label: string;
  shortName: string | null;
  /** Do catálogo ou, se não definido, inferido pela posição mais usada nesse arquétipo. */
  positionGroup: ArchetypeGroup | null;
}

/** Uso de um arquétipo por um jogador (perfil, cartas, noite de jogo, resumo). */
export interface ArchetypeUsage {
  archetype: ArchetypeRef;
  matches: number;
  /** % dos jogos do jogador no recorte (0–100). */
  pct: number;
  avgRating: number | null;
  /** Média do overall (ProOverall) nas partidas desse arquétipo; null se não houver. */
  avgProOverall: number | null;
  goals: number;
  assists: number;
  firstPlayedAt: string | null;
  lastPlayedAt: string | null;
}

export interface ArchetypeChange {
  /** ISO da partida em que passou a usar `to`. */
  at: string;
  matchId: number;
  from: ArchetypeRef | null;
  to: ArchetypeRef;
}

/** GET /api/clubs/{clubId}/archetypes/summary?from=&to=&gameVersion= */
export interface ArchetypeSummaryTopPlayer {
  playerEntityId: number;
  name: string;
  matches: number;
  avgRating: number | null;
  avgProOverall: number | null;
}

export interface ArchetypeSummaryRow {
  archetype: ArchetypeRef;
  matches: number;
  players: number;
  avgRating: number | null;
  avgProOverall: number | null;
  minProOverall: number | null;
  maxProOverall: number | null;
  goalsPerMatch: number;
  assistsPerMatch: number;
  winPct: number;
  passAccuracyPct: number | null;
  shotAccuracyPct: number | null;
  tackleAccuracyPct: number | null;
  topPlayers: ArchetypeSummaryTopPlayer[];
}

export interface ArchetypeSummaryPlayer {
  playerEntityId: number;
  name: string;
  switches: number;
  archetypes: ArchetypeUsage[];
}

/** Opção do filtro vinda do backend (calculada com a posição aplicada e SEM o arquétipo). */
export interface AvailableArchetypeItem {
  archetype: ArchetypeRef;
  players: number;
  matches: number;
}

/** Posições com jogos (calculado sem nenhum dos dois filtros). */
export interface AvailablePositionGroup {
  positionGroup: ArchetypeGroup;
  matches: number;
}

/** Resumo do perfil com o filtro Posição → Arquétipo aplicado. */
export interface FilteredSummary {
  matches: number;
  wins: number;
  draws: number;
  losses: number;
  goals: number;
  assists: number;
  avgRating: number | null;
  avgProOverall: number | null;
}

export interface ArchetypeSummary {
  clubId: number;
  from: string | null;
  to: string | null;
  gameVersion: number | null;
  totalPlayerMatches: number;
  withoutArchetype: number;
  archetypes: ArchetypeSummaryRow[];
  byPlayer: ArchetypeSummaryPlayer[];
  /** Eco dos filtros aplicados (null = Todas/Todos). */
  positionGroup?: ArchetypeGroup | null;
  archetypeId?: number | null;
  availableArchetypes?: AvailableArchetypeItem[];
  availablePositionGroups?: AvailablePositionGroup[];
}

/** GET /api/admin/archetypes (exige login de admin). */
export interface AdminArchetype {
  id: number;
  name: string | null;
  shortName: string | null;
  positionGroup: ArchetypeGroup | null;
  inferredPositionGroup: ArchetypeGroup | null;
  matches: number;
  players: number;
  avgProOverall: number | null;
  topPlayers: { playerEntityId: number; name: string; matches: number }[];
  updatedAt: string | null;
}

/** PUT /api/admin/archetypes/{id} */
export interface AdminArchetypeUpdate {
  name: string | null;
  shortName: string | null;
  positionGroup: ArchetypeGroup | null;
}
