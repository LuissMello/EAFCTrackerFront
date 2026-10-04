import React from "react";
import { Link } from "react-router-dom";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { Card } from "../ui.tsx";
import { KpiTile } from "../analytics/Controls.tsx";
import type { GameNightDetail, MatchRef } from "../../types/gameNight";
import { fmtDuration, fmtNum, fmtPct, fmtSigned, plural } from "../../utils/analyticsFormat.ts";
import { nightTimeRange } from "./NightNavigator.tsx";

function SrDelta({ night }: { night: GameNightDetail }) {
  const { start, end, delta } = night.skillRating;
  if (delta == null) {
    return <KpiTile label="Skill rating" value="—" sub="Sem dados de SR nesta noite" />;
  }
  const up = delta > 0;
  const down = delta < 0;
  const Icon = up ? ArrowUp : down ? ArrowDown : Minus;
  return (
    <KpiTile
      label="Skill rating"
      tone={up ? "positive" : down ? "negative" : "default"}
      value={
        <span className="inline-flex items-center gap-1">
          <Icon size={22} aria-hidden="true" />
          <span>{fmtSigned(delta)}</span>
          <span className="sr-only">{up ? " (subiu)" : down ? " (caiu)" : " (estável)"}</span>
        </span>
      }
      sub={start != null && end != null ? `${fmtNum(start)} → ${fmtNum(end)}` : undefined}
    />
  );
}

function PlayerHighlight({
  label,
  name,
  value,
  playerEntityId,
}: {
  label: string;
  name?: string;
  value?: string;
  playerEntityId?: number;
}) {
  return (
    <Card className="p-3 sm:p-4 min-w-0">
      <div className="text-[11px] font-semibold uppercase tracking-widest text-fg-subtle">{label}</div>
      {name ? (
        <>
          {playerEntityId ? (
            <Link
              to={`/player/${playerEntityId}`}
              className="mt-1 block font-semibold text-fg truncate hover:text-accent transition-colors"
              title={name}
            >
              {name}
            </Link>
          ) : (
            <div className="mt-1 font-semibold text-fg truncate" title={name}>
              {name}
            </div>
          )}
          <div className="text-sm text-fg-muted tabular-nums">{value}</div>
        </>
      ) : (
        <div className="mt-1 text-sm text-fg-subtle">Sem destaque</div>
      )}
    </Card>
  );
}

function RefLink({ label, m, tone }: { label: string; m: MatchRef | null; tone: "positive" | "negative" }) {
  if (!m) return null;
  return (
    <Link
      to={`/match/${m.matchId}`}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm hover:underline ${
        tone === "positive"
          ? "border-positive/30 bg-positive-soft text-positive-fg"
          : "border-negative/30 bg-negative-soft text-negative-fg"
      }`}
    >
      <span className="font-semibold">{label}:</span>
      <span className="tabular-nums">
        {m.goalsFor}–{m.goalsAgainst}
      </span>
      <span className="truncate max-w-[10rem]">vs {m.opponentName ?? "Adversário"}</span>
    </Link>
  );
}

export default function NightKpis({ night }: { night: GameNightDetail }) {
  const r = night.record;
  const h = night.highlights;
  const hatTricks = h.hatTricks ?? [];
  const diffTone = r.goalDiff > 0 ? "positive" : r.goalDiff < 0 ? "negative" : "default";
  return (
    <section aria-label="Resumo da noite" className="space-y-3">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiTile
          label="Campanha"
          value={
            <span aria-label={`${r.wins} vitórias, ${r.draws} empates, ${r.losses} derrotas`}>
              {r.wins}-{r.draws}-{r.losses}
            </span>
          }
          sub={`${r.matches} ${plural(r.matches, "jogo", "jogos")} · ${fmtPct(r.winRatePct)} de aproveitamento`}
        />
        <KpiTile
          label="Gols"
          value={`${r.goalsFor}:${r.goalsAgainst}`}
          tone={diffTone}
          sub={`Saldo ${fmtSigned(r.goalDiff)} · ${r.cleanSheets} ${plural(r.cleanSheets, "jogo", "jogos")} sem sofrer gol`}
        />
        <SrDelta night={night} />
        <KpiTile
          label="Duração"
          value={fmtDuration(night.durationMinutes)}
          sub={nightTimeRange(night.startedAtUtc, night.endedAtUtc, night.timeZoneId)}
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <PlayerHighlight
          label="Craque da noite"
          name={h.manOfTheMatch?.name}
          playerEntityId={h.manOfTheMatch?.playerEntityId}
          value={h.manOfTheMatch ? `${h.manOfTheMatch.count}× melhor em campo` : undefined}
        />
        <PlayerHighlight
          label="Artilheiro"
          name={h.topScorer?.name}
          playerEntityId={h.topScorer?.playerEntityId}
          value={h.topScorer ? `${h.topScorer.goals} ${plural(h.topScorer.goals, "gol", "gols")}` : undefined}
        />
        <PlayerHighlight
          label="Garçom"
          name={h.topAssister?.name}
          playerEntityId={h.topAssister?.playerEntityId}
          value={
            h.topAssister
              ? `${h.topAssister.assists} ${plural(h.topAssister.assists, "assistência", "assistências")}`
              : undefined
          }
        />
        <PlayerHighlight
          label="Melhor nota"
          name={h.bestRated?.name}
          playerEntityId={h.bestRated?.playerEntityId}
          value={
            h.bestRated
              ? `${fmtNum(h.bestRated.avgRating, 1)} em ${h.bestRated.matches} ${plural(h.bestRated.matches, "jogo", "jogos")}`
              : undefined
          }
        />
      </div>

      {(h.biggestWin || h.worstLoss || hatTricks.length > 0 || h.redCards > 0) && (
        <div className="flex flex-wrap items-center gap-2">
          <RefLink label="Maior vitória" m={h.biggestWin} tone="positive" />
          <RefLink label="Pior derrota" m={h.worstLoss} tone="negative" />
          {hatTricks.map((t) => (
            <Link
              key={`${t.playerEntityId}-${t.matchId}`}
              to={`/match/${t.matchId}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gold/40 bg-gold-soft px-2.5 py-1.5 text-sm text-gold-fg hover:underline"
            >
              <span aria-hidden="true">🎩</span>
              <span className="font-semibold">Hat-trick:</span> {t.name}
            </Link>
          ))}
          {h.redCards > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-negative/30 bg-negative-soft px-2.5 py-1.5 text-sm text-negative-fg">
              <span aria-hidden="true">🟥</span>
              {h.redCards} {plural(h.redCards, "cartão vermelho", "cartões vermelhos")}
            </span>
          )}
        </div>
      )}
    </section>
  );
}
