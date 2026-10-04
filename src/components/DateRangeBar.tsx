import React from "react";
import { DATE_PRESETS, matchPreset, rangeForPreset, type DateRange } from "../utils/dateRanges.ts";

/**
 * Seletor de período padrão: duas datas + os mesmos presets em todas as telas.
 * O preset ativo é deduzido do intervalo (nada de estado extra), então funciona igual
 * quando o período vem da URL.
 */
export function DateRangeBar({
    from,
    to,
    onChange,
    idPrefix = "range",
    className = "",
    trailing,
}: {
    from: string;
    to: string;
    onChange: (range: DateRange) => void;
    idPrefix?: string;
    className?: string;
    /** Conteúdo extra no fim da barra (ex.: botão de ação) */
    trailing?: React.ReactNode;
}) {
    const active = matchPreset({ from, to });

    const dateInput =
        "h-9 rounded-lg border border-border bg-surface-sunken px-2.5 text-sm text-fg outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/40";

    return (
        <div className={`flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end ${className}`}>
            <div className="flex items-end gap-2">
                <div className="flex flex-col gap-1">
                    <label htmlFor={`${idPrefix}-from`} className="text-xs font-medium uppercase tracking-wide text-fg-muted">
                        De
                    </label>
                    <input
                        id={`${idPrefix}-from`}
                        type="date"
                        value={from}
                        max={to || undefined}
                        onChange={(e) => {
                            const v = e.target.value;
                            if (!v) return;
                            onChange({ from: v, to: v > to ? v : to });
                        }}
                        className={dateInput}
                    />
                </div>
                <div className="flex flex-col gap-1">
                    <label htmlFor={`${idPrefix}-to`} className="text-xs font-medium uppercase tracking-wide text-fg-muted">
                        Até
                    </label>
                    <input
                        id={`${idPrefix}-to`}
                        type="date"
                        value={to}
                        min={from || undefined}
                        onChange={(e) => {
                            const v = e.target.value;
                            if (!v) return;
                            onChange({ from: v < from ? v : from, to: v });
                        }}
                        className={dateInput}
                    />
                </div>
            </div>

            <div role="group" aria-label="Períodos rápidos" className="flex flex-wrap gap-2">
                {DATE_PRESETS.map((p) => {
                    const isActive = active === p.id;
                    return (
                        <button
                            key={p.id}
                            type="button"
                            aria-pressed={isActive}
                            onClick={() => onChange(rangeForPreset(p.id))}
                            className={`h-9 rounded-lg border px-3 text-sm font-medium transition-colors ${
                                isActive
                                    ? "border-accent bg-accent text-accent-fg"
                                    : "border-border-strong bg-surface text-fg-secondary hover:bg-surface-raised"
                            }`}
                        >
                            {p.label}
                        </button>
                    );
                })}
            </div>
            {trailing}
        </div>
    );
}
