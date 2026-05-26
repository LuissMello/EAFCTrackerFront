// ─────────────────────────────────────────────────────────────────────────────
// Types para as estatísticas de eventos de partida (match_event_aggregate_0~3)
// O mapeamento ID → label/categoria vem do backend; o frontend apenas renderiza.
// ─────────────────────────────────────────────────────────────────────────────

/** Definição de um evento, retornada pelo backend */
export interface EventDefinitionDto {
  id: string;
  label: string;
  category: string;
}

/** Estatísticas de um jogador individual */
export interface PlayerEventAggregatesDto {
  playerId: number;
  playerName: string;
  /** Chave = ID do evento; Valor = total de ocorrências para este jogador */
  events: Record<string, number>;
}

/** Dados de um clube com os jogadores */
export interface ClubEventAggregatesDto {
  clubId: number;
  clubName: string;
  crestAssetId?: string | null;
  players: PlayerEventAggregatesDto[];
}

/** Resposta completa do endpoint GET /api/Matches/{matchId}/event-aggregates */
export interface MatchEventAggregatesResponseDto {
  /** Categorias na ordem de exibição das abas */
  categories: string[];
  /** Mapeamento completo de IDs → label + categoria */
  eventDefinitions: EventDefinitionDto[];
  /** Dados por clube */
  clubs: ClubEventAggregatesDto[];
}

/** Coluna de evento para exibição nas tabelas */
export interface EventColumn {
  id: string;
  label: string;
}
