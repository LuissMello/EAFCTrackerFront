import React from "react";
import { Star } from "lucide-react";
import { Crest } from "../ui.tsx";
import { crestUrl } from "../../config/urls.ts";
import type { PlayerCard as PlayerCardData } from "../../types/playerCards";
import { cardAriaLabel, cardAxes, cardKey, fmtScore, initialsOf, overallByPositionDiff, overallTitle, positionChipText, tierStyle } from "../../utils/playerCards.ts";
import { plural } from "../../utils/analyticsFormat.ts";
import { FormDots } from "./FormDots.tsx";
import { archetypeShortLabel, archetypeGroupLabel } from "../archetypes/ArchetypeBadge.tsx";
import { ArchetypeIcon } from "../archetypes/ArchetypeIcon.tsx";
import { usagesTitle } from "../../utils/archetypeFilters.ts";

export type CardSlot = "A" | "B" | null;

const SIZES = {
  md: {
    pad: "p-2.5",
    overall: "text-[2.9rem]",
    chip: "text-[10px] px-1.5 py-0.5",
    crest: 24,
    mono: "text-[4.6rem]",
    name: "text-[1.05rem]",
    value: "text-[1.1rem]",
    label: "text-[10px]",
    foot: "text-[11px]",
    arch: "text-[10px] px-1.5 py-[3px]",
    gap: "gap-1.5",
  },
  lg: {
    pad: "p-4",
    overall: "text-[4.6rem]",
    chip: "text-xs px-2 py-0.5",
    crest: 34,
    mono: "text-[7.5rem]",
    name: "text-2xl",
    value: "text-2xl",
    label: "text-xs",
    foot: "text-sm",
    arch: "text-xs px-2 py-[3px]",
    gap: "gap-2.5",
  },
} as const;

/**
 * Selo do arquétipo principal na carta. Usa as cores do tier (tinta + borda), não cores de resultado.
 * Sem arquétipo (id 0) mostra "—" para a altura das cartas ficar uniforme na grade.
 */
function CardArchetype({ card, size }: { card: PlayerCardData; size: keyof typeof SIZES }) {
  const t = tierStyle(card.tier);
  const s = SIZES[size];
  const a = card.archetype ?? null;
  // na visão por arquétipo a carta é de UM arquétipo: sem "+N" nem lista de outros
  // (o comparador devolve cartas de um arquétipo sem segmentKey: scoring "archetype" também indica isso)
  const many = !card.segmentKey && card.scoring !== "archetype" && card.archetypes && card.archetypes.length > 1 ? card.archetypes : null;
  if (!a) {
    return (
      <span
        className={`inline-flex items-center rounded-full border border-dashed font-semibold leading-none ${s.arch}`}
        style={{ borderColor: t.line, color: t.inkMuted }}
        title="Sem arquétipo registrado nas partidas deste recorte"
        aria-label="Sem arquétipo registrado"
      >
        —
      </span>
    );
  }
  const group = archetypeGroupLabel(a.positionGroup);
  const lines = [`${a.label}${group ? ` · ${group}` : ""}`];
  if (many) lines.push(`Usou ${many.length} arquétipos:`, usagesTitle(many));
  const full = lines.join("\n");
  return (
    <span
      className={`inline-flex max-w-full flex-col items-center gap-0.5 rounded-xl border font-semibold leading-none sm:flex-row sm:gap-1 sm:rounded-full ${s.arch}`}
      style={{ borderColor: t.line, color: t.ink, background: "rgba(255,255,255,0.14)" }}
      title={full}
      aria-label={`Arquétipo: ${lines.join(". ")}`}
    >
      <ArchetypeIcon archetype={a} size={size === "lg" ? 16 : 13} />
      <span className="max-w-full truncate">{archetypeShortLabel(a)}</span>
      {many && (
        <span aria-hidden="true" className="flex-shrink-0 rounded-full px-1 font-bold" style={{ background: t.chipBg, color: t.chipFg }}>
          +{many.length - 1}
        </span>
      )}
    </span>
  );
}

/**
 * Face da carta (apenas visual). Não imita nenhuma arte licenciada: gradiente do tier, feixes de luz,
 * iniciais como marca d'água no lugar do retrato. Mesma aparência em tema claro e escuro.
 */
