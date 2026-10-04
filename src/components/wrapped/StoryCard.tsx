import React, { useEffect, useRef, useState } from "react";
import { Card } from "../ui.tsx";
import { usePrefersReducedMotion } from "../../hooks/usePrefersReducedMotion.ts";
import { fmtNum } from "../../utils/analyticsFormat.ts";

/**
 * Número que "sobe" até o valor quando entra na tela. Com `prefers-reduced-motion` (ou sem
 * IntersectionObserver) mostra o valor final direto, sem animação.
 */
export function CountUp({
  value,
  digits = 0,
  durationMs = 900,
  format,
}: {
  value: number;
  digits?: number;
  durationMs?: number;
  format?: (n: number) => string;
}) {
  const reduced = usePrefersReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState<number>(() =>
    reduced || typeof IntersectionObserver === "undefined" || !Number.isFinite(value) ? value : 0
  );
  const shownRef = useRef<number>(value);
  const startedRef = useRef(false);

  useEffect(() => {
    shownRef.current = shown;
  }, [shown]);

  useEffect(() => {
    if (reduced || typeof IntersectionObserver === "undefined" || !Number.isFinite(value)) {
      setShown(value);
      return;
    }
    let raf = 0;
    let cancelled = false;
    let fallback: ReturnType<typeof setTimeout> | undefined;
    const run = () => {
      const from = startedRef.current ? shownRef.current : 0;
      startedRef.current = true;
      const t0 = performance.now();
      const step = (now: number) => {
        if (cancelled) return;
        const p = Math.min(1, (now - t0) / durationMs);
        const eased = 1 - Math.pow(1 - p, 3);
        setShown(from + (value - from) * eased);
        if (p < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
      // aba em segundo plano pausa o rAF: garante o valor final mesmo assim
      fallback = setTimeout(() => {
        if (!cancelled) setShown(value);
      }, durationMs + 250);
    };
    const el = ref.current;
    if (!el) {
      setShown(value);
      return;
    }
    if (startedRef.current) {
      run();
      return () => {
        cancelled = true;
        cancelAnimationFrame(raf);
        if (fallback) clearTimeout(fallback);
      };
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          run();
        }
      },
      { threshold: 0.4 }
    );
    io.observe(el);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      if (fallback) clearTimeout(fallback);
      io.disconnect();
    };
  }, [value, reduced, durationMs]);

  const text = (format ?? ((n: number) => fmtNum(n, digits)))(digits === 0 && !format ? Math.round(shown) : shown);
  // O valor final fica disponível para leitores de tela desde o início
  const finalText = (format ?? ((n: number) => fmtNum(n, digits)))(value);
  return (
    <span ref={ref} className="tabular-nums">
      <span aria-hidden="true">{text}</span>
      <span className="sr-only">{finalText}</span>
    </span>
  );
}

/** Cartão "story": largura total, alinhado ao topo no scroll-snap, com título. */
export function StoryCard({
  id,
  eyebrow,
  title,
  children,
  tone = "default",
}: {
  id: string;
  eyebrow?: string;
  title: string;
  children: React.ReactNode;
  tone?: "default" | "hero";
}) {
  const headingId = `wrapped-${id}`;
  return (
    <section
      aria-labelledby={headingId}
      className="snap-start scroll-mt-[calc(var(--nav-h,4rem)+0.5rem)] min-h-[68dvh] sm:min-h-0 flex"
    >
      <Card
        className={`w-full p-4 sm:p-6 flex flex-col gap-4 ${
          tone === "hero" ? "bg-gradient-to-br from-accent/15 via-surface to-surface border-accent/30" : ""
        }`}
      >
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {eyebrow && (
              <div className="text-[11px] font-semibold uppercase tracking-widest text-accent">{eyebrow}</div>
            )}
            <h2
              id={headingId}
              className="font-display font-bold text-2xl sm:text-3xl uppercase tracking-wide leading-tight text-fg"
            >
              {title}
            </h2>
          </div>
        </header>
        <div className="flex-1 flex flex-col justify-center gap-4">{children}</div>
      </Card>
    </section>
  );
}

/** Bloco de número/legenda para as histórias. */
export function BigStat({
  label,
  value,
  sub,
  tone = "default",
  className = "",
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: "default" | "positive" | "negative" | "gold" | "accent";
  className?: string;
}) {
  const cls =
    tone === "positive"
      ? "text-positive-fg"
      : tone === "negative"
        ? "text-negative-fg"
        : tone === "gold"
          ? "text-gold-fg"
          : tone === "accent"
            ? "text-accent"
            : "text-fg";
  return (
    <div className={`rounded-xl bg-surface-raised border border-border p-3 sm:p-4 min-w-0 ${className}`}>
      <div className="text-[11px] font-semibold uppercase tracking-widest text-fg-subtle">{label}</div>
      <div className={`font-display font-black tabular-nums leading-none mt-1 text-4xl sm:text-5xl ${cls}`}>{value}</div>
      {sub && <div className="mt-1.5 text-xs sm:text-sm text-fg-muted break-words">{sub}</div>}
    </div>
  );
}
