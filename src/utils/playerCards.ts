import type { AxisKey, CardSortKey, CardTier, CompareMetric, PlayerCard, PositionGroup } from "../types/playerCards";
import { fmtNum } from "./analyticsFormat.ts";

/* ---------------------------------------------------------------------------
   Eixos (notas 0–99)
   ------------------------------------------------------------------------- */

export const AXIS_META: Record<AxisKey, { short: string; name: string }> = {
  ata: { short: "ATA", name: "Ataque" },
  pas: { short: "PAS", name: "Passe" },
  cri: { short: "CRI", name: "Criação" },
  def: { short: "DEF", name: "Defesa" },
  imp: { short: "IMP", name: "Impacto" },
  reg: { short: "REG", name: "Regularidade" },
  gol: { short: "GOL", name: "Goleiro" },
};

export interface AxisEntry {
  key: AxisKey;
  short: string;
  name: string;
  /** null = sem nota (nunca vira 0/NaN na tela) */
  value: number | null;
}

/** Nota válida (finita) ou null. */
export function scoreOrNull(v: number | null | undefined): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** "82" ou "—" (nota nula/inválida). */
export function fmtScore(v: number | null | undefined): string {
  const n = scoreOrNull(v);
  return n === null ? "—" : String(Math.round(n));
}

export function isKeeper(card: Pick<PlayerCard, "positionGroup" | "axes">): boolean {
  return card.positionGroup === "GOLEIRO" || (card.axes.ata == null && card.axes.gol != null);
}

/** Os seis eixos da carta, na ordem de exibição; goleiros mostram GOL no lugar de ATA. */
export function cardAxes(card: PlayerCard): AxisEntry[] {
  const first: AxisKey = isKeeper(card) ? "gol" : "ata";
  const keys: AxisKey[] = [first, "pas", "cri", "def", "imp", "reg"];
  return keys.map((key) => ({ key, ...AXIS_META[key], value: scoreOrNull(card.axes[key]) }));
}

/** Eixos do radar comparativo: união dos eixos dos dois jogadores (ATA e/ou GOL só quando existirem). */
export function compareAxisKeys(a: PlayerCard, b: PlayerCard): AxisKey[] {
  const hasAta = scoreOrNull(a.axes.ata) !== null || scoreOrNull(b.axes.ata) !== null;
  const hasGol = scoreOrNull(a.axes.gol) !== null || scoreOrNull(b.axes.gol) !== null;
  const keys: AxisKey[] = [];
  if (hasAta || !hasGol) keys.push("ata");
  if (hasGol) keys.push("gol");
  keys.push("pas", "cri", "def", "imp", "reg");
  return keys;
}

export function axisEntries(card: PlayerCard, keys: AxisKey[]): AxisEntry[] {
  return keys.map((key) => ({ key, ...AXIS_META[key], value: scoreOrNull(card.axes[key]) }));
}

/* ---------------------------------------------------------------------------
   Tiers
   ------------------------------------------------------------------------- */

export interface TierStyle {
  label: string;
  /** Fundo da carta (gradiente). */
  background: string;
  /** Texto principal (contraste >= 4.5:1 sobre todos os pontos do gradiente). */
  ink: string;
  /** Texto secundário (rótulos). */
  inkMuted: string;
  /** Borda interna / divisores. */
  line: string;
  /** Chip de posição */
  chipBg: string;
  chipFg: string;
  /** Sombra colorida (brilho) */
  glow: string;
  /** Marca d'água (iniciais) */
  watermark: string;
}

