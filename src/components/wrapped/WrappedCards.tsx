import React from "react";
import { Link } from "react-router-dom";
import { Flame, Shield, TrendingDown, TrendingUp } from "lucide-react";
import { Card } from "../ui.tsx";
import { GameVersionBadge } from "../GameVersionBadge.tsx";
import { gameVersionLabel } from "../../hooks/useGameVersions.tsx";
import { OpponentCrest, VedChip } from "../analytics/Controls.tsx";
import ArchetypeBadge from "../archetypes/ArchetypeBadge.tsx";
import { BigStat, CountUp, StoryCard } from "./StoryCard.tsx";
import { MonthlyChart, SrSeriesChart } from "./WrappedCharts.tsx";
import type {
  WrappedData,
  WrappedMatchRef,
  WrappedOppRecord,
  WrappedPlayerStat,
  WrappedSessionRef,
  WrappedStreak,
} from "../../types/wrapped";
import {
  WEEKDAYS_LONG,
  fmtDuration,
  fmtMonthLong,
  fmtNum,
  fmtPct,
  fmtSigned,
  fmtYmd,
  fmtYmdShort,
  plural,
} from "../../utils/analyticsFormat.ts";

function versionText(d: WrappedData): string {
  if (d.gameVersion != null) return gameVersionLabel(d.gameVersion);
  return d.gameVersionName?.trim() || "todas as versões";
}

function dateRange(s: WrappedStreak): string {
  return s.from === s.to ? fmtYmd(s.from) : `${fmtYmdShort(s.from)} a ${fmtYmdShort(s.to)}`;
}

/* ------------------------------------------------------------------ intro */
export function IntroCard({ d }: { d: WrappedData }) {
  const t = d.totals;
  return (
    <StoryCard
      id="intro"
      tone="hero"
      eyebrow="Retrospectiva"
      title={d.clubName?.trim() || "Seu clube"}
    >
      <div className="flex flex-wrap items-center gap-2">
        {d.gameVersion != null ? (
          <GameVersionBadge version={d.gameVersion} className="!text-xs !px-2 !py-1" />
        ) : (
          <span className="inline-flex items-center rounded border border-accent/30 bg-accent/10 text-accent px-2 py-1 text-xs font-semibold">
            Todas as versões
          </span>
        )}
        {d.gameVersionName && d.gameVersionName !== versionText(d) && (
          <span className="text-sm text-fg-muted">{d.gameVersionName}</span>
        )}
        <span className="text-sm text-fg-muted">
          {fmtYmd(d.from)} – {fmtYmd(d.to)}
        </span>
      </div>

      <div>
        <div className="font-display font-black text-6xl sm:text-8xl tabular-nums leading-none text-fg">
          <CountUp value={t.matches} />
        </div>
        <div className="text-base sm:text-lg text-fg-secondary mt-1">
          {plural(t.matches, "partida disputada", "partidas disputadas")} em{" "}
          <strong className="text-fg">
            {fmtNum(t.sessions)} {plural(t.sessions, "noite", "noites")}
          </strong>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <BigStat label="Vitórias" tone="positive" value={<CountUp value={t.wins} />} sub={`${t.draws} empates · ${t.losses} derrotas`} />
        <BigStat label="Aproveitamento" value={<CountUp value={t.winRatePct} digits={0} format={(n) => `${fmtNum(n, 0)}%`} />} />
        <BigStat
          label="Gols"
          tone="accent"
          value={
            <>
              <CountUp value={t.goalsFor} />
              <span className="text-fg-subtle text-3xl sm:text-4xl"> : </span>
              <CountUp value={t.goalsAgainst} />
            </>
          }
          sub="feitos : sofridos"
        />
        <BigStat label="Sem sofrer gol" value={<CountUp value={t.cleanSheets} />} sub={plural(t.cleanSheets, "jogo", "jogos")} />
        <BigStat label="Dias ativos" value={<CountUp value={t.activeDays} />} sub="com partidas" />
        <BigStat label="Tempo jogado" tone="gold" value={<CountUp value={Math.round(t.estimatedMinutes / 60)} />} sub={`${plural(Math.round(t.estimatedMinutes / 60), "hora", "horas")} (${fmtDuration(t.estimatedMinutes)})`} />
      </div>
    </StoryCard>
  );
}

