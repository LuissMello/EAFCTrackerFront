import React from "react";
import { clamp01to100 } from "../utils/number.ts";

// UI atômicos compartilhados pelas telas de atributos/estatísticas de jogador.

export const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = "" }) => (
  <div className={`bg-surface rounded-2xl shadow-sm border p-4 ${className}`}>{children}</div>
);

export function ProgressBar({ value, label }: { value: number; label: string }) {
  const pct = clamp01to100(value);
  const color = pct < 40 ? "bg-quality-poor" : pct < 70 ? "bg-quality-decent" : "bg-quality-great";
  return (
    <div className="mb-3" aria-label={`${label}: ${Math.round(pct)}`}>
      <label className="block text-[11px] sm:text-xs font-semibold text-fg-secondary mb-1 tracking-wide">{label}</label>
      <div className="relative flex items-center">
        <div className="w-full bg-surface-sunken/70 rounded-full h-2.5 overflow-hidden">
          <div className={`h-2.5 rounded-full ${color} transition-all duration-500`} style={{ width: `${pct}%` }} />
        </div>
        <span className="ml-2 text-xs sm:text-sm font-semibold text-fg-secondary w-10 text-right">{Math.round(pct)}</span>
      </div>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="mx-auto my-8 max-w-xl rounded-2xl border bg-surface p-6 text-center shadow-sm">
      <div className="text-negative font-semibold">Erro ao carregar</div>
      <p className="mt-2 text-sm text-fg-muted">{message}</p>
      <button
        onClick={onRetry}
        className="mt-4 rounded-xl bg-accent px-4 py-2 text-accent-fg hover:brightness-110 focus:outline-none focus:ring-4 focus:ring-accent/30"
      >
        Tentar novamente
      </button>
    </div>
  );
}
