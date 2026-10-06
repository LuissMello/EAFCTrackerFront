import React, { useId } from "react";
import { Layers, User } from "lucide-react";

export type CardsView = "player" | "archetype";

/** "Ver por: Arquétipo | Jogador" — padrão: uma carta por jogador+arquétipo; "Jogador" agrupa todos os jogos numa carta. */
export function ViewToggle({ value, onChange }: { value: CardsView; onChange: (v: CardsView) => void }) {
  const labelId = useId();
  const opts: Array<{ v: CardsView; label: string; icon: React.ReactNode; hint: string }> = [
    { v: "archetype", label: "Arquétipo", icon: <Layers size={16} aria-hidden="true" />, hint: "Uma carta por jogador e arquétipo usado, com a nota pelos pesos do arquétipo" },
    { v: "player", label: "Jogador", icon: <User size={16} aria-hidden="true" />, hint: "Uma carta por jogador com todos os jogos juntos (pesos da posição)" },
  ];
  return (
    <div className="inline-flex items-center gap-2">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-fg-subtle" id={labelId}>
        Ver por
      </span>
      <div role="group" aria-labelledby={labelId} className="inline-flex rounded-xl border border-border bg-surface p-1">
        {opts.map((o) => (
          <button
            key={o.v}
            type="button"
            aria-pressed={value === o.v}
            title={o.hint}
            onClick={() => onChange(o.v)}
            className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
              value === o.v ? "bg-accent text-accent-fg" : "text-fg-muted hover:bg-surface-raised"
            }`}
          >
            {o.icon}
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
