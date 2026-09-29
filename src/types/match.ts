// src/types/match.ts — DTOs e tipos de filtro da lista de partidas (Home)

export interface ClubDetailsDto {
  name?: string | null;
  clubId?: number | null;
  regionId?: number | null;
  teamId?: number | null;
  stadName?: string | null;
  kitId?: string | null;
  customKitId?: string | null;
  customAwayKitId?: string | null;
  customThirdKitId?: string | null;
  customKeeperKitId?: string | null;
  kitColor1?: string | number | null;
  kitColor2?: string | number | null;
  kitColor3?: string | number | null;
  kitColor4?: string | number | null;
  kitAColor1?: string | number | null;
  kitAColor2?: string | number | null;
  kitAColor3?: string | number | null;
  kitAColor4?: string | number | null;
  kitThrdColor1?: string | number | null;
  kitThrdColor2?: string | number | null;
  kitThrdColor3?: string | number | null;
  kitThrdColor4?: string | number | null;
  dCustomKit?: string | null;
  crestColor?: string | null;
  crestAssetId?: string | null;
  selectedKitType?: string | null;
  team?: string | null;

  // PascalCase aliases
  Name?: string | null;
  StadName?: string | null;
  CrestAssetId?: string | null;
  TeamId?: number | null;

  currentDivision?: number | null;
}

export interface ClubMatchSummaryDto {
  redCards: number;
  hadHatTrick: boolean;
  hatTrickPlayerNames: Array<string | null>;
  goalkeeperPlayerName?: string | null;
  manOfTheMatchPlayerName?: string | null;
  disconnected: boolean;
}

export interface MatchResultDto {
  matchId: number;
  timestamp: string | number | null;

  clubAName: string;
  clubAGoals: number;
  clubARedCards?: number | null;
  clubAPlayerCount?: number | null;
  clubADetails?: ClubDetailsDto | null;
  clubASummary?: ClubMatchSummaryDto | null;

  clubBName: string;
  clubBGoals: number;
  clubBRedCards?: number | null;
  clubBPlayerCount?: number | null;
  clubBDetails?: ClubDetailsDto | null;
  clubBSummary?: ClubMatchSummaryDto | null;

  resultText?: string | null;

  /** Versão do jogo da partida (ex.: 26 = FC26); null quando desconhecida */
  gameVersion?: number | null;
}

export type MatchTypeFilter = "All" | "League" | "Playoff";
export type SortKey = "recent" | "oldest" | "gf" | "ga";
export type RedCardFilter = "all" | "none" | "1plus" | "2plus";

/** Payload paginado (back) */
export interface PagedResult<T> {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasPrevious: boolean;
  hasNext: boolean;
  items: T[];
}
