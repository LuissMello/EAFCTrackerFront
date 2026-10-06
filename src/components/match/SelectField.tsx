import React from "react";
import { ChevronDown } from "lucide-react";

/** Filtro compacto: rótulo + select nativo estilizado como "pill", com estado ativo. */
export function SelectField({
  label,
  active = false,
  value,
  onChange,
  children,
  title,
}: {
  label: string;
  active?: boolean;
  value: string | number;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <label
      title={title}
      className={`inline-flex items-center gap-1.5 h-9 pl-3 pr-2 rounded-lg border text-sm cursor-pointer transition focus-within:ring-2 focus-within:ring-accent focus-within:ring-offset-1 focus-within:ring-offset-bg ${
        active ? "border-accent/60 bg-accent/5" : "border-border bg-surface-sunken hover:border-border-strong"
      }`}
    >
      <span
        className={`text-[11px] font-semibold uppercase tracking-wide ${active ? "text-accent" : "text-fg-subtle"}`}
      >
        {label}
      </span>
      <div className="relative flex items-center">
        <select
          value={value}
          onChange={onChange}
          className="appearance-none bg-transparent pr-5 text-sm font-medium text-fg-secondary outline-none cursor-pointer"
        >
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute right-0 w-3.5 h-3.5 text-fg-subtle" />
      </div>
    </label>
  );
}
