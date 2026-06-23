// src/pages/Home.tsx
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api from "../services/api.ts";
import { useClub } from "../hooks/useClub.tsx";
import { ChevronDown, Search, RotateCw, X } from "lucide-react";
import { crestUrl, divisionCrestUrl } from "../config/urls.ts";
import { Crest, ResultPill, Outcome } from "../components/ui.tsx";
import LatestDayPanel from "../components/LatestDayPanel.tsx";

/* ======================
   Tipos
====================== */
interface ClubDetailsDto {
  name?: string | null;
  clubId?: number | null;
  regionId?: number | null;
  teamId?: number | null;
  stadName?: string | null;
  kitId?: string | null;
  customKitId?: string | null;
  customAwayKitId?: string | null;
  customThirdKitId?: string | null;
  customKeeperKitId?: string | null;
  kitColor1?: string | number | null;
  kitColor2?: string | number | null;
  kitColor3?: string | number | null;
  kitColor4?: string | number | null;
  kitAColor1?: string | number | null;
  kitAColor2?: string | number | null;
  kitAColor3?: string | number | null;
  kitAColor4?: string | number | null;
  kitThrdColor1?: string | number | null;
  kitThrdColor2?: string | number | null;
  kitThrdColor3?: string | number | null;
  kitThrdColor4?: string | number | null;
  dCustomKit?: string | null;
  crestColor?: string | null;
  crestAssetId?: string | null;
  selectedKitType?: string | null;
  team?: string | null;

  // PascalCase aliases
  Name?: string | null;
  StadName?: string | null;
  CrestAssetId?: string | null;
  TeamId?: number | null;

  currentDivision?: number | null;
}

interface ClubMatchSummaryDto {
  redCards: number;
  hadHatTrick: boolean;
  hatTrickPlayerNames: Array<string | null>;
  goalkeeperPlayerName?: string | null;
  manOfTheMatchPlayerName?: string | null;
  disconnected: boolean;
}

interface MatchResultDto {
  matchId: number;
  timestamp: string | number | null;

  clubAName: string;
  clubAGoals: number;
  clubARedCards?: number | null;
  clubAPlayerCount?: number | null;
  clubADetails?: ClubDetailsDto | null;
  clubASummary?: ClubMatchSummaryDto | null;

  clubBName: string;
  clubBGoals: number;
  clubBRedCards?: number | null;
  clubBPlayerCount?: number | null;
  clubBDetails?: ClubDetailsDto | null;
  clubBSummary?: ClubMatchSummaryDto | null;

  resultText?: string | null;
}

type MatchTypeFilter = "All" | "League" | "Playoff";
type SortKey = "recent" | "oldest" | "gf" | "ga";
type RedCardFilter = "all" | "none" | "1plus" | "2plus";

/** Payload paginado (back) */
interface PagedResult<T> {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasPrevious: boolean;
  hasNext: boolean;
  items: T[];
}

/* ======================
   Helpers
====================== */
const fmtDateTime = new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" });
const fmtCompactDate = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" });
const fmtCompactTime = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });

/** 🔒 Timestamp robusto */
function parseTimestamp(ts?: string | number | null): Date | null {
  if (ts == null) return null;
  if (typeof ts === "number") {
    const d = new Date(ts);
    return Number.isFinite(d.getTime()) ? d : null;
  }
  const raw = String(ts).trim();
  if (!raw) return null;
  // adiciona Z se vier sem timezone, ex: "2025-10-29T12:34:56"
  const needsZ = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?$/.test(raw);
  const d = new Date(needsZ ? `${raw}Z` : raw);
  return Number.isFinite(d.getTime()) ? d : null;
}

function formatDateSafe(ts?: string | number | null, fallback = "—"): string {
  const d = parseTimestamp(ts);
  return d ? fmtDateTime.format(d) : fallback;
}

/** Data compacta em duas linhas (dd/mm + hh:mm) para a lista densa. */
function compactWhen(ts?: string | number | null): { date: string; time: string } {
  const d = parseTimestamp(ts);
  if (!d) return { date: "—", time: "" };
  return { date: fmtCompactDate.format(d), time: fmtCompactTime.format(d) };
}

function timeValue(ts?: string | number | null, whenInvalid = -Infinity) {
  const d = parseTimestamp(ts);
  return d ? d.getTime() : whenInvalid;
}

/** Normalização do payload (paged vs array; camelCase vs PascalCase) */
type PagedLike<T> = {
  items?: T[];
  Items?: T[];
  totalCount?: number;
  TotalCount?: number;
  totalPages?: number;
  TotalPages?: number;
  page?: number;
  Page?: number;
  pageSize?: number;
  PageSize?: number;
  hasNext?: boolean;
  HasNext?: boolean;
  hasPrevious?: boolean;
  HasPrevious?: boolean;
};

function coercePaged<T>(data: any): {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
  isPaged: boolean;
} {
  if (Array.isArray(data)) {
    const items = data as T[];
    return {
      items,
      page: 1,
      pageSize: items.length,
      totalCount: items.length,
      totalPages: items.length ? 1 : 0,
      hasNext: false,
      hasPrevious: false,
      isPaged: false,
    };
  }
  const obj = (data ?? {}) as PagedLike<T>;
  const items = (obj.items ?? obj.Items ?? []) as T[];

  const alt = data?.data ?? data?.Data;
  const finalItems = Array.isArray(items) && items.length ? items : Array.isArray(alt) ? (alt as T[]) : [];

  const page = obj.page ?? obj.Page ?? 1;
  const pageSize = obj.pageSize ?? obj.PageSize ?? finalItems.length;
  const totalCount = obj.totalCount ?? obj.TotalCount ?? finalItems.length;
  const totalPages = obj.totalPages ?? obj.TotalPages ?? (finalItems.length ? 1 : 0);
  const hasNext = obj.hasNext ?? obj.HasNext ?? page < totalPages;
  const hasPrevious = obj.hasPrevious ?? obj.HasPrevious ?? page > 1;

  const isPaged = !!(obj.items ?? obj.Items ?? alt);

  return { items: finalItems, page, pageSize, totalCount, totalPages, hasNext, hasPrevious, isPaged };
}