export const CardFace = React.memo(function CardFace({
  card,
  crestAssetId,
  clubName,
  size = "md",
}: {
  card: PlayerCardData;
  crestAssetId?: string | null;
  clubName?: string | null;
  size?: keyof typeof SIZES;
}) {
  const t = tierStyle(card.tier);
  const s = SIZES[size];
  const axes = cardAxes(card);
  const elite = card.tier === "elite";

  return (
    <div
      className={`relative isolate overflow-hidden rounded-2xl ${s.pad} flex flex-col ${s.gap}`}
      style={{
        background: t.background,
        color: t.ink,
        border: `1px solid ${t.line}`,
        boxShadow: `0 8px 22px -8px ${t.glow}, 0 1px 2px rgba(15, 23, 42, 0.25)`,
      }}
    >
      {/* luz: reflexo suave + feixes diagonais (decorativos) */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background: elite
            ? "radial-gradient(120% 70% at 15% 0%, rgba(125,211,252,0.35), transparent 60%), repeating-linear-gradient(115deg, rgba(255,255,255,0.05) 0 6px, transparent 6px 14px)"
            : "radial-gradient(120% 70% at 15% 0%, rgba(255,255,255,0.55), transparent 60%)",
        }}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-6 top-0 -z-10 h-full w-14 -skew-x-[18deg]"
        style={{ background: "linear-gradient(90deg, rgba(255,255,255,0.18), rgba(255,255,255,0))" }}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-1.5 -z-10 rounded-xl"
        style={{ border: `1px solid ${t.line}` }}
      />
      {/* brilho que varre a carta no hover/foco — só com movimento permitido */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 -skew-x-12 bg-gradient-to-r from-transparent via-white/45 to-transparent opacity-0 motion-safe:transition-[transform,opacity] motion-safe:duration-700 motion-safe:group-hover:translate-x-[300%] motion-safe:group-hover:opacity-100 motion-safe:group-focus-visible:translate-x-[300%] motion-safe:group-focus-visible:opacity-100"
      />

      <div className="relative grid grid-cols-[auto_1fr] items-start gap-1">
        <div className="flex flex-col items-start gap-1.5">
          <div className={`font-display font-black leading-[0.85] tabular-nums ${s.overall}`} title={overallTitle(card)}>
            {card.overall}
            {overallByPositionDiff(card) !== null && (
              <span aria-hidden="true" className="ml-0.5 align-top text-[0.28em] font-bold" style={{ color: t.inkMuted }}>
                ◆
              </span>
            )}
          </div>
          <span
            className={`rounded font-display font-bold uppercase tracking-wider leading-none ${s.chip}`}
            style={{ background: t.chipBg, color: t.chipFg }}
            title={card.position}
          >
            {positionChipText(card)}
          </span>
          <Crest src={crestUrl(crestAssetId)} alt={clubName ? `Escudo ${clubName}` : ""} size={s.crest} rounded="rounded-full" />
        </div>
        <div className="relative flex h-full min-w-0 flex-col items-end">
          <span
            className={`font-display font-bold uppercase tracking-widest leading-none ${s.label}`}
            style={{ color: t.inkMuted }}
          >
            {t.label}
          </span>
          {card.provisional && (
            <span
              className={`mt-1 rounded-full border border-dashed px-1.5 py-[2px] font-bold uppercase leading-none tracking-wide ${s.label}`}
              style={{ borderColor: t.ink, color: t.ink }}
              title="Poucos jogos: a nota foi puxada para o meio da escala"
            >
              Provisória
            </span>
          )}
          <span
            aria-hidden="true"
            className={`absolute bottom-0 right-0 select-none font-display font-black leading-[0.8] tracking-tight ${s.mono}`}
            style={{ color: t.watermark }}
          >
            {initialsOf(card.name)}
          </span>
        </div>
      </div>

      <div
        className={`relative truncate text-center font-display font-extrabold uppercase leading-tight tracking-wide ${s.name}`}
        title={card.name}
      >
        {card.name}
      </div>
      {card.archetype !== undefined && (
        <div className="relative flex min-w-0 justify-center">
          <CardArchetype card={card} size={size} />
        </div>
      )}
      <div aria-hidden="true" className="h-px" style={{ background: t.line }} />

      <div className="grid grid-cols-3 gap-y-1">
        {axes.map((a) => (
          <div key={a.key} className="flex items-baseline justify-center gap-1">
            <span className={`font-display font-black tabular-nums leading-none ${s.value}`}>{fmtScore(a.value)}</span>
            <span className={`font-display font-bold tracking-wide leading-none ${s.label}`} style={{ color: t.inkMuted }}>
              {a.short}
            </span>
          </div>
        ))}
      </div>

      <div className="flex justify-center">
        <FormDots form={card.form} size={size === "lg" ? "md" : "sm"} />
      </div>

      <div
        className={`flex items-center justify-between font-semibold leading-none ${s.foot}`}
        style={{ color: t.inkMuted }}
      >
        <span className="inline-flex items-center gap-1" title="Melhor em campo">
          <Star size={size === "lg" ? 15 : 12} aria-hidden="true" fill="currentColor" />
          <span aria-hidden="true" className="tabular-nums">{card.stats.motm}</span>
          <span className="sr-only">{card.stats.motm} vezes melhor em campo</span>
        </span>
        <span className="tabular-nums">
          {card.matches} {plural(card.matches, "jogo", "jogos")}
        </span>
      </div>
    </div>
  );
});

/** Carta clicável (botão real): abre o detalhe ou escolhe jogador A/B no modo comparar. */
export const PlayerCardButton = React.memo(function PlayerCardButton({
  card,
  crestAssetId,
  clubName,
  slot = null,
  compareMode = false,
  onSelect,
}: {
  card: PlayerCardData;
  crestAssetId?: string | null;
  clubName?: string | null;
  slot?: CardSlot;
  compareMode?: boolean;
  onSelect: (card: PlayerCardData) => void;
}) {
  const base = cardAriaLabel(card);
  const label = slot
    ? `${base}, selecionada como jogador ${slot}. Ativar para remover da comparação`
    : compareMode
      ? `${base}. Ativar para escolher na comparação`
      : `${base}. Ativar para ver o detalhe`;
  return (
    <div className="relative" data-card-key={cardKey(card)}>
      <button
        type="button"
        aria-label={label}
        aria-pressed={compareMode ? slot !== null : undefined}
        onClick={() => onSelect(card)}
        className={`group block w-full rounded-2xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg motion-safe:transition-transform motion-safe:duration-200 motion-safe:hover:-translate-y-1 motion-safe:hover:-rotate-1 motion-safe:active:translate-y-0 ${
          slot ? "ring-2 ring-accent ring-offset-2 ring-offset-bg" : ""
        }`}
      >
        <CardFace card={card} crestAssetId={crestAssetId} clubName={clubName} />
      </button>
      {slot && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -left-2 -top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full border-2 border-bg bg-accent font-display text-sm font-black text-accent-fg shadow-raised"
        >
          {slot}
        </span>
      )}
    </div>
  );
});
