// src/utils/playerDto.ts — leitores tolerantes (camelCase / PascalCase) de DTOs de jogador.
import { toNum } from "./number.ts";

export function getPassPct(p: any): number {
  const v = p?.passAccuracyPercent ?? p?.PassAccuracyPercent ?? p?.passSuccessPct ?? p?.PassSuccessPct ?? 0;
  return Number.isFinite(v) ? Number(v) : 0;
}

export function getTacklePct(p: any): number {
  const v = p?.tackleSuccessPercent ?? p?.TackleSuccessPercent ?? 0;
  return Number.isFinite(v) ? Number(v) : 0;
}

/** Matches/jogos do jogador no dia (tolerante a nomes). */
export function getMatchesPlayed(p: any): number {
  return toNum(p?.matchesPlayed ?? p?.MatchesPlayed ?? p?.totalMatches ?? p?.TotalMatches ?? 0);
}

/** Número de tackles certos (não tentativas, não %). */
export function getSuccessfulTackles(p: any): number {
  return toNum(p?.totalTacklesMade ?? p?.TotalTacklesMade ?? 0);
}