/* ======================
   UI
====================== */
function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-surface-sunken rounded ${className}`} />;
}

function Badge({
  color = "gray",
  children,
}: {
  color?: "gray" | "green" | "red" | "amber";
  children: React.ReactNode;
}) {
  const palette: Record<string, string> = {
    gray: "bg-surface-raised border-border text-fg-muted",
    green: "bg-positive-soft border-positive/40 text-positive-fg",
    red: "bg-negative-soft border-negative/40 text-negative-fg",
    amber: "bg-warning-soft border-warning/40 text-warning-fg",
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] ${palette[color]}`}>
      {children}
    </span>
  );
}

function RecordBar({ wins, draws, losses }: { wins: number; draws: number; losses: number }) {
  const total = wins + draws + losses || 1;
  return (
    <div className="flex flex-col gap-1 min-w-[140px]">
      <div className="flex h-2 rounded-full overflow-hidden">
        <div style={{ width: `${(wins / total) * 100}%` }} className="bg-positive" />
        <div style={{ width: `${(draws / total) * 100}%` }} className="bg-warning" />
        <div style={{ width: `${(losses / total) * 100}%` }} className="bg-negative" />
      </div>
      <div className="flex gap-3 text-[11px] tabular-nums">
        <span className="text-positive font-semibold">V {wins}</span>
        <span className="text-warning font-semibold">E {draws}</span>
        <span className="text-negative font-semibold">D {losses}</span>
      </div>
    </div>
  );
}

