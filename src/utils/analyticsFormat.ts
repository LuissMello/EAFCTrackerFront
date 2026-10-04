// Formatação pt-BR compartilhada por Noite de jogo, Laboratório e Retrospectiva.
import { parseTimestamp } from "./date.ts";

export const WEEKDAYS_LONG = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
export const WEEKDAYS_SHORT = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const MONTHS_SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const MONTHS_LONG = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/** "2026-09-30" -> [2026, 9, 30] (sem fuso: é uma data local do clube). */
export function parseYmd(ymd: string | null | undefined): [number, number, number] | null {
  if (!ymd) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

/** 0 = domingo … 6 = sábado, calculado só a partir do calendário (independe do fuso do navegador). */
export function weekdayOfYmd(ymd: string): number | null {
  const p = parseYmd(ymd);
  if (!p) return null;
  return new Date(Date.UTC(p[0], p[1] - 1, p[2], 12)).getUTCDay();
}

/** "30/09/2026" */
export function fmtYmd(ymd: string | null | undefined): string {
  const p = parseYmd(ymd);
  if (!p) return "—";
  return `${String(p[2]).padStart(2, "0")}/${String(p[1]).padStart(2, "0")}/${p[0]}`;
}

/** "30/09" */
export function fmtYmdShort(ymd: string | null | undefined): string {
  const p = parseYmd(ymd);
  if (!p) return "—";
  return `${String(p[2]).padStart(2, "0")}/${String(p[1]).padStart(2, "0")}`;
}

/** "terça, 30/09/2026" */
export function fmtYmdWithWeekday(ymd: string | null | undefined): string {
  if (!ymd) return "—";
  const wd = weekdayOfYmd(ymd);
  return wd === null ? fmtYmd(ymd) : `${WEEKDAYS_LONG[wd]}, ${fmtYmd(ymd)}`;
}

/** "30 de setembro de 2026" */
export function fmtYmdLong(ymd: string | null | undefined): string {
  const p = parseYmd(ymd);
  if (!p) return "—";
  return `${p[2]} de ${MONTHS_LONG[p[1] - 1]} de ${p[0]}`;
}

/** "2026-09" -> "set/26" */
export function fmtMonthShort(month: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})/.exec(month ?? "");
  if (!m) return month ?? "—";
  return `${MONTHS_SHORT[Number(m[2]) - 1] ?? m[2]}/${m[1].slice(2)}`;
}

/** "2026-09" -> "setembro de 2026" */
export function fmtMonthLong(month: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})/.exec(month ?? "");
  if (!m) return month ?? "—";
  return `${MONTHS_LONG[Number(m[2]) - 1] ?? m[2]} de ${m[1]}`;
}

function safeFormatter(options: Intl.DateTimeFormatOptions, timeZone?: string | null): Intl.DateTimeFormat {
  try {
    return new Intl.DateTimeFormat("pt-BR", timeZone ? { ...options, timeZone } : options);
  } catch {
    // fuso inválido/não suportado: cai no fuso do navegador
    return new Intl.DateTimeFormat("pt-BR", options);
  }
}

/** HH:mm de um instante UTC no fuso do clube. */
export function fmtTimeInZone(iso: string | null | undefined, timeZone?: string | null): string {
  const d = parseTimestamp(iso);
  if (!d) return "—";
  return safeFormatter({ hour: "2-digit", minute: "2-digit", hourCycle: "h23" }, timeZone).format(d);
}

/** yyyy-MM-dd de um instante UTC no fuso do clube. */
export function localYmdInZone(iso: string | null | undefined, timeZone?: string | null): string | null {
  const d = parseTimestamp(iso);
  if (!d) return null;
  const parts = safeFormatter({ year: "numeric", month: "2-digit", day: "2-digit" }, timeZone).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const y = get("year");
  const m = get("month");
  const day = get("day");
  return y && m && day ? `${y}-${m}-${day}` : null;
}

/** "2h 35min" / "45min" */
export function fmtDuration(minutes: number | null | undefined): string {
  if (minutes == null || !Number.isFinite(minutes)) return "—";
  const total = Math.max(0, Math.round(minutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}min`;
  return m === 0 ? `${h}h` : `${h}h ${String(m).padStart(2, "0")}min`;
}

/** Horas arredondadas ("18 horas") a partir de minutos. */
export function fmtHoursApprox(minutes: number): string {
  const h = Math.round(minutes / 60);
  return h === 1 ? "1 hora" : `${h} horas`;
}

/** +5 / −3 / 0 (com sinal de menos tipográfico). */
export function fmtSigned(n: number | null | undefined, digits = 0): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const v = Number(n.toFixed(digits));
  if (v === 0) return (0).toFixed(digits).replace(".", ",");
  const s = Math.abs(v).toFixed(digits).replace(".", ",");
  return v > 0 ? `+${s}` : `−${s}`;
}

export function fmtNum(n: number | null | undefined, digits = 0): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function fmtPct(n: number | null | undefined, digits = 0): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${fmtNum(n, digits)}%`;
}

/** "V-E-D" curto: "3V 1E 2D". */
export function fmtVED(w: number, d: number, l: number): string {
  return `${w}V ${d}E ${l}D`;
}

/** Pluralização simples: plural(1, "jogo", "jogos"). */
export function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

export const RESULT_TEXT: Record<"W" | "D" | "L", string> = { W: "Vitória", D: "Empate", L: "Derrota" };
