// src/utils/date.ts

/**
 * Timestamp robusto: aceita number (epoch ms) ou string ISO.
 * Strings ISO sem fuso (ex.: "2025-10-29T12:34:56") são tratadas como UTC (adiciona "Z").
 * Retorna null para valores vazios/inválidos.
 */
export function parseTimestamp(ts?: string | number | null): Date | null {
  if (ts == null) return null;
  if (typeof ts === "number") {
    const d = new Date(ts);
    return Number.isFinite(d.getTime()) ? d : null;
  }
  const raw = String(ts).trim();
  if (!raw) return null;
  // adiciona Z se vier sem timezone, ex: "2025-10-29T12:34:56"
  const needsZ = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,7})?)?$/.test(raw);
  const d = new Date(needsZ ? `${raw}Z` : raw);
  return Number.isFinite(d.getTime()) ? d : null;
}

/** Formata Date local como YYYY-MM-DD. */
export function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** YYYY-MM-DD de "N dias atrás" (data local). */
export function daysAgoYmd(days: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - days);
  return toYmd(d);
}

/** dd/mm/aaaa (pt-BR) a partir de um timestamp/ISO; "—" quando vazio/inválido. */
export function fmtDateBR(ts?: string | number | null): string {
  const d = parseTimestamp(ts);
  if (!d) return "—";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** "2025-11-04" (ou ISO completo) -> "04/11/2025" — só reorganiza a string, sem fuso. */
export function fmtBRFromISO(iso: string): string {
  if (!iso || iso.length < 10) return iso ?? "";
  const [y, m, d] = iso.substring(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

/** HH:mm (hora local) de um Date. */
export function fmtHM(d: Date): string {
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

const BR_DATE_SHORT = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });

/** dd/mm/aa (pt-BR, ano com 2 dígitos) a partir de um timestamp/ISO; "—" quando vazio/inválido. */
export function fmtDateBRShort(ts?: string | number | null): string {
  const d = parseTimestamp(ts);
  return d ? BR_DATE_SHORT.format(d) : "—";
}
