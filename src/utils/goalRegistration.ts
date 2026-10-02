// src/utils/goalRegistration.ts
import { fmtHM, parseTimestamp } from "./date.ts";

/** "Fulano ← Beltrano ← Sicrano" (assistência e pré-assistência só quando existirem). */
export function goalChain(g: { scorerName?: string | null; assistName?: string | null; preAssistName?: string | null }): string {
  const parts = [g.scorerName || "Jogador", g.assistName, g.preAssistName].filter((p): p is string => !!p);
  return parts.join(" ← ");
}

const DT = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

/** "02/10, 21:35" (hora local) — "—" quando vazio/inválido. */
export function fmtDateTimeBR(ts?: string | number | null): string {
  const d = parseTimestamp(ts);
  return d ? DT.format(d) : "—";
}

/** "21:35" (hora local) — "—" quando vazio/inválido. */
export function fmtTimeBR(ts?: string | number | null): string {
  const d = parseTimestamp(ts);
  return d ? fmtHM(d) : "—";
}

/** "há 5 min" / "há 1 h 12 min" / "agora" desde `ts`. */
export function fmtElapsed(ts?: string | number | null, now: number = Date.now()): string {
  const d = parseTimestamp(ts);
  if (!d) return "";
  const min = Math.max(0, Math.floor((now - d.getTime()) / 60000));
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h >= 48) return `há ${Math.floor(h / 24)} dias`;
  const m = min % 60;
  return m === 0 ? `há ${h} h` : `há ${h} h ${m} min`;
}

export function timesFacedLabel(n?: number | null): string | null {
  if (n === null || n === undefined) return null;
  if (n <= 0) return null;
  return n === 1 ? "Enfrentado 1 vez" : `Enfrentado ${n} vezes`;
}

/** Ordena o elenco: ativos primeiro (mantém a ordem do backend dentro de cada grupo). */
export function sortRoster<T extends { active: boolean }>(players: T[]): T[] {
  return [...players.filter((p) => p.active), ...players.filter((p) => !p.active)];
}

export function goalsLabel(n: number): string {
  return `${n} ${n === 1 ? "gol" : "gols"}`;
}