/** Filtro compacto: rótulo + select nativo estilizado como "pill", com estado ativo. */
function SelectField({
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
      className={`inline-flex items-center gap-1.5 h-9 pl-3 pr-2 rounded-lg border text-sm cursor-pointer transition ${
        active
          ? "border-accent/60 bg-accent/5"
          : "border-border bg-surface-sunken hover:border-border-strong"
      }`}
    >
      <span
        className={`text-[11px] font-semibold uppercase tracking-wide ${
          active ? "text-accent" : "text-fg-subtle"
        }`}
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

function Segmented({ value, onChange }: { value: MatchTypeFilter; onChange: (v: MatchTypeFilter) => void }) {
  const opts: { v: MatchTypeFilter; label: string }[] = [
    { v: "All", label: "Todos" },
    { v: "League", label: "Liga" },
    { v: "Playoff", label: "Playoff" },
  ];
  return (
    <div role="tablist" aria-label="Tipo de partida" className="inline-flex rounded-xl border bg-surface p-1">
      {opts.map((o) => (
        <button
          key={o.v}
          role="tab"
          aria-selected={value === o.v}
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

/* ======================
   Filtros/perspectiva
====================== */
function perspectiveForByNameOrTeam(m: MatchResultDto, myClubName?: string | null, myTeamIdNum?: number) {
  if (typeof myTeamIdNum === "number" && Number.isFinite(myTeamIdNum)) {
    if (m.clubADetails?.teamId === myTeamIdNum || m.clubADetails?.TeamId === myTeamIdNum)
      return { myGoals: m.clubAGoals, oppGoals: m.clubBGoals, isMineA: true };
    if (m.clubBDetails?.teamId === myTeamIdNum || m.clubBDetails?.TeamId === myTeamIdNum)
      return { myGoals: m.clubBGoals, oppGoals: m.clubAGoals, isMineA: false };
  }
  const name = (myClubName ?? "").toLowerCase();
  if (name) {
    if ((m.clubAName ?? "").toLowerCase() === name)
      return { myGoals: m.clubAGoals, oppGoals: m.clubBGoals, isMineA: true };
    if ((m.clubBName ?? "").toLowerCase() === name)
      return { myGoals: m.clubBGoals, oppGoals: m.clubAGoals, isMineA: false };
  }
  return { myGoals: m.clubAGoals, oppGoals: m.clubBGoals, isMineA: true };
}

function perspectiveForSelected(
  m: MatchResultDto,
  selectedClubIds: number[],
  fallbackClubName?: string | null,
  fallbackTeamId?: number
) {
  const aId = m.clubADetails?.clubId ?? null;
  const bId = m.clubBDetails?.clubId ?? null;

  if (aId && selectedClubIds.includes(Number(aId))) {
    return { myGoals: m.clubAGoals, oppGoals: m.clubBGoals, isMineA: true };
  }
  if (bId && selectedClubIds.includes(Number(bId))) {
    return { myGoals: m.clubBGoals, oppGoals: m.clubAGoals, isMineA: false };
  }

  return perspectiveForByNameOrTeam(m, fallbackClubName, fallbackTeamId);
}

/* ======================
   Card de partida
====================== */
function MatchCard({
  m,
  matchType,
  selectedClubIds,
  fallbackClubName,
  fallbackTeamId,
}: {
  m: MatchResultDto;
  matchType: MatchTypeFilter;
  selectedClubIds: number[];
  fallbackClubName?: string | null;
  fallbackTeamId?: number;
}) {
  const p = perspectiveForSelected(m, selectedClubIds, fallbackClubName, fallbackTeamId);
  const outcome = p.myGoals === p.oppGoals ? "draw" : p.myGoals > p.oppGoals ? "win" : "loss";
  const leftBorder =
    outcome === "win" ? "border-l-positive" : outcome === "loss" ? "border-l-negative" : "border-l-border-strong";
  const pillOutcome: Outcome = outcome === "win" ? "W" : outcome === "loss" ? "L" : "D";

  const aWin = m.clubAGoals > m.clubBGoals;
  const bWin = m.clubBGoals > m.clubAGoals;

  const crestA = m.clubADetails?.team?.toString() ?? null;
  const crestB = m.clubBDetails?.team?.toString() ?? null;
  const divA = m.clubADetails?.currentDivision ?? null;
  const divB = m.clubBDetails?.currentDivision ?? null;
  const when = compactWhen(m.timestamp);

  const stadiumName = m.clubADetails?.stadName ?? m.clubADetails?.StadName ?? null;
  const players = `${m.clubAPlayerCount ?? "-"}v${m.clubBPlayerCount ?? "-"}`;

  return (
    <Link
      to={`/match/${m.matchId}?matchType=${matchType}`}
      className={`block border-l-4 ${leftBorder} transition hover:bg-surface-raised`}
      title="Ver detalhes da partida"
    >
      <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 pt-2.5 pb-1.5">
        {/* Data */}
        <div className="w-11 sm:w-12 shrink-0 leading-tight text-[11px] tabular-nums">
          <div className="font-medium text-fg-secondary">{when.date}</div>
          <div className="text-fg-subtle">{when.time}</div>
        </div>

        {/* Confronto (lado a lado) */}
        <div className="flex-1 min-w-0 flex items-center gap-2 sm:gap-3">
          <div className="flex-1 min-w-0 flex items-center justify-end gap-2">
            <div className="min-w-0 flex flex-col items-end leading-tight">
              <span
                className={`truncate max-w-full text-sm ${aWin ? "font-bold text-fg" : "text-fg-secondary"}`}
                title={m.clubAName}
              >
                {m.clubAName}
              </span>
              {divA != null && <span className="text-[10px] text-fg-subtle">Divisão {divA}</span>}
            </div>
            <Crest src={crestUrl(crestA)} size={24} rounded="rounded-md" />
          </div>

          <div className="shrink-0 flex items-center gap-1.5 font-display font-bold text-xl sm:text-2xl tabular-nums tracking-tight leading-none">
            <span className={aWin ? "text-fg" : "text-fg-muted"}>{m.clubAGoals}</span>
            <span className="text-fg-subtle text-base">–</span>
            <span className={bWin ? "text-fg" : "text-fg-muted"}>{m.clubBGoals}</span>
          </div>

          <div className="flex-1 min-w-0 flex items-center gap-2">
            <Crest src={crestUrl(crestB)} size={24} rounded="rounded-md" />
            <div className="min-w-0 flex flex-col items-start leading-tight">
              <span
                className={`truncate max-w-full text-sm ${bWin ? "font-bold text-fg" : "text-fg-secondary"}`}
                title={m.clubBName}
              >
                {m.clubBName}
              </span>
              {divB != null && <span className="text-[10px] text-fg-subtle">Divisão {divB}</span>}
            </div>
          </div>
        </div>

        {/* Resultado (perspectiva do clube selecionado) */}
        <ResultPill outcome={pillOutcome} variant="soft" className="shrink-0" />
      </div>

      {/* Contexto: jogadores + estádio, centralizado sob o placar (espelha as colunas da linha) */}
      <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 pb-2.5">
        <div className="w-11 sm:w-12 shrink-0" aria-hidden />
        <div className="flex-1 min-w-0 flex justify-center">
          <span className="inline-flex items-center gap-1.5 max-w-full text-[11px] text-fg-muted whitespace-nowrap">
            <span className="tabular-nums font-semibold text-fg-secondary">{players}</span>
            {stadiumName && (
              <>
                <span className="text-fg-subtle">·</span>
                <span className="truncate">{stadiumName}</span>
              </>
            )}
          </span>
        </div>
        <div className="w-6 shrink-0" aria-hidden />
      </div>
    </Link>
  );
}

/* ======================
   Placar em destaque (último resultado) — elemento "broadcast"
====================== */
function ScoreboardHero({
  m,
  matchType,
  selectedClubIds,
  fallbackClubName,
  fallbackTeamId,
}: {
  m: MatchResultDto;
  matchType: MatchTypeFilter;
  selectedClubIds: number[];
  fallbackClubName?: string | null;
  fallbackTeamId?: number;
}) {
  const p = perspectiveForSelected(m, selectedClubIds, fallbackClubName, fallbackTeamId);
  const outcome = p.myGoals === p.oppGoals ? "draw" : p.myGoals > p.oppGoals ? "win" : "loss";

  const crestA = m.clubADetails?.team?.toString() ?? null;
  const crestB = m.clubBDetails?.team?.toString() ?? null;
  const divA = m.clubADetails?.currentDivision ?? null;
  const divB = m.clubBDetails?.currentDivision ?? null;
  const stadiumName =
    m.clubADetails?.stadName ?? m.clubADetails?.StadName ?? m.clubADetails?.name ?? m.clubADetails?.Name ?? null;

  const accentBar = outcome === "win" ? "bg-positive" : outcome === "loss" ? "bg-negative" : "bg-warning";
  const tag =
    outcome === "win"
      ? "bg-positive-soft text-positive-fg"
      : outcome === "loss"
      ? "bg-negative-soft text-negative-fg"
      : "bg-warning-soft text-warning-fg";
  const tagLabel = outcome === "win" ? "Vitória" : outcome === "loss" ? "Derrota" : "Empate";

  const scoreColor = (mine: boolean) =>
    mine && outcome === "win" ? "text-positive" : mine && outcome === "loss" ? "text-negative" : "text-slate-100";

  return (
    <Link
      to={`/match/${m.matchId}?matchType=${matchType}`}
      className="group relative block overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-slate-900 to-slate-950 text-slate-100 shadow-raised transition hover:brightness-110"
      title="Ver detalhes da última partida"
    >
      <span className={`absolute inset-x-0 top-0 h-1 ${accentBar}`} />

      <div className="flex items-center justify-between px-4 sm:px-6 pt-4 text-[11px] uppercase tracking-widest text-slate-400">
        <span className="inline-flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-accent" /> Último resultado
        </span>
        <span className="tabular-nums">{formatDateSafe(m.timestamp)}</span>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-6 px-4 sm:px-6 py-5">
        {/* Clube A */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <Crest src={crestUrl(crestA)} size={44} rounded="rounded-xl" />
          <div className="min-w-0">
            <div className="font-display text-base sm:text-2xl uppercase leading-none tracking-wide truncate" title={m.clubAName}>
              {m.clubAName}
            </div>
            {divA && <div className="mt-1 text-[11px] text-slate-400">Divisão {divA}</div>}
          </div>
        </div>

        {/* Placar */}
        <div className="flex flex-col items-center">
          <div className="font-display font-bold text-4xl sm:text-6xl tabular-nums tracking-tight leading-none whitespace-nowrap">
            <span className={scoreColor(p.isMineA)}>{m.clubAGoals}</span>
            <span className="text-slate-600 mx-1.5 sm:mx-2">:</span>
            <span className={scoreColor(!p.isMineA)}>{m.clubBGoals}</span>
          </div>
          <span className={`mt-2 inline-flex items-center px-3 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wide ${tag}`}>
            {tagLabel}
          </span>
        </div>

        {/* Clube B */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 justify-end text-right">
          <div className="min-w-0">
            <div className="font-display text-base sm:text-2xl uppercase leading-none tracking-wide truncate" title={m.clubBName}>
              {m.clubBName}
            </div>
            {divB && <div className="mt-1 text-[11px] text-slate-400">Divisão {divB}</div>}
          </div>
          <Crest src={crestUrl(crestB)} size={44} rounded="rounded-xl" />
        </div>
      </div>

      {stadiumName && (
        <div className="px-4 sm:px-6 pb-4 text-center text-[11px] text-slate-400 truncate">{stadiumName}</div>
      )}
    </Link>
  );
}

/* ======================
   Select de Divisões
====================== */
function DivisionsSelect({
  value,
  onChange,
  className = "",
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const selectedUrl = divisionCrestUrl(value);
  const active = value != null;

  const baseBtn = `inline-flex items-center gap-1.5 h-9 pl-3 pr-2 rounded-lg border text-sm transition ${
    active ? "border-accent/60 bg-accent/5" : "border-border bg-surface-sunken hover:border-border-strong"
  }`;

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={baseBtn}
        title="Filtrar por divisão do adversário"
      >
        <span
          className={`text-[11px] font-semibold uppercase tracking-wide ${
            active ? "text-accent" : "text-fg-subtle"
          }`}
        >
          Div.
        </span>
        {selectedUrl ? (
          <img
            src={selectedUrl}
            alt={value ? `Divisão ${value}` : "Todos"}
            width={24}
            height={24}
            className="h-6 w-6 object-contain"
            loading="lazy"
          />
        ) : (
          <span className="text-sm font-medium text-fg-secondary">Todos</span>
        )}
        <ChevronDown className="w-3.5 h-3.5 text-fg-subtle" />
      </button>

      {open && (
        <div role="listbox" className="absolute z-30 mt-1 w-[260px] rounded-lg border bg-surface p-2 shadow-lg">
          {/* Opção: Todos */}
          <button
            role="option"
            aria-selected={!value}
            className={`w-full text-left px-2 py-2 rounded hover:bg-surface-raised ${!value ? "bg-surface-raised" : ""}`}
            onClick={() => {
              onChange(null);
              setOpen(false);
            }}
          >
            Todos
          </button>

          <div className="mt-1 grid grid-cols-3 gap-2">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
              const url = divisionCrestUrl(n);
              return (
                <button
                  key={n}
                  role="option"
                  aria-selected={value === n}
                  className={`flex items-center justify-center rounded border p-2 hover:bg-surface-raised ${
                    value === n ? "ring-2 ring-accent border-accent" : ""
                  }`}
                  onClick={() => {
                    onChange(n);
                    setOpen(false);
                  }}
                  title={`Divisão ${n}`}
                >
                  {url ? (
                    <img
                      src={url}
                      alt={`Divisão ${n}`}
                      width={32}
                      height={32}
                      className="h-8 w-8 object-contain"
                      loading="lazy"
                    />
                  ) : (
                    <span className="text-sm">D{n}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ======================
   Página
====================== */
export default function Home() {
  const { club, selectedClubs } = useClub();

  const [searchParams, setSearchParams] = useSearchParams();

  const initialOppDiv = (() => {
    const v = searchParams.get("oppdiv");
    const n = v ? Number(v) : NaN;
    return Number.isFinite(n) && n >= 1 && n <= 10 ? n : null;
  })();
  const [opponentDivision, setOpponentDivision] = useState<number | null>(initialOppDiv);

  // Seleção múltipla da URL (?clubIds=1,2,3) ou single (contexto/clubId)
  const selectedClubIds: number[] = useMemo(() => {
    const raw = searchParams.get("clubIds");
    if (raw && raw.trim().length) {
      return raw
        .split(",")
        .map((s) => parseInt(s, 10))
        .filter((n) => !Number.isNaN(n));
    }
    const single = searchParams.get("clubId");
    if (single && !Number.isNaN(parseInt(single, 10))) return [parseInt(single, 10)];
    if (club?.clubId) return [club.clubId];
    return [];
  }, [searchParams, club?.clubId]);

  const fallbackClubName = club?.clubName ?? null;
  const fallbackTeamId = (club as any)?.teamId as number | undefined;

  const [results, setResults] = useState<MatchResultDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [matchType, setMatchType] = useState<MatchTypeFilter>((searchParams.get("type") as MatchTypeFilter) || "All");
  const [sortKey, setSortKey] = useState<SortKey>(() => {
    const v = (searchParams.get("sort") || "recent").toLowerCase();
    if (v === "goals" || v === "gf" || v === "goalsfor") return "gf";
    if (v === "ga" || v === "goalsagainst") return "ga";
    if (v === "oldest") return "oldest";
    return "recent";
  });

  const initialRc = (() => {
    const v = searchParams.get("rc");
    if (v === "none") return "none" as RedCardFilter;
    if (v === "1" || v === "1plus") return "1plus" as RedCardFilter;
    if (v === "2" || v === "2plus") return "2plus" as RedCardFilter;
    return "all" as RedCardFilter;
  })();
  const [redFilter, setRedFilter] = useState<RedCardFilter>(initialRc);

  const initialOpp = (() => {
    const v = searchParams.get("opp");
    const n = v ? Number(v) : NaN;
    return Number.isFinite(n) && n >= 2 && n <= 11 ? n : null;
  })();
  const [opponentCount, setOpponentCount] = useState<number | null>(initialOpp);

  /** Paginação server-side */
  const initialPage = Math.max(1, Number(searchParams.get("page") ?? 1) || 1);
  const initialSize = (() => {
    const n = Number(searchParams.get("size") ?? 30) || 30;
    return Math.min(Math.max(n, 10), 200);
  })();
  const [page, setPage] = useState<number>(initialPage);
  const [pageSize, setPageSize] = useState<number>(initialSize);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [hasNext, setHasNext] = useState<boolean>(false);
  const [hasPrev, setHasPrev] = useState<boolean>(false);
  const [isServerPaged, setIsServerPaged] = useState<boolean>(false);

  // Modo multi-clubes usa "mostrar mais"
  const [visible, setVisible] = useState(30);

  const searchRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Persistir filtros na URL (inclui paginação)
  useEffect(() => {
    const rcParam = redFilter === "all" ? undefined : redFilter === "none" ? "none" : redFilter === "1plus" ? "1" : "2";

    const oppParam = opponentCount ? String(opponentCount) : undefined;
    const oppDivParam = opponentDivision ? String(opponentDivision) : undefined;

    const next = new URLSearchParams(searchParams.toString());

    if (search) next.set("q", search);
    else next.delete("q");
    if (matchType !== "All") next.set("type", matchType);
    else next.delete("type");
    if (sortKey !== "recent") next.set("sort", sortKey);
    else next.delete("sort");
    if (rcParam) next.set("rc", rcParam);
    else next.delete("rc");
    if (oppParam) next.set("opp", oppParam);
    else next.delete("opp");
    if (oppDivParam) next.set("oppdiv", oppDivParam);
    else next.delete("oppdiv");

    next.set("page", String(page));
    next.set("size", String(pageSize));

    const prevStr = searchParams.toString();
    const nextStr = next.toString();
    if (nextStr !== prevStr) {
      setSearchParams(next, { replace: true });
    }
  }, [
    search,
    matchType,
    sortKey,
    redFilter,
    opponentCount,
    opponentDivision,
    page,
    pageSize,
    searchParams,
    setSearchParams,
  ]);

  // Reset page quando trocar seleção/filtros que afetam a chamada
  useEffect(() => {
    setPage(1);
  }, [selectedClubIds.join(","), matchType, opponentCount]);

  // Carregar resultados
  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();

    (async () => {
      try {
        setLoading(true);
        setError(null);
        setResults([]);

        if (selectedClubIds.length === 0) {
          if (mounted) setLoading(false);
          return;
        }

        const baseParams: any = {};
        if (matchType !== "All") baseParams.matchType = matchType;
        if (opponentCount) baseParams.opponentCount = opponentCount;

        if (selectedClubIds.length === 1) {
          // Paginação no servidor
          const id = selectedClubIds[0];
          const params = {
            ...baseParams,
            // aliases comuns
            page,
            pageNumber: page,
            pageIndex: page - 1, // back 0-based?
            size: pageSize,
            pageSize,
            limit: pageSize,
          };

          const { data } = await api.get<PagedResult<MatchResultDto> | MatchResultDto[]>(
            `/api/clubs/${id}/matches/results`,
            { params, signal: (controller as any).signal }
          );

          if (!mounted) return;

          const norm = coercePaged<MatchResultDto>(data);

          setIsServerPaged(norm.isPaged);
          setResults(norm.items);
          setTotalCount(norm.totalCount);
          setTotalPages(norm.totalPages);
          setHasNext(norm.hasNext);
          setHasPrev(norm.hasPrevious);

          // se vier array puro
          if (!norm.isPaged) {
            setVisible(Math.max(30, Math.min(norm.items.length, pageSize)));
          }
          return;
        }

        // Múltiplos clubes → uma única chamada server-side paginada
        const params = {
          ...baseParams,
          clubIds: selectedClubIds,
          page,
          pageSize,
        };
        const { data } = await api.get<PagedResult<MatchResultDto>>(
          `/api/clubs/matches/results`,
          {
            params,
            paramsSerializer: (p) => {
              const sp = new URLSearchParams();
              for (const [key, val] of Object.entries(p)) {
                if (Array.isArray(val)) {
                  (val as unknown[]).forEach((v) => sp.append(key, String(v)));
                } else if (val !== undefined && val !== null) {
                  sp.append(key, String(val));
                }
              }
              return sp.toString();
            },
            signal: (controller as any).signal,
          }
        );
        if (!mounted) return;
        const norm = coercePaged<MatchResultDto>(data);
        setIsServerPaged(norm.isPaged);
        setResults(norm.items);
        setTotalCount(norm.totalCount);
        setTotalPages(norm.totalPages);
        setHasNext(norm.hasNext);
        setHasPrev(norm.hasPrevious);
      } catch (err: any) {
        if (mounted) setError(err?.message ?? "Erro ao carregar resultados");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
      controller.abort();
    };
  }, [selectedClubIds.join(","), matchType, opponentCount, page, pageSize]);

  // Filtros/ordenação em memória (sobre itens carregados)
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();

    const byText = (m: MatchResultDto) => (term ? `${m.clubAName} ${m.clubBName}`.toLowerCase().includes(term) : true);

    const byReds = (m: MatchResultDto) => {
      const redsA = m.clubASummary?.redCards ?? m.clubARedCards ?? 0;
      const redsB = m.clubBSummary?.redCards ?? m.clubBRedCards ?? 0;
      const reds = redsA + redsB;
      if (redFilter === "none") return reds === 0;
      if (redFilter === "1plus") return reds >= 1;
      if (redFilter === "2plus") return reds >= 2;
      return true;
    };

    const byOppCount = (m: MatchResultDto) => {
      if (!opponentCount) return true;
      const p = perspectiveForSelected(m, selectedClubIds, fallbackClubName, fallbackTeamId);
      const opp = p.isMineA ? m.clubBPlayerCount ?? null : m.clubAPlayerCount ?? null;
      return opp === opponentCount;
    };

    const byOppDivision = (m: MatchResultDto) => {
      if (!opponentDivision) return true;
      const p = perspectiveForSelected(m, selectedClubIds, fallbackClubName, fallbackTeamId);
      const oppDiv = p.isMineA ? m.clubBDetails?.currentDivision : m.clubADetails?.currentDivision;
      return oppDiv === opponentDivision;
    };

    const base = results.filter((m) => byText(m) && byReds(m) && byOppCount(m) && byOppDivision(m));

    const sorted = [...base].sort((a, b) => {
      if (sortKey === "recent") {
        const ta = timeValue(a.timestamp, -Infinity);
        const tb = timeValue(b.timestamp, -Infinity);
        return tb - ta;
      }
      if (sortKey === "oldest") {
        const ta = timeValue(a.timestamp, +Infinity);
        const tb = timeValue(b.timestamp, +Infinity);
        return ta - tb;
      }

      if (sortKey === "gf" || sortKey === "ga") {
        const pa = perspectiveForSelected(a, selectedClubIds, fallbackClubName, fallbackTeamId);
        const pb = perspectiveForSelected(b, selectedClubIds, fallbackClubName, fallbackTeamId);
        const va = sortKey === "gf" ? pa.myGoals : pa.oppGoals;
        const vb = sortKey === "gf" ? pb.myGoals : pb.oppGoals;
        if (vb !== va) return vb - va;
        const ta = timeValue(a.timestamp, -Infinity);
        const tb = timeValue(b.timestamp, -Infinity);
        return tb - ta;
      }

      const ta = timeValue(a.timestamp, -Infinity);
      const tb = timeValue(b.timestamp, -Infinity);
      return tb - ta;
    });

    return sorted;
  }, [
    results,
    search,
    sortKey,
    redFilter,
    opponentCount,
    opponentDivision,
    selectedClubIds.join(","),
    fallbackClubName,
    fallbackTeamId,
  ]);

  // Resumo
  const summary = useMemo(() => {
    const s = filtered.reduce(
      (acc, m) => {
        const p = perspectiveForSelected(m, selectedClubIds, fallbackClubName, fallbackTeamId);
        acc.jogos++;
        acc.golsPro += p.myGoals;
        acc.golsContra += p.oppGoals;
        if (p.myGoals > p.oppGoals) acc.v++;
        else if (p.myGoals < p.oppGoals) acc.d++;
        else acc.e++;
        const redsA = m.clubASummary?.redCards ?? m.clubARedCards ?? 0;
        const redsB = m.clubBSummary?.redCards ?? m.clubBRedCards ?? 0;
        acc.cartoes += redsA + redsB;
        return acc;
      },
      { jogos: 0, v: 0, e: 0, d: 0, golsPro: 0, golsContra: 0, cartoes: 0 }
    );
    return { ...s, saldo: s.golsPro - s.golsContra };
  }, [filtered, selectedClubIds.join(","), fallbackClubName, fallbackTeamId]);

  const hasSelection = selectedClubIds.length > 0;
  const hasResults = filtered.length > 0;

  const refresh = useCallback(() => {
    if (hasSelection) {
      const ev = new Event("visibilitychange");
      document.dispatchEvent(ev);
    }
  }, [hasSelection]);

  const headerRight = hasSelection ? (
    selectedClubIds.length > 1 ? (
      <>
        Clubes atuais: <span className="font-medium">{selectedClubIds.map((id) => selectedClubs.find((c) => c.clubId === id)?.clubName || id).join(", ")}</span>
      </>
    ) : (
      <>
        Clube atual: <span className="font-medium">{fallbackClubName || selectedClubIds[0]}</span>
      </>
    )
  ) : (
    <>Selecione clubes no topo para carregar os resultados.</>
  );

  // Paginação server-side
  const goTo = (p: number) => setPage(Math.max(1, Math.min(totalPages || 1, p)));
  const next = () => hasNext && setPage((p) => p + 1);
  const prev = () => hasPrev && setPage((p) => Math.max(1, p - 1));

  const PageControls = () => {
    if (!isServerPaged) return null;
    return (
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-fg-muted">Itens por página:</span>
          <select
            className="border rounded-lg px-2 py-2"
            value={pageSize}
            onChange={(e) => {
              const n = Number(e.target.value);
              setPageSize(Math.min(Math.max(n, 10), 200));
              setPage(1); // reset
            }}
          >
            {[10, 20, 30, 50, 100, 200].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <div className="text-sm text-fg-muted">
          Página <span className="font-semibold">{totalPages ? page : 0}</span> de{" "}
          <span className="font-semibold">{totalPages}</span> — {totalCount} partidas
        </div>
        <div className="flex items-center gap-2">
          <button
            className="px-3 py-2 rounded-lg border bg-surface hover:bg-surface-raised disabled:opacity-50"
            onClick={() => goTo(1)}
            disabled={!hasPrev}
          >
            « Primeira
          </button>
          <button
            className="px-3 py-2 rounded-lg border bg-surface hover:bg-surface-raised disabled:opacity-50"
            onClick={prev}
            disabled={!hasPrev}
          >
            ‹ Anterior
          </button>
          <button
            className="px-3 py-2 rounded-lg border bg-surface hover:bg-surface-raised disabled:opacity-50"
            onClick={next}
            disabled={!hasNext}
          >
            Próxima ›
          </button>
          <button
            className="px-3 py-2 rounded-lg border bg-surface hover:bg-surface-raised disabled:opacity-50"
            onClick={() => goTo(totalPages)}
            disabled={!hasNext}
          >
            Última »
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-4">
        <div className="flex items-stretch gap-3 min-w-0">
          <span className="w-1.5 rounded-sm bg-accent flex-shrink-0" />
          <div className="min-w-0">
            <h1 className="font-display font-bold text-2xl sm:text-3xl uppercase tracking-wide leading-none">
              Resultados das Partidas
            </h1>
            <p className="text-sm text-fg-muted mt-1.5">{headerRight}</p>
          </div>
        </div>

        {hasResults && (
          <div className="flex items-center flex-wrap gap-3">
            <RecordBar wins={summary.v} draws={summary.e} losses={summary.d} />
            <div className="flex items-center flex-wrap gap-2 text-xs">
              <Badge>
                GP: <span className="tabular-nums ml-1">{summary.golsPro}</span>
              </Badge>
              <Badge>
                GC: <span className="tabular-nums ml-1">{summary.golsContra}</span>
              </Badge>
              <Badge color={summary.saldo >= 0 ? "green" : "red"}>
                Saldo: <span className="tabular-nums ml-1">{summary.saldo >= 0 ? "+" : ""}{summary.saldo}</span>
              </Badge>
              {summary.cartoes > 0 && (
                <Badge color="red">
                  🟥 <span className="tabular-nums ml-1">{summary.cartoes}</span>
                </Badge>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Placar em destaque */}
      {hasResults && !loading && (
        <div className="mb-4">
          <ScoreboardHero
            m={filtered[0]}
            matchType={matchType}
            selectedClubIds={selectedClubIds}
            fallbackClubName={fallbackClubName ?? undefined}
            fallbackTeamId={fallbackTeamId}
          />
        </div>
      )}

      {/* Acompanhamento do dia (último dia de /statisticsbydate) */}
      {hasSelection && (
        <div className="mb-4">
          <LatestDayPanel clubIds={selectedClubIds} />
        </div>
      )}

      {/* Toolbar */}
      <div className="sticky top-2 z-20 rounded-xl border border-border bg-surface-raised/95 backdrop-blur px-3 py-3">
        <div className="flex flex-col gap-2.5">
          {/* Linha 1: tipo de partida + busca + atualizar */}
          <div className="flex items-center gap-2.5">
            <Segmented value={matchType} onChange={setMatchType} />

            <div className="relative flex-1 min-w-0">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-subtle" />
              <input
                ref={searchRef}
                id="search"
                type="text"
                placeholder="Buscar clube (atalho: /)"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-9 rounded-lg border border-border bg-surface-sunken pl-9 pr-8 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/40"
              />
              {search && (
                <button
                  aria-label="Limpar busca"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-fg-subtle hover:text-fg-secondary"
                  onClick={() => setSearch("")}
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <button
              className="h-9 inline-flex items-center gap-1.5 px-3 rounded-lg border border-border bg-surface text-sm font-medium text-fg-secondary hover:bg-surface-raised transition shrink-0"
              onClick={refresh}
              title="Recarregar resultados"
            >
              <RotateCw className="w-4 h-4" />
              <span className="hidden sm:inline">Atualizar</span>
            </button>
          </div>

          {/* Linha 2: filtros */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="hidden sm:inline text-[11px] font-semibold uppercase tracking-wide text-fg-subtle mr-0.5">
              Filtros
            </span>

            <SelectField
              label="Verm."
              title="Filtrar por cartões vermelhos"
              active={redFilter !== "all"}
              value={redFilter}
              onChange={(e) => setRedFilter(e.target.value as RedCardFilter)}
            >
              <option value="all">Todos</option>
              <option value="none">Nenhum</option>
              <option value="1plus">1+</option>
              <option value="2plus">2+</option>
            </SelectField>

            <SelectField
              label="Jog. adv."
              title="Filtrar pela quantidade de jogadores do adversário"
              active={!!opponentCount}
              value={opponentCount ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "") setOpponentCount(null);
                else {
                  const n = Number(v);
                  setOpponentCount(n >= 2 && n <= 11 ? n : null);
                }
              }}
            >
              <option value="">Todos</option>
              {Array.from({ length: 10 }, (_, i) => i + 2).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </SelectField>

            <DivisionsSelect value={opponentDivision} onChange={setOpponentDivision} />

            <SelectField
              label="Ordenar"
              title="Ordenar resultados"
              active={sortKey !== "recent"}
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
            >
              <option value="recent">Mais recentes</option>
              <option value="oldest">Mais antigas</option>
              <option value="gf">Mais gols feitos</option>
              <option value="ga">Mais gols recebidos</option>
            </SelectField>

            {(redFilter !== "all" ||
              !!opponentCount ||
              opponentDivision != null ||
              sortKey !== "recent" ||
              search.trim() !== "") && (
              <button
                onClick={() => {
                  setSearch("");
                  setRedFilter("all");
                  setOpponentCount(null);
                  setOpponentDivision(null);
                  setSortKey("recent");
                }}
                className="h-9 inline-flex items-center gap-1 px-2.5 rounded-lg text-xs font-semibold text-accent hover:bg-accent/10 transition"
              >
                <X className="w-3.5 h-3.5" /> Limpar
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Estados */}
      {loading && (
        <div className="mt-4 rounded-2xl border border-border bg-surface shadow-card overflow-hidden divide-y divide-border">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3">
              <Skeleton className="h-7 w-10" />
              <div className="flex-1 flex items-center justify-center gap-3">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-7 w-7 rounded-md" />
                <Skeleton className="h-7 w-12" />
                <Skeleton className="h-7 w-7 rounded-md" />
                <Skeleton className="h-4 w-24" />
              </div>
              <Skeleton className="h-6 w-6 rounded-md" />
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="mt-4 p-3 bg-negative-soft border border-negative/40 text-negative-fg rounded-lg flex items-center justify-between">
          <span>{error}</span>
          <button className="px-3 py-1.5 rounded-lg border bg-surface hover:bg-surface-raised" onClick={refresh}>
            Tentar novamente
          </button>
        </div>
      )}

      {!loading && !error && hasSelection && filtered.length === 0 && (
        <div className="mt-4 p-3 bg-surface-raised border rounded text-fg-secondary">
          Nenhum resultado encontrado.
          <ul className="list-disc ml-5 mt-2 text-sm text-fg-muted">
            <li>Verifique a grafia dos clubes.</li>
            <li>Altere o tipo (Todos/Liga/Playoff).</li>
            <li>Ajuste os filtros de cartões, jogadores ou divisão.</li>
          </ul>
        </div>
      )}

      {!hasSelection && (
        <div className="mt-4 p-3 bg-warning-soft border border-warning/40 rounded-lg text-warning-fg">
          Selecione clubes no menu (botão “Clubes”) para começar.
        </div>
      )}

      {/* Lista */}
      {hasResults && (
        <div className="mt-4 rounded-2xl border border-border bg-surface shadow-card overflow-hidden divide-y divide-border">
          {(isServerPaged ? filtered : filtered.slice(0, visible)).map((m) => (
            <MatchCard
              key={m.matchId}
              m={m}
              matchType={matchType}
              selectedClubIds={selectedClubIds}
              fallbackClubName={fallbackClubName ?? undefined}
              fallbackTeamId={fallbackTeamId}
            />
          ))}
        </div>
      )}

      {/* Paginação */}
      {isServerPaged ? (
        <PageControls />
      ) : (
        filtered.length > 0 &&
        visible < filtered.length && (
          <div className="flex justify-center mt-4">
            <button
              className="px-4 py-2 rounded-lg border bg-surface hover:bg-surface-raised"
              onClick={() => setVisible((v) => v + 30)}
            >
              Mostrar mais ({Math.min(filtered.length - visible, 30)})
            </button>
          </div>
        )
      )}

      {/* Rodapé de contagem */}
      {isServerPaged ? (
        <div className="mt-6 text-xs text-fg-muted text-center">
          Página {totalPages ? page : 0} de {totalPages} — {totalCount} partidas.
        </div>
      ) : (
        filtered.length > 0 && (
          <div className="mt-6 text-xs text-fg-muted text-center">
            Exibindo {Math.min(visible, filtered.length)} de {filtered.length} partidas.
          </div>
        )
      )}
    </div>
  );
}
