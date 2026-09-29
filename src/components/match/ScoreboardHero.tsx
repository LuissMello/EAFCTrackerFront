import React from "react";
import { Link } from "react-router-dom";
import { crestUrl } from "../../config/urls.ts";
import type { MatchResultDto, MatchTypeFilter } from "../../types/match.ts";
import { formatDateSafe, perspectiveForSelected } from "../../utils/matchResults.ts";
import { Crest } from "../ui.tsx";
import { GameVersionBadge } from "../GameVersionBadge.tsx";

/** Placar em destaque (último resultado) — elemento "broadcast". */
export const ScoreboardHero = React.memo(function ScoreboardHero({
  m,
  matchType,
  selectedClubIds,
  fallbackClubName,
}: {
  m: MatchResultDto;
  matchType: MatchTypeFilter;
  selectedClubIds: number[];
  fallbackClubName?: string | null;
}) {
  const p = perspectiveForSelected(m, selectedClubIds, fallbackClubName);
  const outcome = p.myGoals === p.oppGoals ? "draw" : p.myGoals > p.oppGoals ? "win" : "loss";

  const crestA = m.clubADetails?.team?.toString() ?? null;
  const crestB = m.clubBDetails?.team?.toString() ?? null;
  const divA = m.clubADetails?.currentDivision ?? null;
  const divB = m.clubBDetails?.currentDivision ?? null;
  const stadiumName = m.clubADetails?.stadName ?? m.clubADetails?.StadName ?? null;

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
        <span className="inline-flex items-center gap-2 tabular-nums">
          <GameVersionBadge version={m.gameVersion} />
          {formatDateSafe(m.timestamp)}
        </span>
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
        <div className="px-4 sm:px-6 pb-4 text-center text-[11px] text-slate-400 whitespace-normal [overflow-wrap:anywhere]">{stadiumName}</div>
      )}
    </Link>
  );
});
