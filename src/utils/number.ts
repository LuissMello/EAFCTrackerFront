// src/utils/number.ts

/** Converte qualquer valor em número finito; null/undefined/NaN/Infinity viram 0. */
export function toNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Limita a [0, 100]; valores não finitos viram 0. */
export function clamp01to100(x: number): number {
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(100, x));
}

/** Percentual num/den (0 quando den <= 0). */
export const pct = (num: number, den: number): number => (den > 0 ? (num / den) * 100 : 0);

/** "12.3%" (1 casa decimal); valores inválidos viram "0.0%". */
export const fmtPct = (n: number | undefined | null): string =>
  Number.isFinite(Number(n)) ? `${Number(n).toFixed(1)}%` : "0.0%";

/** Número como string; valores inválidos viram "0". */
export const fmtNum = (n: number | undefined | null): string =>
  Number.isFinite(Number(n)) ? String(Number(n)) : "0";
