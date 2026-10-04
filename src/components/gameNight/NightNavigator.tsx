import React, { useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, Clock3 } from "lucide-react";
import { Card } from "../ui.tsx";
import { VedChip } from "../analytics/Controls.tsx";
import { usePrefersReducedMotion } from "../../hooks/usePrefersReducedMotion.ts";
import type { GameNightSummary } from "../../types/gameNight";
import {
  fmtTimeInZone,
  fmtYmdShort,
  fmtYmdWithWeekday,
  localYmdInZone,
  weekdayOfYmd,
  WEEKDAYS_SHORT,
} from "../../utils/analyticsFormat.ts";

/** Texto "22:15 → 01:40 (+1 dia)" no fuso do clube. */
export function nightTimeRange(startIso: string, endIso: string, timeZone?: string | null): string {
  const start = fmtTimeInZone(startIso, timeZone);
  const end = fmtTimeInZone(endIso, timeZone);
  const d0 = localYmdInZone(startIso, timeZone);
  const d1 = localYmdInZone(endIso, timeZone);
  const crosses = d0 !== null && d1 !== null && d0 !== d1;
  return `${start} → ${end}${crosses ? " (+1 dia)" : ""}`;
}

/**
 * Cabeçalho da noite: botões « », data, "Ir para a mais recente" e faixa rolável de noites.
 * A navegação por teclado e swipe é tratada pela página (mesmos callbacks).
 */
export default function NightNavigator({
  nights,
  currentId,
  timeZone,
  onSelect,
  onLatest,
  isLatest,
}: {
  nights: GameNightSummary[];
  currentId: number;
  timeZone: string | null;
  onSelect: (sessionId: number) => void;
  onLatest: () => void;
  isLatest: boolean;
}) {
  const reduced = usePrefersReducedMotion();
  const idx = nights.findIndex((n) => n.sessionId === currentId);
  const current = idx >= 0 ? nights[idx] : null;
  const prev = idx > 0 ? nights[idx - 1] : null;
  const next = idx >= 0 && idx < nights.length - 1 ? nights[idx + 1] : null;

  const stripRef = useRef<HTMLDivElement>(null);
  const currentRef = useRef<HTMLButtonElement>(null);

  // Mantém a noite atual visível na faixa (rola só a faixa, nunca a página)
  useEffect(() => {
    const strip = stripRef.current;
    const el = currentRef.current;
    if (!strip || !el) return;
    const target = el.offsetLeft - (strip.clientWidth - el.offsetWidth) / 2;
    strip.scrollTo({ left: Math.max(0, target), behavior: reduced ? "auto" : "smooth" });
  }, [currentId, nights.length, reduced]);

  const navBtn =
    "inline-flex items-center justify-center w-11 h-11 sm:w-12 sm:h-12 rounded-xl border border-border-strong bg-surface text-fg-secondary " +
    "hover:bg-surface-sunken hover:text-fg transition-colors flex-shrink-0 " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-bg " +
    "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-surface disabled:hover:text-fg-secondary";

  return (
    <Card className="p-3 sm:p-4">
      <div className="flex items-center gap-2 sm:gap-3">
        <button
          type="button"
          className={navBtn}
          aria-label="Noite anterior"
          title="Noite anterior (←)"
          disabled={!prev}
          onClick={() => prev && onSelect(prev.sessionId)}
        >
          <ChevronLeft size={22} aria-hidden="true" />
        </button>

        <div className="flex-1 min-w-0 text-center">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-fg-subtle">
            Noite de jogo{idx >= 0 ? ` · ${idx + 1} de ${nights.length}` : ""}
          </div>
          <h2
            aria-live="polite"
            className="font-display font-bold text-xl sm:text-3xl uppercase tracking-wide leading-tight text-fg"
          >
            {current ? fmtYmdWithWeekday(current.date) : "—"}
          </h2>
          {current && (
            <div className="mt-0.5 inline-flex items-center gap-1 text-xs text-fg-muted tabular-nums">
              <Clock3 size={12} aria-hidden="true" />
              {nightTimeRange(current.startedAtUtc, current.endedAtUtc, timeZone)}
            </div>
          )}
        </div>

        <button
          type="button"
          className={navBtn}
          aria-label="Próxima noite"
          title="Próxima noite (→)"
          disabled={!next}
          onClick={() => next && onSelect(next.sessionId)}
        >
          <ChevronRight size={22} aria-hidden="true" />
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <button type="button" className="btn btn-secondary" onClick={onLatest} disabled={isLatest}>
          Ir para a mais recente
        </button>
        <span className="text-xs text-fg-subtle hidden sm:inline">Dica: use as setas ← → do teclado</span>
        <span className="text-xs text-fg-subtle sm:hidden">Dica: deslize para os lados</span>
      </div>

      {/* Faixa de noites (data + V-E-D) */}
      <div
        ref={stripRef}
        data-no-swipe
        className="mt-3 -mx-1 px-1 flex gap-2 overflow-x-auto pb-2 scroll-touch-x"
        role="group"
        aria-label="Ir para uma noite"
      >
        {nights.map((n) => {
          const active = n.sessionId === currentId;
          const wd = weekdayOfYmd(n.date);
          return (
            <button
              key={n.sessionId}
              ref={active ? currentRef : undefined}
              type="button"
              onClick={() => onSelect(n.sessionId)}
              aria-current={active ? "true" : undefined}
              aria-label={`Noite de ${fmtYmdWithWeekday(n.date)}: ${n.wins} vitórias, ${n.draws} empates, ${n.losses} derrotas`}
              className={`flex-shrink-0 flex flex-col items-center gap-0.5 rounded-lg border px-2.5 py-1.5 min-w-[4.25rem] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                active
                  ? "border-accent bg-accent/10 text-fg"
                  : "border-border bg-surface-sunken text-fg-secondary hover:border-border-strong"
              }`}
            >
              <span className="text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">
                {wd !== null ? WEEKDAYS_SHORT[wd] : ""}
              </span>
              <span className="text-sm font-bold tabular-nums">{fmtYmdShort(n.date)}</span>
              <VedChip wins={n.wins} draws={n.draws} losses={n.losses} />
            </button>
          );
        })}
      </div>
    </Card>
  );
}