export const TIER_STYLES: Record<CardTier, TierStyle> = {
  bronze: {
    label: "Bronze",
    background: "linear-gradient(155deg, #f1c9a0 0%, #dba070 45%, #c9895a 100%)",
    ink: "#2b1507",
    inkMuted: "#38200e",
    line: "rgba(43, 21, 7, 0.35)",
    chipBg: "rgba(43, 21, 7, 0.88)",
    chipFg: "#fde4cc",
    glow: "rgba(201, 137, 90, 0.45)",
    watermark: "rgba(43, 21, 7, 0.14)",
  },
  prata: {
    label: "Prata",
    background: "linear-gradient(155deg, #f8fafc 0%, #d5dde8 45%, #b4c0d0 100%)",
    ink: "#0f172a",
    inkMuted: "#2b3a52",
    line: "rgba(15, 23, 42, 0.30)",
    chipBg: "rgba(15, 23, 42, 0.88)",
    chipFg: "#e8eef7",
    glow: "rgba(148, 163, 184, 0.5)",
    watermark: "rgba(15, 23, 42, 0.12)",
  },
  ouro: {
    label: "Ouro",
    background: "linear-gradient(155deg, #fff0a8 0%, #f7cf52 45%, #e0a921 100%)",
    ink: "#2a1c02",
    inkMuted: "#4a3304",
    line: "rgba(42, 28, 2, 0.35)",
    chipBg: "rgba(42, 28, 2, 0.9)",
    chipFg: "#ffe9a3",
    glow: "rgba(234, 179, 8, 0.5)",
    watermark: "rgba(42, 28, 2, 0.14)",
  },
  elite: {
    label: "Elite",
    background: "linear-gradient(155deg, #123a8c 0%, #1b1f6b 50%, #3c1a73 100%)",
    ink: "#f0f9ff",
    inkMuted: "#bfd7f5",
    line: "rgba(125, 211, 252, 0.45)",
    chipBg: "rgba(125, 211, 252, 0.95)",
    chipFg: "#06203a",
    glow: "rgba(56, 189, 248, 0.55)",
    watermark: "rgba(186, 230, 253, 0.14)",
  },
};

export function tierStyle(tier: CardTier | string): TierStyle {
  return TIER_STYLES[tier as CardTier] ?? TIER_STYLES.bronze;
}

export const TIER_ORDER: CardTier[] = ["elite", "ouro", "prata", "bronze"];

export const POSITION_GROUP_LABEL: Record<PositionGroup, string> = {
  ATAQUE: "Ataque",
  MEIO: "Meio-campo",
  DEFESA: "Defesa",
  GOLEIRO: "Goleiro",
};

/** Rótulo curto para o chip de posição (a posição vem do EA, ex.: "ST", "Atacante"). */
export function positionChipText(card: Pick<PlayerCard, "position" | "positionGroup">): string {
  const p = (card.position ?? "").trim();
  if (p && p.length <= 5) return p.toUpperCase();
  const g = POSITION_GROUP_LABEL[card.positionGroup];
  return (g ?? p ?? "—").slice(0, 3).toUpperCase();
}

/** Iniciais para a marca d'água (no máximo 2 letras). */
export function initialsOf(name: string): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Identificador estável da carta na grade: `segmentKey` (view por arquétipo) ou o id do jogador. */
export function cardKey(card: Pick<PlayerCard, "playerEntityId" | "segmentKey">): string {
  return card.segmentKey ?? String(card.playerEntityId);
}

/** Texto curto sobre como o overall foi calculado (pesos do arquétipo x da posição); null se o backend não informou. */
export function scoringHint(card: Pick<PlayerCard, "scoring" | "archetype">): string | null {
  if (card.scoring === "archetype") return `Nota calculada com os pesos do arquétipo ${card.archetype?.label ?? ""}`.trim();
  if (card.scoring === "position") return "Nota calculada com os pesos da posição";
  return null;
}

/** Overall pelos pesos da posição quando a carta usa os pesos do arquétipo e o valor difere; senão null. */
export function overallByPositionDiff(card: Pick<PlayerCard, "scoring" | "overall" | "overallByPosition">): number | null {
  return card.scoring === "archetype" && typeof card.overallByPosition === "number" && card.overallByPosition !== card.overall
    ? card.overallByPosition
    : null;
}

/** Tooltip do overall: como foi calculado + "pela posição: N". */
export function overallTitle(card: PlayerCard): string | undefined {
  const hint = scoringHint(card);
  if (!hint) return undefined;
  const alt = overallByPositionDiff(card);
  return alt === null ? hint : `${hint}
Pela posição: ${alt}`;
}

export function cardAriaLabel(card: PlayerCard): string {
  const prov = card.provisional ? ", provisória" : "";
  const arq = card.archetype ? `, arquétipo ${card.archetype.label}${!card.segmentKey && card.scoring !== "archetype" && (card.archetypes?.length ?? 0) > 1 ? ` e mais ${(card.archetypes?.length ?? 1) - 1}` : ""}` : "";
  const scoring = card.scoring === "archetype" ? ", nota pelos pesos do arquétipo" : "";
  return `Carta de ${card.name}, ${tierStyle(card.tier).label.toLowerCase()}, overall ${card.overall}${scoring}${arq}${prov}`;
}

/* ---------------------------------------------------------------------------
   Notas de partida (forma)
   ------------------------------------------------------------------------- */

