import React, { useEffect, useId, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import { GitCompareArrows, Info, X } from "lucide-react";
import type { PlayerCard } from "../../types/playerCards";
import { fmtDateBR } from "../../utils/date.ts";
import { fmtNum, fmtPct, plural } from "../../utils/analyticsFormat.ts";
import { POSITION_GROUP_LABEL, SERIES_COLORS, cardAxes, fmtScore, tierStyle } from "../../utils/playerCards.ts";
import { CardFace } from "./PlayerCard.tsx";
import { FormDots, FormSparkline } from "./FormDots.tsx";
import { RadarWithTable, type RadarSeries } from "./RadarChart.tsx";

/** Posições genéricas da EA já cobertas pelo rótulo do grupo (evita "GOLEIRO · GOALKEEPER"). */
const GENERIC_POSITIONS = new Set(["goalkeeper", "defender", "midfielder", "forward"]);

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function StatItem({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="flex min-w-0 items-baseline justify-between gap-2 border-b border-border py-1.5" title={hint}>
      <dt className="text-sm text-fg-muted">{label}</dt>
      <dd className="text-sm font-semibold tabular-nums text-fg">{value}</dd>
    </div>
  );
}

/**
 * Detalhe da carta em diálogo modal acessível:
 * foco vai para o diálogo e volta ao elemento de origem, Tab fica preso dentro, Esc / clique no fundo fecham,
 * a rolagem da página fica travada enquanto aberto.
 */
export default function CardDetail({
  card,
  crestAssetId,
  clubName,
  onClose,
  onCompare,
}: {
  card: PlayerCard;
  crestAssetId?: string | null;
  clubName?: string | null;
  onClose: () => void;
  onCompare: (card: PlayerCard) => void;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const nodes = Array.from(panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []).filter(
        (el) => !el.hasAttribute("hidden") && el.offsetParent !== null
      );
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement;
      if (!panelRef.current?.contains(active)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      opener?.focus?.();
    };
  }, []);

  const axes = useMemo(() => cardAxes(card), [card]);
  const series = useMemo<RadarSeries[]>(
    () => [{ id: "a", label: card.name, values: axes.map((a) => a.value), cssVar: SERIES_COLORS.a }],
    [card.name, axes]
  );
  const radarLabel = `Radar de ${card.name}: ${axes.map((a) => `${a.name} ${fmtScore(a.value)}`).join(", ")}`;
  const s = card.stats;
  const keeper = card.positionGroup === "GOLEIRO";
  const tier = tierStyle(card.tier);

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/60 px-3 py-4 sm:px-6 sm:py-8"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="mx-auto w-full max-w-4xl rounded-2xl border border-border bg-surface p-4 text-fg shadow-raised sm:p-6"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span aria-hidden="true" className="inline-block h-6 w-1 flex-shrink-0 rounded-sm bg-accent" />
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-widest text-fg-subtle">
                {tier.label} · {POSITION_GROUP_LABEL[card.positionGroup]}
                {card.position && !GENERIC_POSITIONS.has(card.position.trim().toLowerCase()) ? ` · ${card.position}` : ""}
              </div>
              <h2 id={titleId} className="truncate font-display text-xl font-bold uppercase leading-tight tracking-wide text-fg sm:text-2xl">
                {card.name}
              </h2>
            </div>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Fechar detalhe da carta"
            className="btn btn-secondary h-11 w-11 flex-shrink-0 !p-0"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <div className="mt-4 grid gap-5 md:grid-cols-[17.5rem_1fr] md:gap-6">
          <div className="mx-auto w-full max-w-[17.5rem] md:mx-0">
            <div role="img" aria-label={`Carta de ${card.name}: overall ${card.overall}`}>
              <CardFace card={card} crestAssetId={crestAssetId} clubName={clubName} size="lg" />
            </div>
          </div>

          <div className="min-w-0 space-y-5">
            {card.provisional && (
              <div role="note" className="flex items-start gap-2 rounded-xl border border-gold/40 bg-gold-soft px-3 py-2 text-sm text-gold-fg">
                <Info size={16} aria-hidden="true" className="mt-0.5 flex-shrink-0" />
                <p>
                  <strong>Carta provisória:</strong> só {card.matches} {plural(card.matches, "jogo", "jogos")} no recorte. As notas são puxadas
                  para o meio da escala até haver 10 jogos.
                </p>
              </div>
            )}

            <section aria-label="Perfil por eixo">
              <h3 className="mb-2 font-display text-sm font-bold uppercase tracking-widest text-fg-subtle">Perfil</h3>
              <RadarWithTable axes={axes} series={series} ariaLabel={radarLabel} showValues />
            </section>

            <section aria-label="Forma recente">
              <h3 className="mb-2 font-display text-sm font-bold uppercase tracking-widest text-fg-subtle">Forma (últimas notas)</h3>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                <FormDots form={card.form} size="md" />
                <FormSparkline form={card.form} />
              </div>
              <p className="mt-1.5 text-xs text-fg-muted">Da mais recente (esquerda) para a mais antiga.</p>
            </section>

            <section aria-label="Números">
              <h3 className="mb-1 font-display text-sm font-bold uppercase tracking-widest text-fg-subtle">Números</h3>
              <dl className="grid gap-x-6 sm:grid-cols-2">
                <StatItem label="Jogos" value={card.matches} />
                <StatItem label="Minutos" value={fmtNum(card.minutes)} />
                <StatItem label="Gols" value={`${s.goals} (${fmtNum(s.goalsPerMatch, 2)}/jogo)`} />
                <StatItem label="Assistências" value={`${s.assists} (${fmtNum(s.assistsPerMatch, 2)}/jogo)`} />
                <StatItem label="Pré-assistências" value={s.preAssists} />
                <StatItem label="Nota média" value={fmtNum(s.avgRating, 2)} />
                <StatItem label="Precisão de chute" value={fmtPct(s.shotAccuracyPct, 1)} />
                <StatItem label="Precisão de passe" value={fmtPct(s.passAccuracyPct, 1)} />
                <StatItem label="Precisão de desarme" value={fmtPct(s.tackleAccuracyPct, 1)} />
                {s.savePct !== null && s.savePct !== undefined && <StatItem label="Defesas (%)" value={fmtPct(s.savePct, 1)} />}
                {keeper && s.cleanSheets !== null && s.cleanSheets !== undefined && <StatItem label="Jogos sem sofrer gols" value={s.cleanSheets} />}
                <StatItem label="Melhor em campo" value={s.motm} />
                <StatItem label="Cartões vermelhos" value={s.redCards} />
                {card.lastPlayedAt && <StatItem label="Último jogo" value={fmtDateBR(card.lastPlayedAt)} />}
              </dl>
            </section>

            {card.attributes && (card.attributes.overall != null || card.attributes.height) && (
              <section aria-label="Atributos">
                <h3 className="mb-1 font-display text-sm font-bold uppercase tracking-widest text-fg-subtle">Atributos do jogo</h3>
                <dl className="grid gap-x-6 sm:grid-cols-2">
                  {card.attributes.overall != null && <StatItem label="Overall no jogo" value={fmtNum(card.attributes.overall)} hint="Overall do perfil no EA FC (não é a nota da carta)" />}
                  {card.attributes.height && <StatItem label="Altura" value={card.attributes.height} />}
                </dl>
              </section>
            )}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-end gap-2 border-t border-border pt-4">
          <Link to={`/player/${card.playerEntityId}`} className="btn btn-secondary min-h-[44px]">
            Ver perfil
          </Link>
          <button type="button" className="btn btn-primary min-h-[44px]" onClick={() => onCompare(card)}>
            <GitCompareArrows size={16} aria-hidden="true" />
            Comparar com outro jogador
          </button>
        </div>
      </div>
    </div>
  );
}
