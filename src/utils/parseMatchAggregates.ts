import {
  ClubEventAggregatesDto,
  EventColumn,
  EventDefinitionDto,
} from '../types/matchEventAggregates.ts';

// ─────────────────────────────────────────────────────────────────────────────
// Utilitários — o mapeamento de eventos vem do backend via EventDefinitionDto[].
// Nenhum ID ou label é hardcoded aqui.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Retorna as colunas de uma categoria específica a partir das definições
 * recebidas do backend.
 */
export function getColumnsForCategory(
  definitions: EventDefinitionDto[],
  category: string
): EventColumn[] {
  return definitions
    .filter((d) => d.category === category)
    .map((d) => ({ id: d.id, label: d.label, confidence: d.confidence }));
}

/**
 * Coleta todos os IDs de eventos desconhecidos (ausentes nas definições)
 * encontrados nos dados dos jogadores.
 * Retornado ordenado numericamente.
 */
export function getUnknownColumns(
  clubs: ClubEventAggregatesDto[],
  definitions: EventDefinitionDto[]
): EventColumn[] {
  const knownIds = new Set(definitions.map((d) => d.id));
  const unknownIds = new Set<string>();

  for (const club of clubs) {
    for (const player of club.players) {
      for (const id of Object.keys(player.events)) {
        if (!knownIds.has(id)) unknownIds.add(id);
      }
    }
  }

  return [...unknownIds]
    .sort((a, b) => Number(a) - Number(b))
    .map((id) => ({ id, label: `ID ${id}`, confidence: 'ambiguous' as const }));
}

/**
 * Conta quantos IDs desconhecidos existem nos dados.
 */
export function countUnknownIds(
  clubs: ClubEventAggregatesDto[],
  definitions: EventDefinitionDto[]
): number {
  return getUnknownColumns(clubs, definitions).length;
}

/**
 * Retorna o valor de um evento para um jogador (0 se ausente).
 */
export function getEventValue(
  events: Record<string, number>,
  eventId: string
): number {
  return Number(events[eventId] ?? 0);
}
