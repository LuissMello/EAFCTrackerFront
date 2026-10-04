import React from "react";
import { FALLBACK_LOGO, onImgError } from "../config/urls.ts";

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
    titleId,
    as: Heading = "h2",
    wrap = false,
}: {
    eyebrow?: React.ReactNode;
    title: React.ReactNode;
    right?: React.ReactNode;
    className?: string;
    /** id do título (para aria-labelledby) */
    titleId?: string;
    /** Nível do título (padrão h2) */
    as?: "h1" | "h2" | "h3";
    /** Permite quebrar o título em várias linhas (em vez de truncar com reticências) */
    wrap?: boolean;
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
                    <Heading id={titleId} className={`font-display font-bold text-xl sm:text-2xl uppercase tracking-wide text-fg ${wrap ? "leading-tight" : "leading-none truncate"}`}>
                        {title}
                    </Heading>
                </div>
            </div>
            {right && <div className="flex-shrink-0">{right}</div>}
        </div>
    );
}

/* ---- Page scaffolding (shared by every route) --------------------------- */

const SHELL_WIDTHS = {
    /** formulários estreitos (login) */
    sm: "max-w-md",
    /** formulários / telas de registro */
    md: "max-w-3xl",
    lg: "max-w-5xl",
    /** largura padrão das páginas */
    xl: "max-w-6xl",
    /** páginas muito densas (tabelas largas) */
    "2xl": "max-w-7xl",
    /** tabelas com muitas colunas (Estatísticas) */
    full: "max-w-[1600px]",
} as const;

/**
 * Contêiner padrão de página: largura máxima + respiro lateral/vertical.
 * O landmark <main id="conteudo"> vem do App (um só por página); aqui é só layout.
 */
export function PageShell({
    size = "xl",
    className = "",
    children,
    ...rest
}: React.HTMLAttributes<HTMLDivElement> & { size?: keyof typeof SHELL_WIDTHS }) {
    return (
        <div className={`mx-auto w-full ${SHELL_WIDTHS[size]} px-4 py-4 md:px-6 md:py-6 ${className}`} {...rest}>
            {children}
        </div>
    );
}

/** Cabeçalho padrão: eyebrow, <h1>, subtítulo e ações à direita. Todas as páginas têm exatamente um. */
export function PageHeader({
    eyebrow,
    title,
    subtitle,
    actions,
    className = "mb-4",
}: {
    eyebrow?: React.ReactNode;
    title: React.ReactNode;
    subtitle?: React.ReactNode;
    actions?: React.ReactNode;
    className?: string;
}) {
    return (
        <header className={`flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between ${className}`}>
            <div className="min-w-0">
                <SectionHeader as="h1" eyebrow={eyebrow} title={title} wrap />
                {subtitle && <p className="mt-1.5 pl-[14px] text-sm text-fg-muted">{subtitle}</p>}
            </div>
            {actions && <div className="flex flex-wrap items-center gap-2 sm:justify-end sm:flex-shrink-0">{actions}</div>}
        </header>
    );
}

/** Classe padrão de campos de formulário (input/select) no tema Broadcast. */
export const FIELD_CLASS =
    "h-10 w-full rounded-lg border border-border bg-surface-sunken px-3 text-sm text-fg outline-none transition placeholder:text-fg-subtle focus:border-accent focus:ring-2 focus:ring-accent/40 aria-[invalid=true]:border-negative";

/** Campo de formulário: rótulo + controle + dica/erro. */
export function Field({
    label,
    htmlFor,
    hint,
    error,
    className = "",
    children,
}: {
    label: React.ReactNode;
    htmlFor: string;
    hint?: React.ReactNode;
    error?: React.ReactNode;
    className?: string;
    children: React.ReactNode;
}) {
    return (
        <div className={`flex min-w-0 flex-col gap-1 ${className}`}>
            <label htmlFor={htmlFor} className="text-xs font-medium uppercase tracking-wide text-fg-muted">
                {label}
            </label>
            {children}
            {error ? (
                <p role="alert" className="text-xs text-negative-fg">{error}</p>
            ) : hint ? (
                <p className="text-xs text-fg-muted">{hint}</p>
            ) : null}
        </div>
    );
}

/** Estado vazio padrão (ex.: "nenhum clube selecionado"). */
export function EmptyState({
    icon,
    title,
    children,
    className = "",
}: {
    icon?: React.ReactNode;
    title: React.ReactNode;
    children?: React.ReactNode;
    className?: string;
}) {
    return (
        <Card className={`p-8 text-center text-fg-muted ${className}`}>
            {icon && <div className="text-4xl mb-3" aria-hidden="true">{icon}</div>}
            <div className="font-semibold text-fg-secondary">{title}</div>
            {children && <div className="text-sm mt-1">{children}</div>}
        </Card>
    );
}

/** Team crest on a light chip so transparent EA PNGs stay legible on dark. */
export function Crest({
    src,
    alt = "",
    size = 28,
    rounded = "rounded-md",
    className = "",
    fallbackSrc,
}: {
    src?: string | null;
    alt?: string;
    size?: number;
    rounded?: string;
    className?: string;
    /** Imagem alternativa tentada uma vez se `src` falhar, antes do logo genérico. */
    fallbackSrc?: string | null;
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
                    const img = e.currentTarget;
                    if (fallbackSrc && img.dataset.triedFallback !== fallbackSrc && img.getAttribute("src") !== fallbackSrc) {
                        img.dataset.triedFallback = fallbackSrc;
                        img.src = fallbackSrc;
                        return;
                    }
                    onImgError(e);
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