/* ---------------------------------------------------------------- streaks */
function StreakTile({
  label,
  streak,
  unit,
  icon,
  tone,
}: {
  label: string;
  streak: WrappedStreak | null;
  unit: [string, string];
  icon: React.ReactNode;
  tone: "positive" | "accent" | "negative" | "default";
}) {
  return (
    <BigStat
      label={label}
      tone={streak ? tone : "default"}
      value={
        streak ? (
          <span className="inline-flex items-center gap-2">
            <span aria-hidden="true" className="text-2xl">{icon}</span>
            <CountUp value={streak.length} />
          </span>
        ) : (
          "—"
        )
      }
      sub={streak ? `${plural(streak.length, unit[0], unit[1])} · ${dateRange(streak)}` : "Sem registro"}
    />
  );
}

export function StreaksCard({ d }: { d: WrappedData }) {
  const s = d.streaks;
  return (
    <StoryCard
      id="streaks"
      eyebrow="Sequências"
      title="Quando a coisa engrenou"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <StreakTile label="Maior sequência de vitórias" streak={s.longestWin} unit={["vitória seguida", "vitórias seguidas"]} icon={<Flame className="inline" size={26} />} tone="positive" />
        <StreakTile label="Maior sequência invicto" streak={s.longestUnbeaten} unit={["jogo sem perder", "jogos sem perder"]} icon={<Shield className="inline" size={26} />} tone="accent" />
        <StreakTile label="Sem sofrer gol" streak={s.longestCleanSheet} unit={["jogo sem sofrer gol", "jogos sem sofrer gol"]} icon={<Shield className="inline" size={26} />} tone="default" />
        <StreakTile label="Maior seca (sem vencer)" streak={s.longestWinless} unit={["jogo sem vencer", "jogos sem vencer"]} icon={<TrendingDown className="inline" size={26} />} tone="negative" />
      </div>
    </StoryCard>
  );
}

/* ---------------------------------------------------------------- moments */
function MatchMoment({ label, m, tone }: { label: string; m: WrappedMatchRef | null; tone: "positive" | "negative" | "default" }) {
  return (
    <BigStat
      label={label}
      tone={tone}
      value={m ? `${m.goalsFor}–${m.goalsAgainst}` : "—"}
      sub={
        m ? (
          <Link to={`/match/${m.matchId}`} className="text-accent hover:underline">
            vs {m.opponentName ?? "Adversário"} · ver partida
          </Link>
        ) : (
          "Sem registro"
        )
      }
    />
  );
}

function SessionMoment({ label, s, clubId, tone }: { label: string; s: WrappedSessionRef | null; clubId: number; tone: "positive" | "negative" }) {
  return (
    <BigStat
      label={label}
      tone={s ? tone : "default"}
      value={s ? fmtYmdShort(s.date) : "—"}
      sub={
        s ? (
          <span className="inline-flex flex-wrap items-center gap-x-2">
            <VedChip wins={s.wins} draws={s.draws} losses={s.losses} />
            <Link to={`/noite-de-jogo?clubIds=${clubId}&session=${s.sessionId}`} className="text-accent hover:underline">
              ver noite
            </Link>
          </span>
        ) : (
          "Precisa de noites com 3+ jogos"
        )
      }
    />
  );
}

export function MomentsCard({ d }: { d: WrappedData }) {
  const m = d.bigMoments;
  return (
    <StoryCard
      id="moments"
      eyebrow="Momentos"
      title="Os jogos que ficaram"
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <MatchMoment label="Maior vitória" m={m.biggestWin} tone="positive" />
        <MatchMoment label="Pior derrota" m={m.worstLoss} tone="negative" />
        <MatchMoment label="Jogo com mais gols" m={m.highestScoring} tone="default" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <SessionMoment label="Melhor noite" s={m.bestSession} clubId={d.clubId} tone="positive" />
        <SessionMoment label="Pior noite" s={m.worstSession} clubId={d.clubId} tone="negative" />
      </div>
    </StoryCard>
  );
}

