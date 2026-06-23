import React from "react";
import { FALLBACK_LOGO } from "../config/urls.ts";

/* ============================================================================
   "Broadcast" UI primitives — shared building blocks for the revamp.
   All colors come from the semantic token system (see index.css), so every
   primitive works in light and dark automatically.
   ========================================================================== */

/** Card surface: rounded, hairline border, subtle elevation. */
export function Card({
    className = "",
    children,
    ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={`rounded-2xl border border-border bg-surface shadow-card ${className}`}
            {...rest}
        >
            {children}
        </div>
    );
}

/** Section header with the signature electric-blue accent bar + eyebrow. */
export function SectionHeader({
    eyebrow,
    title,
    right,
    className = "",
}: {
    eyebrow?: React.ReactNode;
    title: React.ReactNode;
    right?: React.ReactNode;
    className?: string;
}) {
    return (
        <div className={`flex items-end justify-between gap-3 ${className}`}>
            <div className="flex items-center gap-2.5 min-w-0">
                <span className="inline-block w-1 self-stretch min-h-[1.5rem] rounded-sm bg-accent flex-shrink-0" />
                <div className="min-w-0">
                    {eyebrow && (
                        <div className="text-[11px] font-semibold uppercase tracking-widest text-fg-subtle">
                            {eyebrow}
                        </div>
                    )}
                    <h2 className="font-display font-bold text-xl sm:text-2xl uppercase tracking-wide leading-none text-fg truncate">
                        {title}
                    </h2>
                </div>
            </div>
            {right && <div className="flex-shrink-0">{right}</div>}
        </div>
    );
}

/** Team crest on a light chip so transparent EA PNGs stay legible on dark. */
export function Crest({
    src,
    alt = "",
    size = 28,
    rounded = "rounded-md",
    className = "",
}: {
    src?: string | null;
    alt?: string;
    size?: number;
    rounded?: string;
    className?: string;
}) {
    return (
        <span
            className={`inline-flex items-center justify-center bg-crest-chip ${rounded} overflow-hidden flex-shrink-0 ${className}`}
            style={{ width: size, height: size }}
        >
            <img
                src={src || FALLBACK_LOGO}
                alt={alt}
                loading="lazy"
                className="w-full h-full object-contain p-0.5"
                onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = FALLBACK_LOGO;
                }}
            />
        </span>
    );
}

/** Theme-aware loading placeholder. */
export function Skeleton({ className = "" }: { className?: string }) {
    return <div className={`animate-pulse bg-surface-sunken rounded ${className}`} />;
}

/* ---- Rating pill (signature motif) -------------------------------------- */

/** Background token for a 0–10 rating, broadcast-style. */
export function ratingTone(value: number): string {
    if (value >= 9) return "bg-quality-great";
    if (value >= 7) return "bg-quality-good";
    if (value >= 6) return "bg-quality-decent";
    return "bg-quality-poor";
}

const RATING_SIZES = {
    sm: "text-xs px-1 py-0.5 min-w-[1.7rem]",
    md: "text-sm px-1.5 py-0.5 min-w-[2rem]",
    lg: "text-base px-2 py-1 min-w-[2.5rem]",
};

/** Sofascore-style colored rating badge. */
export function RatingPill({
    value,
    size = "md",
    className = "",
}: {
    value?: number | null;
    size?: keyof typeof RATING_SIZES;
    className?: string;
}) {
    if (value == null || !Number.isFinite(value)) {
        return <span className="text-fg-subtle">—</span>;
    }
    return (
        <span
            className={`inline-flex items-center justify-center rounded-md font-bold tabular-nums text-white dark:text-slate-950 ${ratingTone(
                value
            )} ${RATING_SIZES[size]} ${className}`}
        >
            {value.toFixed(1)}
        </span>
    );
}

/* ---- Result pill (W/D/L) ------------------------------------------------ */

export type Outcome = "W" | "D" | "L";

const OUTCOME: Record<
    Outcome,
    { soft: string; solid: string; label: string }
> = {
    W: { soft: "bg-positive-soft text-positive-fg", solid: "bg-positive text-white dark:text-slate-950", label: "V" },
    D: { soft: "bg-warning-soft text-warning-fg", solid: "bg-warning text-white dark:text-slate-950", label: "E" },
    L: { soft: "bg-negative-soft text-negative-fg", solid: "bg-negative text-white dark:text-slate-950", label: "D" },
};

/** Small W/D/L badge (Portuguese V/E/D by default). */
export function ResultPill({
    outcome,
    variant = "soft",
    label,
    className = "",
}: {
    outcome: Outcome;
    variant?: "soft" | "solid";
    label?: string;
    className?: string;
}) {
    const o = OUTCOME[outcome];
    return (
        <span
            className={`inline-flex items-center justify-center rounded-md font-bold text-xs w-6 h-6 flex-shrink-0 ${
                variant === "solid" ? o.solid : o.soft
            } ${className}`}
        >
            {label ?? o.label}
        </span>
    );
}
