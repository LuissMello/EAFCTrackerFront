import React from "react";
import { Card } from "../ui.tsx";
import { SelectField } from "../match/SelectField.tsx";
import { VersionSelect } from "../analytics/Controls.tsx";
import type { GameVersion } from "../../hooks/useGameVersions.tsx";
import type { LabFilters } from "../../types/lab";

export type LabPreset = "all" | "30" | "90" | "version" | "custom";

const PRESETS: Array<{ id: Exclude<LabPreset, "custom">; label: string }> = [
  { id: "all", label: "Tudo" },
  { id: "30", label: "30 dias" },
  { id: "90", label: "90 dias" },
  { id: "version", label: "Esta versão" },
];

const MIN_OPTIONS = [1, 3, 5, 8, 10, 15, 20];

const dateInput =
  "h-9 rounded-lg border border-border bg-surface-sunken px-2 text-sm text-fg-secondary " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent";

export default function LabFiltersBar({
  filters,
  preset,
  versions,
  currentVersion,
  onPreset,
  onCustomDate,
  onVersion,
  onMinMatches,
}: {
  filters: LabFilters;
  preset: LabPreset;
  versions: GameVersion[];
  currentVersion: number | null;
  onPreset: (p: Exclude<LabPreset, "custom">) => void;
  onCustomDate: (key: "from" | "to", value: string) => void;
  onVersion: (v: number | null) => void;
  onMinMatches: (n: number) => void;
}) {
  const invalidRange = !!filters.from && !!filters.to && filters.from > filters.to;
  return (
    <Card className="p-3 sm:p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Período" className="inline-flex rounded-lg border border-border-strong overflow-hidden">
          {PRESETS.map((p) => {
            const disabled = p.id === "version" && currentVersion === null;
            const active = preset === p.id;
            return (
              <button
                key={p.id}
                type="button"
                disabled={disabled}
                aria-pressed={active}
                title={disabled ? "Nenhuma versão marcada como atual" : undefined}
                onClick={() => onPreset(p.id)}
                className={`px-3 h-9 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent disabled:opacity-40 disabled:cursor-not-allowed ${
                  active ? "bg-accent text-accent-fg" : "bg-surface text-fg-secondary hover:bg-surface-sunken"
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        <VersionSelect versions={versions} value={filters.gameVersion} onChange={onVersion} />

        <SelectField
          label="Mín. jogos"
          title="Mínimo de partidas com o jogador (ou a dupla) para aparecer"
          active={filters.minMatches !== 3}
          value={filters.minMatches}
          onChange={(e) => onMinMatches(Number(e.target.value))}
        >
          {MIN_OPTIONS.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </SelectField>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <label className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-fg-subtle">
          De
          <input
            type="date"
            className={dateInput}
            value={filters.from}
            max={filters.to || undefined}
            onChange={(e) => onCustomDate("from", e.target.value)}
          />
        </label>
        <label className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-fg-subtle">
          Até
          <input
            type="date"
            className={dateInput}
            value={filters.to}
            min={filters.from || undefined}
            onChange={(e) => onCustomDate("to", e.target.value)}
          />
        </label>
        {invalidRange && (
          <span role="alert" className="text-xs text-negative-fg">
            A data inicial é posterior à final.
          </span>
        )}
      </div>
    </Card>
  );
}