/* ---------------------------------------------------------------- players */
function Award({
  label,
  p,
  unit,
  digits = 0,
  tone = "default",
}: {
  label: string;
  p: WrappedPlayerStat | null;
  unit?: [string, string];
  digits?: number;
  tone?: "default" | "gold" | "accent" | "negative" | "positive";
}) {
  return (
    <BigStat
      label={label}
      tone={p ? tone : "default"}
      value={p ? <CountUp value={p.value} digits={digits} /> : "—"}
      sub={
        p ? (
          <span>
            <Link to={`/player/${p.playerEntityId}`} className="font-semibold text-fg hover:text-accent">
              {p.name}
            </Link>
            {unit ? ` · ${plural(p.value, unit[0], unit[1])}` : ""}
            {p.archetype && (
              <>
                {" "}
                <ArchetypeBadge archetype={p.archetype} compact className="align-middle" />
              </>
            )}
          </span>
        ) : (
          "Sem registro"
        )
      }
    />
  );
}

export function PlayersCard({ d }: { d: WrappedData }) {
  const p = d.players;
  return (
    <StoryCard
      id="players"
      eyebrow="Jogadores"
      title="Os destaques do time"
    >
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <Award label="Artilheiro" p={p.topScorer} unit={["gol", "gols"]} tone="accent" />
        <Award label="Garçom" p={p.topAssister} unit={["assistência", "assistências"]} tone="accent" />
        <Award label="Craque (MVP)" p={p.mostMotm} unit={["vez melhor em campo", "vezes melhor em campo"]} tone="gold" />
        <Award label="Melhor nota média" p={p.bestAvgRating} digits={2} tone="gold" />
        <Award label="Mais jogos" p={p.mostMatches} unit={["jogo", "jogos"]} />
        <Award label="Cartões vermelhos" p={p.mostRedCards} unit={["cartão", "cartões"]} tone="negative" />
      </div>
      <p className="text-sm text-fg-muted">
        <span aria-hidden="true">🎩</span> <strong className="text-fg">{fmtNum(p.hatTricks)}</strong>{" "}
        {plural(p.hatTricks, "hat-trick no período", "hat-tricks no período")}. Melhor nota exige pelo menos 10 jogos.
      </p>
    </StoryCard>
  );
}

/* ------------------------------------------------------------- archetypes */
export function ArchetypesCard({ d }: { d: WrappedData }) {
  const a = d.archetypes;
  if (!a || (!a.mostUsed && a.list.length === 0)) return null;
  const top = a.mostUsed;
  const max = Math.max(1, ...a.list.map((u) => u.matches));
  return (
    <StoryCard id="archetypes" eyebrow="Arquétipos" title="Como o time jogou">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <BigStat
          label="Arquétipo mais usado"
          tone="accent"
          value={top ? <CountUp value={top.matches} /> : "—"}
          sub={
            top ? (
              <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
                <ArchetypeBadge archetype={top.archetype} emphasis />
                <span>
                  {plural(top.matches, "jogo", "jogos")} · {fmtPct(top.pct, 0)} das atuações
                </span>
              </span>
            ) : (
              "Sem registro"
            )
          }
        />
        <BigStat
          label="Trocas de arquétipo"
          value={<CountUp value={a.switches} />}
          sub={a.switches === 0 ? "Ninguém trocou de arquétipo" : `${plural(a.switches, "troca", "trocas")} no período, somando os jogadores`}
        />
      </div>
      {a.list.length > 0 && (
        <ol className="space-y-2" aria-label="Arquétipos mais usados">
          {a.list.slice(0, 5).map((u) => (
            <li key={u.archetype.id} className="flex items-center gap-3">
              <span className="w-32 sm:w-40 flex-shrink-0 min-w-0">
                <ArchetypeBadge archetype={u.archetype} className="max-w-full truncate" />
              </span>
              <span className="flex-1 h-2 rounded-full bg-surface-sunken overflow-hidden" aria-hidden="true">
                <span className="block h-full rounded-full bg-accent" style={{ width: `${Math.round((u.matches / max) * 100)}%` }} />
              </span>
              <span className="w-24 text-right text-xs tabular-nums text-fg-muted flex-shrink-0">
                {fmtNum(u.matches)} · {fmtPct(u.pct, 0)}
              </span>
            </li>
          ))}
        </ol>
      )}
      <p className="text-xs text-fg-subtle">Conta atuações de jogador (um jogador por partida). Partidas antigas sem arquétipo ficam de fora.</p>
    </StoryCard>
  );
}

