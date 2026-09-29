import type { MatchTypeFilter } from "../../types/match.ts";

export function Segmented({ value, onChange }: { value: MatchTypeFilter; onChange: (v: MatchTypeFilter) => void }) {
  const opts: { v: MatchTypeFilter; label: string }[] = [
    { v: "All", label: "Todos" },
    { v: "League", label: "Liga" },
    { v: "Playoff", label: "Playoff" },
  ];
  return (
    <div role="group" aria-label="Tipo de partida" className="inline-flex rounded-xl border bg-surface p-1">
      {opts.map((o) => (
        <button
          key={o.v}
          type="button"
          aria-pressed={value === o.v}
          onClick={() => onChange(o.v)}
          className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition ${
            value === o.v ? "bg-accent text-accent-fg" : "text-fg-muted hover:bg-surface-raised"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
