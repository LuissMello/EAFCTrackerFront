import React from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { Card, ResultPill } from "../ui.tsx";
import { OpponentCrest } from "../analytics/Controls.tsx";
import type { GameNightDetail, NightGoal, NightMatch } from "../../types/gameNight";
import { RESULT_TEXT, fmtNum, fmtTimeInZone } from "../../utils/analyticsFormat.ts";

/** "Fulano ← Beltrano ← Sicrano" (artilheiro ← assistência ← pré-assistência). */
export function goalChain(g: NightGoal): string {
  const parts = [g.scorerName?.trim() || "Gol sem autor"];
  if (g.assistName) parts.push(g.assistName);
  if (g.preAssistName) parts.push(g.preAssistName);
  return parts.join(" ← ");
}

const RESULT_BORDER: Record<NightMatch["result"], string> = {
  W: "border-l-positive",
  D: "border-l-warning",
  L: "border-l-negative",
};

const MatchRow = React.memo(function MatchRow({
  m,
  index,
  timeZone,
}: {
  m: NightMatch;
  index: number;
  timeZone: string | null;
}) {
  const goals = m.goals ?? [];
  const opp = m.opponentName?.trim() || "Adversário";
  return (
    <li>
      <Card className={`p-3 sm:p-4 border-l-4 ${RESULT_BORDER[m.result]}`}>
        <div className="flex items-center gap-3">
          <div className="w-11 flex-shrink-0 text-center">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">Jogo {index + 1}</div>
            <div className="text-xs text-fg-muted tabular-nums">{fmtTimeInZone(m.timestamp, timeZone)}</div>
          </div>
          <OpponentCrest crestAssetId={m.crestAssetId} customCrestAssetId={m.customCrestAssetId} name={opp} size={36} />
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-fg leading-snug line-clamp-2 break-words" title={opp}>
              {opp}
            </div>
            <div className="text-xs text-fg-muted tabular-nums">
              {m.ourPlayersCount > 0 && m.opponentPlayersCount > 0 ? `${m.ourPlayersCount} × ${m.opponentPlayersCount} jogadores` : "Jogadores não registrados"}
              {m.skillRatingAfter != null && <> · SR {fmtNum(m.skillRatingAfter)}</>}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="font-display font-black text-2xl tabular-nums text-fg">
              {m.goalsFor}–{m.goalsAgainst}
            </span>
            <span className="inline-flex items-center gap-1">
              <ResultPill outcome={m.result} variant="solid" />
              <span className="hidden sm:inline text-xs font-semibold text-fg-secondary">{RESULT_TEXT[m.result]}</span>
              <span className="sr-only sm:hidden">{RESULT_TEXT[m.result]}</span>
            </span>
          </div>
        </div>

        {goals.length > 0 && (
          <ul className="mt-2.5 ml-14 space-y-1" aria-label={`Gols do jogo contra ${opp}`}>
            {goals.map((g, i) => (
              <li key={i} className="flex items-start gap-1.5 text-sm text-fg-secondary">
                <span aria-hidden="true" className="text-xs mt-0.5">⚽</span>
                <span className="min-w-0 break-words">{goalChain(g)}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-2 ml-14">
          <Link
            to={`/match/${m.matchId}`}
            aria-label={`Ver partida contra ${opp}`}
            className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
          >
            Ver partida <ArrowUpRight size={13} aria-hidden="true" />
          </Link>
        </div>
      </Card>
    </li>
  );
});

export default function NightTimeline({ night }: { night: GameNightDetail }) {
  return (
    <section aria-labelledby="night-timeline-title">
      <h3
        id="night-timeline-title"
        className="text-sm font-semibold text-fg-muted uppercase tracking-wide mb-3"
      >
        Linha do tempo · {night.matches.length} {night.matches.length === 1 ? "partida" : "partidas"}
      </h3>
      <ol className="space-y-2.5">
        {night.matches.map((m, i) => (
          <MatchRow key={m.matchId} m={m} index={i} timeZone={night.timeZoneId} />
        ))}
      </ol>
    </section>
  );
}
