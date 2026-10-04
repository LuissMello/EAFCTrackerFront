import React from "react";
import { AlertTriangle, Info } from "lucide-react";
import { Card, Crest, PageHeader, PageShell } from "../ui.tsx";
import { SelectField } from "../match/SelectField.tsx";
import { crestUrl } from "../../config/urls.ts";
import { gameVersionLabel, type GameVersion } from "../../hooks/useGameVersions.tsx";
import type { AnalyticsClubOption } from "../../hooks/useAnalyticsClub.ts";

/** Select do clube ativo — só aparece quando há mais de um clube selecionado no cabeçalho. */
export function ClubSelect({
  options,
  value,
  onChange,
}: {
  options: AnalyticsClubOption[];
  value: number | null;
  onChange: (clubId: number) => void;
}) {
  if (options.length < 2) return null;
  return (
    <SelectField label="Clube" value={value ?? ""} onChange={(e) => onChange(Number(e.target.value))} active>
      {options.map((o) => (
        <option key={o.clubId} value={o.clubId}>
          {o.name}
        </option>
      ))}
    </SelectField>
  );
}

/** Select de versão do jogo (Todas + versões conhecidas). */
export function VersionSelect({
  versions,
  value,
  onChange,
  allLabel = "Todas",
  includeAll = true,
}: {
  versions: GameVersion[];
  value: number | null;
  onChange: (v: number | null) => void;
  allLabel?: string;
  includeAll?: boolean;
}) {
  return (
    <SelectField
      label="Versão"
      title="Filtrar pela versão do jogo"
      active={value !== null}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
    >
      {includeAll && <option value="">{allLabel}</option>}
      {versions.map((v) => (
        <option key={v.version} value={v.version}>
          {gameVersionLabel(v.version)}
          {v.isCurrent ? " (atual)" : ""}
        </option>
      ))}
      {value !== null && !versions.some((v) => v.version === value) && (
        <option value={value}>{gameVersionLabel(value)}</option>
      )}
    </SelectField>
  );
}

/** Erro de carregamento com botão de tentar novamente. */
export function ErrorPanel({
  message,
  onRetry,
  className = "",
}: {
  message: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={`flex flex-wrap items-center gap-3 rounded-xl border border-negative/30 bg-negative-soft p-4 text-sm text-negative-fg ${className}`}
    >
      <AlertTriangle size={18} aria-hidden="true" className="flex-shrink-0" />
      <span className="flex-1 min-w-[12rem]">{message}</span>
      {onRetry && (
        <button type="button" className="btn btn-secondary" onClick={onRetry}>
          Tentar novamente
        </button>
      )}
    </div>
  );
}

/** Estado vazio simples (sem dados / sem clube). */
export function EmptyPanel({
  title,
  message,
  icon = "📭",
  action,
  className = "",
}: {
  title: string;
  message?: React.ReactNode;
  icon?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={`p-8 sm:p-10 text-center text-fg-muted ${className}`}>
      <div className="text-4xl mb-3" aria-hidden="true">
        {icon}
      </div>
      <div className="font-semibold text-fg">{title}</div>
      {message && <div className="text-sm mt-1">{message}</div>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </Card>
  );
}

export function NoClubPanel({ what, title, size = "xl" }: { what: string; title: string; size?: "md" | "lg" | "xl" }) {
  return (
    <PageShell size={size}>
      <PageHeader title={title} />
      <EmptyPanel
        icon="🏟️"
        title="Nenhum clube selecionado"
        message={`Selecione um clube no menu superior para ver ${what}.`}
      />
    </PageShell>
  );
}

/** Aviso informativo discreto (ex.: a noite pedida não existe). */
export function NoticeBar({ children, onDismiss }: { children: React.ReactNode; onDismiss?: () => void }) {
  return (
    <div
      role="status"
      className="flex items-start gap-2 rounded-xl border border-accent/30 bg-accent/10 px-3 py-2 text-sm text-fg-secondary"
    >
      <Info size={16} aria-hidden="true" className="mt-0.5 flex-shrink-0 text-accent" />
      <span className="flex-1">{children}</span>
      {onDismiss && (
        <button type="button" onClick={onDismiss} className="text-xs font-semibold text-accent hover:underline">
          Fechar
        </button>
      )}
    </div>
  );
}

/** Escudo do adversário: teamId (crestAssetId) primeiro, escudo customizado como alternativa. */
export function OpponentCrest({
  crestAssetId,
  customCrestAssetId,
  name,
  size = 28,
  rounded = "rounded-md",
}: {
  crestAssetId?: string | null;
  customCrestAssetId?: string | null;
  name?: string | null;
  size?: number;
  rounded?: string;
}) {
  return (
    <Crest
      src={crestUrl(crestAssetId ?? customCrestAssetId)}
      fallbackSrc={crestAssetId && customCrestAssetId ? crestUrl(customCrestAssetId) : null}
      alt={name ? `Escudo ${name}` : ""}
      size={size}
      rounded={rounded}
    />
  );
}

/** Cartão de número grande (KPI). */
export function KpiTile({
  label,
  value,
  sub,
  tone = "default",
  className = "",
  icon,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: "default" | "positive" | "negative" | "gold";
  className?: string;
  icon?: React.ReactNode;
}) {
  const toneCls =
    tone === "positive"
      ? "text-positive-fg"
      : tone === "negative"
        ? "text-negative-fg"
        : tone === "gold"
          ? "text-gold-fg"
          : "text-fg";
  return (
    <Card className={`p-3 sm:p-4 flex flex-col gap-1 min-w-0 ${className}`}>
      <div className="text-[11px] font-semibold uppercase tracking-widest text-fg-subtle flex items-center gap-1.5">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <div className={`text-2xl sm:text-3xl font-display font-black tabular-nums leading-tight ${toneCls}`}>{value}</div>
      {sub && <div className="text-xs text-fg-muted">{sub}</div>}
    </Card>
  );
}

/** Chip V-E-D com texto (não depende só de cor). */
export function VedChip({ wins, draws, losses, className = "" }: { wins: number; draws: number; losses: number; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] font-bold tabular-nums leading-none ${className}`}
      aria-label={`${wins} vitórias, ${draws} empates, ${losses} derrotas`}
    >
      <span className="text-positive-fg">{wins}V</span>
      <span className="text-warning-fg">{draws}E</span>
      <span className="text-negative-fg">{losses}D</span>
    </span>
  );
}