/* -------------------------------------------------------------------- duo */
export function DuoCard({ d }: { d: WrappedData }) {
  const duo = d.bestDuo;
  if (!duo) return null;
  return (
    <StoryCard
      id="duo"
      eyebrow="Parceria"
      title="A dupla da temporada"
    >
      <div className="flex flex-col items-center text-center gap-3 py-4">
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 font-display font-black uppercase text-3xl sm:text-5xl leading-tight">
          <span className="text-fg">{duo.assisterName}</span>
          <span aria-label="assistiu" className="text-accent">→</span>
          <span className="text-fg">{duo.scorerName}</span>
        </div>
        <div className="text-fg-secondary">
          <strong className="text-2xl font-display text-gold-fg tabular-nums">
            <CountUp value={duo.goals} />
          </strong>{" "}
          {plural(duo.goals, "gol", "gols")} nessa parceria (assistência → gol)
        </div>
      </div>
    </StoryCard>
  );
}

/* -------------------------------------------------------------- opponents */
function OppTile({ label, o, hint }: { label: string; o: WrappedOppRecord | null; hint: string }) {
  return (
    <Card className="p-3 sm:p-4 flex flex-col gap-3 bg-surface-raised">
      <div className="text-[11px] font-semibold uppercase tracking-widest text-fg-subtle">{label}</div>
      {o ? (
        <>
          <div className="flex items-center gap-3 min-w-0">
            <OpponentCrest crestAssetId={o.crestAssetId} customCrestAssetId={o.customCrestAssetId} name={o.name} size={52} />
            <div className="min-w-0">
              <div className="font-display font-bold text-xl uppercase leading-tight text-fg break-words">{o.name?.trim() || "Adversário"}</div>
              <div className="text-xs text-fg-muted">
                {o.matches} {plural(o.matches, "jogo", "jogos")}
              </div>
            </div>
          </div>
          <VedChip wins={o.wins} draws={o.draws} losses={o.losses} className="text-sm" />
        </>
      ) : (
        <div className="text-sm text-fg-subtle">{hint}</div>
      )}
    </Card>
  );
}

export function OpponentsCard({ d }: { d: WrappedData }) {
  const o = d.opponents;
  if (!o.mostFaced && !o.favoriteVictim && !o.nemesis) return null;
  return (
    <StoryCard
      id="opponents"
      eyebrow="Adversários"
      title="Quem cruzou o caminho"
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <OppTile label="Mais enfrentado" o={o.mostFaced} hint="Sem registro" />
        <OppTile label="Freguês favorito" o={o.favoriteVictim} hint="Precisa de 3+ jogos contra o mesmo clube" />
        <OppTile label="Nêmesis" o={o.nemesis} hint="Precisa de 3+ jogos contra o mesmo clube" />
      </div>
    </StoryCard>
  );
}

