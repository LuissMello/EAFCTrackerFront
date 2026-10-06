// Utilidades de arquétipo para as telas de leitura (cartas, noite, estatísticas). Sem nomes hardcoded: tudo vem do backend.
import type { ArchetypeGroup, ArchetypeRef, ArchetypeUsage, AvailableArchetypeItem } from "../types/archetypes.ts";
import { plural } from "./analyticsFormat.ts";

/** Valor de `?arq=` na URL: inteiro positivo ou null ("" = todos). */
export function parseArchetypeParam(raw: string): number | null {
  if (!/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  return n > 0 && Number.isSafeInteger(n) ? n : null;
}

/** Rótulo padrão quando só se conhece o id (ex.: id vindo da URL que não está nas opções). */
export function fallbackArchetypeLabel(id: number): string {
  return `Arquétipo #${id}`;
}

/** "Maestro: 6 jogos (60%)" */
export function usageLine(u: ArchetypeUsage): string {
  const pct = Number.isFinite(u.pct) ? `${Math.round(u.pct)}%` : "";
  return `${u.archetype.label}: ${u.matches} ${plural(u.matches, "jogo", "jogos")}${pct ? ` (${pct})` : ""}`;
}

/** Texto para tooltip/aria com todos os arquétipos usados (um por linha na tooltip nativa). */
export function usagesTitle(usages: ArchetypeUsage[] | null | undefined): string {
  return (usages ?? []).map(usageLine).join("\n");
}

export interface ArchetypeCarrier {
  archetype?: ArchetypeRef | null;
  archetypes?: ArchetypeUsage[] | null;
}

/** Arquétipo principal: o campo `archetype`, ou o primeiro de `archetypes` (já vem ordenado por jogos). */
export function principalOf(p: ArchetypeCarrier): ArchetypeRef | null {
  return p.archetype ?? p.archetypes?.[0]?.archetype ?? null;
}

export interface ArchetypeOption {
  id: number;
  label: string;
  /** Quantos itens (jogadores) têm este arquétipo como principal. */
  count: number;
  /** Grupo de posição do arquétipo (catálogo/inferido); usado para listar só os da posição escolhida. */
  positionGroup?: ArchetypeGroup | null;
}

/** Opções do filtro a partir dos dados da própria tela (arquétipo principal de cada item), ordenadas por rótulo. */
export function archetypeOptionsOf<T extends ArchetypeCarrier>(items: T[]): ArchetypeOption[] {
  const map = new Map<number, ArchetypeOption>();
  for (const it of items) {
    const a = principalOf(it);
    if (!a || a.id <= 0) continue;
    const cur = map.get(a.id);
    if (cur) cur.count++;
    else map.set(a.id, { id: a.id, label: a.label, count: 1, positionGroup: a.positionGroup });
  }
  return Array.from(map.values()).sort((x, y) => x.label.localeCompare(y.label, "pt-BR", { numeric: true }));
}

/** Filtra itens pelo arquétipo principal. `id = null` não filtra. */
export function filterByArchetype<T extends ArchetypeCarrier>(items: T[], id: number | null): T[] {
  if (id === null) return items;
  return items.filter((it) => principalOf(it)?.id === id);
}

/** Junta `options` com o id escolhido na URL (se não estiver nas opções, aparece como "Arquétipo #id"). */
export function withSelected(options: ArchetypeOption[], selected: number | null): ArchetypeOption[] {
  if (selected === null || options.some((o) => o.id === selected)) return options;
  return [...options, { id: selected, label: fallbackArchetypeLabel(selected), count: 0 }];
}


// ---- Filtro combinado Posição → Arquétipo (URL: ?pos=<grupo>&arq=<id>) ----

export const POSITION_FILTER_OPTIONS: { value: ArchetypeGroup; label: string }[] = [
  { value: "GOLEIRO", label: "Goleiro" },
  { value: "DEFESA", label: "Zagueiro" },
  { value: "MEIO", label: "Meia" },
  { value: "ATAQUE", label: "Atacante" },
];

export function parsePositionParam(raw: string | null | undefined): ArchetypeGroup | null {
  return raw === "GOLEIRO" || raw === "DEFESA" || raw === "MEIO" || raw === "ATAQUE" ? raw : null;
}

/** Posição ativa: lista só os arquétipos daquele grupo (sem grupo escolhido: todos). Itens sem grupo conhecido nunca somem. */
export function archetypeOptionsForPosition(all: ArchetypeOption[], group: ArchetypeGroup | null): ArchetypeOption[] {
  if (!group) return all;
  return all.filter((o) => !o.positionGroup || o.positionGroup === group);
}

/** Grupo de posição de um texto de posição da EA (goalkeeper/defender/midfielder/forward, GK, CB…). */
export function positionGroupOfPos(pos: string | null | undefined): ArchetypeGroup | null {
  const p = (pos ?? "").trim().toLowerCase();
  if (!p) return null;
  if (p === "gk" || p.includes("goalkeep") || p.includes("keeper") || p.includes("goleir")) return "GOLEIRO";
  if (p.includes("defen") || p.includes("back") || p.includes("zague") || p.includes("later") || /^(cb|lb|rb|lwb|rwb|sw)$/.test(p)) return "DEFESA";
  if (p.includes("forward") || p.includes("striker") || p.includes("wing") || p.includes("atac") || p.includes("ponta") || p.includes("centroav") || /^(st|cf|lw|rw|lf|rf)$/.test(p)) return "ATAQUE";
  return "MEIO";
}

/** Opções do filtro a partir de `availableArchetypes` do backend (contagem = partidas), ordenadas por rótulo. */
export function optionsFromAvailable(items: AvailableArchetypeItem[] | null | undefined): ArchetypeOption[] {
  return (items ?? [])
    .filter((a) => a.archetype && a.archetype.id > 0)
    .map((a) => ({ id: a.archetype.id, label: a.archetype.label, count: a.matches, positionGroup: a.archetype.positionGroup }))
    .sort((x, y) => x.label.localeCompare(y.label, "pt-BR", { numeric: true }));
}

// ---- Filtro Posição + Arquétipo aplicado no CLIENTE (Estatísticas, Stats Período/Individuais, painel do último dia) ----

export interface PositionArchetypeValue {
  positionGroup: ArchetypeGroup | null;
  archetypeId: number | null;
}

export interface PositionCarrier extends ArchetypeCarrier {
  position?: string | null;
  /** Fatias (arquétipo, grupo de posição) da linha, quando o jogador usou mais de uma combinação. */
  segments?: PositionCarrier[] | null;
}

/** Grupo de posição da linha: o da posição dela (`position`) ou, sem posição, o do arquétipo principal. */
export function rowPositionGroup(p: PositionCarrier): ArchetypeGroup | null {
  return positionGroupOfPos(p.position ?? (p as { pos?: string | null }).pos) ?? principalOf(p)?.positionGroup ?? null;
}

export function matchesPosition(p: PositionCarrier, group: ArchetypeGroup | null): boolean {
  return group === null || rowPositionGroup(p) === group;
}

/** Posição E arquétipo principal. */
export function matchesPositionArchetype(p: PositionCarrier, v: PositionArchetypeValue): boolean {
  if (!matchesPosition(p, v.positionGroup)) return false;
  return v.archetypeId === null || principalOf(p)?.id === v.archetypeId;
}

/** A linha passa no filtro pela linha principal OU por alguma fatia (jogou assim em algum jogo): quem tem fatias não some. */
export function matchesRowOrSegments(p: PositionCarrier, v: PositionArchetypeValue): boolean {
  if (matchesPositionArchetype(p, v)) return true;
  return (p.segments ?? []).some((sg) => matchesPositionArchetype(sg, v));
}

export function filterByPositionArchetype<T extends PositionCarrier>(items: T[], v: PositionArchetypeValue): T[] {
  if (v.positionGroup === null && v.archetypeId === null) return items;
  return items.filter((it) => matchesRowOrSegments(it, v));
}

/** Opções de arquétipo para a posição escolhida: só os que aparecem nas linhas dessa posição (sem posição: todos). */
export function archetypeOptionsForItems<T extends PositionCarrier>(items: T[], group: ArchetypeGroup | null): ArchetypeOption[] {
  // Linhas com fatias contribuem com o arquétipo de cada fatia (da posição escolhida); as demais, com o principal.
  const carriers: PositionCarrier[] = [];
  for (const it of items) {
    const segs = it.segments && it.segments.length > 1 ? it.segments : null;
    if (segs) carriers.push(...segs.filter((sg) => matchesPosition(sg, group)));
    else if (matchesPosition(it, group)) carriers.push(it);
  }
  return archetypeOptionsOf(carriers);
}

/** Rótulo curto do filtro ativo ("Atacante · Finisher"); null sem filtro. */
export function positionArchetypeLabel(v: PositionArchetypeValue, options: ArchetypeOption[]): string | null {
  const pos = v.positionGroup === null ? null : POSITION_FILTER_OPTIONS.find((o) => o.value === v.positionGroup)?.label ?? null;
  const arq = v.archetypeId === null ? null : options.find((o) => o.id === v.archetypeId)?.label ?? fallbackArchetypeLabel(v.archetypeId);
  return [pos, arq].filter(Boolean).join(" · ") || null;
}

/** Sigla pt-BR da posição que a EA devolve ("forward", "ST"…); desconhecida: como veio. */
export function positionShortLabel(pos: string | null | undefined): string {
  const p = (pos ?? "").trim();
  if (!p) return "";
  const map: Record<string, string> = { goalkeeper: "GOL", defender: "ZAG", midfielder: "MEI", forward: "ATA" };
  return map[p.toLowerCase()] ?? p;
}
