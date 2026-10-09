// Tipos do "Registro de gols antecipado" (contrato: /api/goal-registrations*)

export type RegistrationStatus = "Pending" | "Linked" | "NeedsReview" | "Expired";

export interface RosterPlayer {
  playerEntityId: number;
  name: string;
  position?: string | null;
  matchesPlayed?: number | null;
  lastPlayedAt?: string | null;
  active: boolean;
}

export interface RosterResponse {
  clubId: number;
  players: RosterPlayer[];
}

export type OpponentSource = "history" | "ea" | "both";

export interface OpponentResult {
  clubId: number;
  name: string;
  currentDivision?: string | number | null;
  reputationTier?: string | number | null;
  source: OpponentSource;
  timesFaced?: number | null;
  lastFacedAt?: string | null;
  /** Escudo = teamId do clube (mesmo identificador usado no resto do site). */
  crestAssetId?: string | null;
  /** Escudo alternativo (crest do kit) para quando o teamId não tem imagem no CDN. */
  customCrestAssetId?: string | null;
  record?: { games: number; wins: number; draws: number; losses: number } | null;
  /** Id do time (escudo) quando difere do crestAssetId. */
  teamId?: string | number | null;
  /** Divisão atual (texto/número) e skill rating, quando a busca os traz. */
  division?: string | number | null;
  skillRating?: number | null;
}

export interface OpponentSearchResponse {
  query: string;
  eaAvailable: boolean;
  /** A busca da EA é por prefixo e cortada em ~12 resultados. */
  eaTruncated?: boolean;
  results: OpponentResult[];
}

/** Adversário escolhido (o que é persistido no rascunho / enviado ao backend). */
export interface OpponentRef {
  clubId: number;
  name: string;
  currentDivision?: string | number | null;
  timesFaced?: number | null;
  crestAssetId?: string | null;
  customCrestAssetId?: string | null;
}

export interface OpponentPreview {
  clubId: number;
  name?: string | null;
  currentDivision?: string | number | null;
  bestDivision?: string | number | null;
  reputationTier?: string | number | null;
  points?: number | null;
  record?: { games: number; wins: number; draws: number; losses: number; winRatePct?: number | null } | null;
  goals?: { for: number; against: number; avgFor?: number | null; avgAgainst?: number | null } | null;
  promotions?: number | null;
  relegations?: number | null;
  recent?: {
    matchesAnalyzed?: number | null;
    results?: Array<"W" | "D" | "L"> | null;
    avgGoalsFor?: number | null;
    avgGoalsAgainst?: number | null;
    lastMatchPlayers?: number | null;
    avgPlayersLast5?: number | null;
    lastPlayedAt?: string | null;
  } | null;
  members?: { count?: number | null; avgOverall?: number | null } | null;
  headToHead?: {
    games: number;
    wins: number;
    draws: number;
    losses: number;
    goalsFor?: number | null;
    goalsAgainst?: number | null;
    lastPlayedAt?: string | null;
  } | null;
  warnings?: string[] | null;
}

export interface RegistrationGoal {
  id?: number;
  order?: number;
  scorerPlayerEntityId: number;
  scorerName?: string | null;
  assistPlayerEntityId?: number | null;
  assistName?: string | null;
  preAssistPlayerEntityId?: number | null;
  preAssistName?: string | null;
}

export interface GoalRegistration {
  id: number;
  clubId: number;
  opponentClubId: number;
  opponentName: string;
  notes?: string | null;
  createdAt: string;
  status: RegistrationStatus;
  matchId: number | null;
  linkedAt?: string | null;
  reviewNote?: string | null;
  goals: RegistrationGoal[];
  goalsCount?: number;
  startedAt?: string | null;
  /** Quando o usuário finalizou a partida (Pending + finishedAt = aguardando a partida aparecer). */
  finishedAt?: string | null;
  /** Partida real que parece ser esta (NeedsReview). */
  suggestedMatch?: SuggestedMatch | null;
}

export interface SuggestedMatch {
  matchId: number;
  playedAt: string;
  opponentClubId: number;
  opponentName: string;
  ourGoals: number;
  theirGoals: number;
  /** Os gols registrados batem com o placar da partida. */
  goalsMatch: boolean;
}

/** Gol em montagem / a enviar: ids + nomes (para exibir sem depender do elenco já carregado). */
export interface GoalLine {
  scorerPlayerEntityId: number;
  scorerName: string;
  assistPlayerEntityId: number | null;
  assistName: string | null;
  preAssistPlayerEntityId: number | null;
  preAssistName: string | null;
}

/** Corpo dos endpoints por gol (POST/PUT /api/goal-registrations/{id}/goals[/{goalId}]). */
export interface GoalBody {
  scorerPlayerEntityId: number;
  assistPlayerEntityId: number | null;
  preAssistPlayerEntityId: number | null;
}

export interface GoalRegistrationRequest {
  clubId: number;
  opponentClubId: number;
  opponentName: string;
  notes?: string | null;
  goals?: GoalBody[];
}

/** Gol exibido na tela de pontuação, já com o estado de sincronização (otimista). */
export interface DisplayGoal extends RegistrationGoal {
  /** Chave estável da linha (id real ou id temporário negativo enquanto o POST não volta). */
  key: number;
  /** Ainda não confirmado pelo servidor. */
  pending: boolean;
  /** Mensagem quando o envio falhou e aguarda "tentar de novo". */
  failed?: string;
}