/* ----------------------------------------------------------------- rhythm */
export function RhythmCard({ d }: { d: WrappedData }) {
  const r = d.rhythm;
  return (
    <StoryCard
      id="rhythm"
      eyebrow="Ritmo"
      title="Quando a gente joga"
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <BigStat
          label="Dia favorito"
          value={r.busiestWeekday ? <span className="capitalize text-3xl sm:text-4xl">{WEEKDAYS_LONG[r.busiestWeekday.weekday] ?? "—"}</span> : "—"}
          sub={r.busiestWeekday ? `${r.busiestWeekday.matches} jogos` : undefined}
        />
        <BigStat
          label="Hora favorita"
          value={r.busiestHour ? `${String(r.busiestHour.hour).padStart(2, "0")}h` : "—"}
          sub={r.busiestHour ? `${r.busiestHour.matches} jogos` : undefined}
        />
        <BigStat
          label="Melhor mês"
          tone="positive"
          value={r.bestMonth ? <span className="text-3xl sm:text-4xl">{fmtPct(r.bestMonth.winRatePct)}</span> : "—"}
          sub={r.bestMonth ? `${fmtMonthLong(r.bestMonth.month)} · ${r.bestMonth.matches} jogos` : "Precisa de mais jogos no mês"}
        />
      </div>
      {r.monthly.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-fg-muted uppercase tracking-wide mb-2">Jogos por mês</h3>
          <MonthlyChart months={r.monthly} />
        </div>
      )}
    </StoryCard>
  );
}

/* ------------------------------------------------------------ progression */
export function ProgressionCard({ d }: { d: WrappedData }) {
  const p = d.progression;
  const sr = p.skillRating;
  const delta = sr.start != null && sr.end != null ? sr.end - sr.start : null;
  const div = p.division;
  return (
    <StoryCard
      id="progression"
      eyebrow="Progressão"
      title="Skill rating e divisão"
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <BigStat
          label="Skill rating"
          tone={delta == null ? "default" : delta >= 0 ? "positive" : "negative"}
          value={<span className="text-3xl sm:text-4xl">{sr.start != null && sr.end != null ? `${fmtNum(sr.start)} → ${fmtNum(sr.end)}` : "—"}</span>}
          sub={
            delta != null ? (
              <span className="inline-flex items-center gap-1">
                {delta >= 0 ? <TrendingUp size={14} aria-hidden="true" /> : <TrendingDown size={14} aria-hidden="true" />}
                {fmtSigned(delta)} no período
              </span>
            ) : undefined
          }
        />
        <BigStat label="Pico" tone="positive" value={sr.peak ? fmtNum(sr.peak.value) : "—"} sub={sr.peak ? fmtYmd(sr.peak.date) : undefined} />
        <BigStat label="Ponto mais baixo" tone="negative" value={sr.low ? fmtNum(sr.low.value) : "—"} sub={sr.low ? fmtYmd(sr.low.date) : undefined} />
        <BigStat
          label="Divisão"
          value={<span className="text-3xl sm:text-4xl">{div.start != null && div.end != null ? `${div.start} → ${div.end}` : "—"}</span>}
          sub={`${div.promotions} ${plural(div.promotions, "promoção", "promoções")} · ${div.relegations} ${plural(div.relegations, "rebaixamento", "rebaixamentos")}`}
        />
      </div>
      {p.srSeries.length >= 2 ? (
        <SrSeriesChart series={p.srSeries} peak={sr.peak} low={sr.low} />
      ) : (
        <p className="text-sm text-fg-muted">Sem dados de SR suficientes para o gráfico.</p>
      )}
    </StoryCard>
  );
}

/* -------------------------------------------------------------- fun facts */
export function FunFactsCard({ d }: { d: WrappedData }) {
  if (d.funFacts.length === 0) return null;
  return (
    <StoryCard
      id="funfacts"
      eyebrow="Curiosidades"
      title="Você sabia?"
    >
      <ul className="space-y-3">
        {d.funFacts.map((f, i) => (
          <li key={i} className="flex items-start gap-3 rounded-xl bg-surface-raised border border-border p-3 sm:p-4">
            <span aria-hidden="true" className="mt-1.5 inline-block w-2.5 h-2.5 rounded-full bg-accent flex-shrink-0" />
            <span className="text-base sm:text-lg text-fg">{f}</span>
          </li>
        ))}
      </ul>
    </StoryCard>
  );
}
