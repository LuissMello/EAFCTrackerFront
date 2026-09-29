import React from "react";
import { Link } from "react-router-dom";
import { crestUrl } from "../../config/urls.ts";
import type { MatchResultDto, MatchTypeFilter } from "../../types/match.ts";
import { compactWhen, perspectiveForSelected } from "../../utils/matchResults.ts";
import { Crest, ResultPill } from "../ui.tsx";
import type { Outcome } from "../ui.tsx";
import { GameVersionBadge } from "../GameVersionBadge.tsx";

/** Linha densa de partida ("Broadcast"): data, confronto lado a lado, placar e resultado na perspectiva do clube. */
export const MatchCard = React.memo(function MatchCard({
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

      {/* Contexto: versão do jogo (sob a data) + jogadores + estádio, centralizados sob o placar */}
      <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 pb-2.5">
        <div className="w-11 sm:w-12 shrink-0">
          <GameVersionBadge version={m.gameVersion} />
        </div>
        <div className="flex-1 min-w-0 flex justify-center">
          <span className="flex min-w-0 flex-wrap items-center justify-center gap-x-1.5 text-center text-[11px] text-fg-muted">
            <span className="shrink-0 tabular-nums font-semibold text-fg-secondary">{players}</span>
            {stadiumName && (
              <>
                <span className="shrink-0 text-fg-subtle">·</span>
                <span className="min-w-0 [overflow-wrap:anywhere]">{stadiumName}</span>
              </>
            )}
          </span>
        </div>
        <div className="w-6 shrink-0" aria-hidden />
      </div>
    </Link>
  );
});