export interface RatingBand {
  /** Fundo do ponto (cores fixas: o ponto fica sobre uma placa escura em qualquer tier) */
  bg: string;
  /** Descrição em texto, para leitores de tela */
  text: "excelente" | "boa" | "regular" | "fraca";
}

export function ratingBand(r: number): RatingBand {
  if (r >= 9) return { bg: "#60a5fa", text: "excelente" };
  if (r >= 7) return { bg: "#4ade80", text: "boa" };
  if (r >= 6) return { bg: "#fb923c", text: "regular" };
  return { bg: "#f87171", text: "fraca" };
}

export const fmtRating = (r: number | null | undefined, digits = 1): string => fmtNum(r, digits);

/** Notas válidas da forma (descarta null/NaN vindos de payloads incompletos). */
export function validForm(form: number[] | null | undefined): number[] {
  return (form ?? []).filter((n) => typeof n === "number" && Number.isFinite(n));
}

export function formAriaLabel(form: number[]): string {
  const f = validForm(form);
  if (f.length === 0) return "Sem notas recentes";
  return `Últimas ${f.length} ${f.length === 1 ? "nota" : "notas"}, da mais recente: ${f
    .map((n) => `${fmtNum(n, 1)} (${ratingBand(n).text})`)
    .join(", ")}`;
}

/* ---------------------------------------------------------------------------
   Ordenação da grade
   ------------------------------------------------------------------------- */

export const SORT_OPTIONS: Array<{ value: CardSortKey; label: string }> = [
  { value: "overall", label: "Overall" },
  { value: "ata", label: "Ataque" },
  { value: "pas", label: "Passe" },
  { value: "cri", label: "Criação" },
  { value: "def", label: "Defesa" },
  { value: "imp", label: "Impacto" },
  { value: "jogos", label: "Jogos" },
];

export const SORT_VALUES = SORT_OPTIONS.map((o) => o.value) as readonly CardSortKey[];

function sortValue(card: PlayerCard, key: CardSortKey): number | null {
  switch (key) {
    case "overall":
      return scoreOrNull(card.overall);
    case "jogos":
      return scoreOrNull(card.matches);
    default:
      return scoreOrNull(card.axes[key]);
  }
}

/** Maior primeiro; sem nota (ex.: ATA de goleiro) sempre por último; desempate: overall e jogos. */
export function sortCards(cards: PlayerCard[], key: CardSortKey): PlayerCard[] {
  return [...cards].sort((x, y) => {
    const a = sortValue(x, key);
    const b = sortValue(y, key);
    if (a === null && b !== null) return 1;
    if (b === null && a !== null) return -1;
    if (a !== null && b !== null && a !== b) return b - a;
    if (y.overall !== x.overall) return y.overall - x.overall;
    if (y.matches !== x.matches) return y.matches - x.matches;
    return x.name.localeCompare(y.name, "pt-BR") || cardKey(x).localeCompare(cardKey(y), undefined, { numeric: true });
  });
}

/* ---------------------------------------------------------------------------
   Comparador
   ------------------------------------------------------------------------- */

export const SCORE_METRIC_KEYS = ["overall", "ata", "gol", "pas", "cri", "def", "imp", "reg"] as const;

export function isScoreMetric(key: string): boolean {
  return (SCORE_METRIC_KEYS as readonly string[]).includes(key);
}

/** Formata o valor de uma métrica do comparador conforme a chave (notas, %, por jogo, contagens). */
export function formatMetricValue(key: string, v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  if (isScoreMetric(key)) return String(Math.round(v));
  if (/pct$/i.test(key)) return `${fmtNum(v, 1)}%`;
  if (/permatch$/i.test(key)) return fmtNum(v, 2);
  if (key === "avgRating") return fmtNum(v, 2);
  return Number.isInteger(v) ? String(v) : fmtNum(v, 1);
}

export function splitMetrics(metrics: CompareMetric[]): { scores: CompareMetric[]; stats: CompareMetric[] } {
  const scores: CompareMetric[] = [];
  const stats: CompareMetric[] = [];
  for (const m of metrics ?? []) (isScoreMetric(m.key) ? scores : stats).push(m);
  return { scores, stats };
}

/** Cores das duas séries do comparador (tokens do tema; azul x laranja, distinguíveis também por forma/traço). */
export const SERIES_COLORS = {
  a: "--color-accent",
  b: "--color-quality-decent",
} as const;
