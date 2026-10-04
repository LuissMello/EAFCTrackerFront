import React from "react";
import { GitCompareArrows, LayoutGrid } from "lucide-react";

export type CardsMode = "cartas" | "comparar";

/** Alterna entre a grade de cartas e o comparador (botões de alternância com aria-pressed). */
export function ModeToggle({ value, onChange }: { value: CardsMode; onChange: (m: CardsMode) => void }) {
  const opts: Array<{ v: CardsMode; label: string; icon: React.ReactNode }> = [
    { v: "cartas", label: "Cartas", icon: <LayoutGrid size={16} aria-hidden="true" /> },
    { v: "comparar", label: "Comparar", icon: <GitCompareArrows size={16} aria-hidden="true" /> },
  ];
  return (
    <div role="group" aria-label="Modo de visualização" className="inline-flex rounded-xl border border-border bg-surface p-1">
      {opts.map((o) => (
        <button
          key={o.v}
          type="button"
          aria-pressed={value === o.v}
          onClick={() => onChange(o.v)}
          className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-lg px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
            value === o.v ? "bg-accent text-accent-fg" : "text-fg-muted hover:bg-surface-raised"
          }`}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}
