import React from "react";
import { Card, Crest, ResultPill, Skeleton } from "../ui.tsx";
import { crestUrl } from "../../config/urls.ts";
import { fmtDateBRShort } from "../../utils/date.ts";
import type { OpponentPreview } from "../../types/goalRegistration.ts";
import type { PreviewStatus } from "../../hooks/useOpponentPreview.ts";
import { TAG_CLS } from "./shared.ts";
import { DivisionChip } from "./DivisionChip.tsx";

const num = (v?: number | null, digits = 1): string =>
  v === null || v === undefined || !Number.isFinite(v) ? "—" : v.toFixed(digits);

const LABEL_CLS = "text-[11px] font-semibold uppercase tracking-wider text-fg-subtle";

const Missing = () => <span className="text-fg-subtle">Sem dados</span>;

interface Fact {
  label: string;
  main: React.ReactNode;
  sub?: React.ReactNode;
}

/** Bloco de estatística na grade (telas ≥ sm). */
function Tile({ fact }: { fact: Fact }) {
  return (
    <div className="min-w-0 rounded-xl border border-border bg-surface-raised px-3 py-2.5">
      <div className={LABEL_CLS}>{fact.label}</div>
      <div className="mt-1 text-sm text-fg">
        <span className="font-semibold tabular-nums">{fact.main}</span>
        {fact.sub ? <div className="text-xs text-fg-muted tabular-nums">{fact.sub}</div> : null}
      </div>
    </div>
  );
}

interface Props {
  name: string;
  status: PreviewStatus;
  preview: OpponentPreview | null;
  error: string | null;
  onRetry: () => void;
  /** Escudo do adversário (teamId) e alternativa (crest do kit) quando o principal não existe no CDN. */
  crestAssetId?: string | null;
  customCrestAssetId?: string | null;
  className?: string;
}

/**
 * Pré-estatísticas do adversário. Todos os blocos são opcionais: o que vier nulo mostra "Sem dados"
 * e `warnings` do backend explica as lacunas. No celular as estatísticas viram uma lista "rótulo → valor"
 * (uma por linha), que não aperta nem quebra o texto; a grade de blocos só aparece em telas maiores.
 */
export const OpponentPreviewCard = React.memo(function OpponentPreviewCard({
  name,
  status,
  preview,
  error,
  onRetry,
  crestAssetId,
  customCrestAssetId,
  className = "",
}: Props) {
  const p = preview;
  const hasAny = !!p && !!(p.record || p.goals || p.recent || p.members || p.headToHead || p.currentDivision || p.bestDivision);
  const results = p?.recent?.results?.slice(0, 5) ?? [];
  const hasCrest = !!(crestAssetId || customCrestAssetId);

  const facts: Fact[] = p
    ? [
        {
          label: "Campanha",
          main: p.record ? `${p.record.wins}V · ${p.record.draws}E · ${p.record.losses}D` : <Missing />,
          sub: p.record
            ? `${p.record.games} jogos${p.record.winRatePct != null ? ` · ${num(p.record.winRatePct, 0)}% de aproveitamento` : ""}`
            : undefined,
        },
        {
          label: "Gols",
          main: p.goals ? `${p.goals.for} pró · ${p.goals.against} contra` : <Missing />,
          sub: p.goals ? `médias ${num(p.goals.avgFor)} / ${num(p.goals.avgAgainst)} por jogo` : undefined,
        },
        {
          label: "Jogadores por partida",
          main:
            p.recent && (p.recent.lastMatchPlayers != null || p.recent.avgPlayersLast5 != null) ? (
              p.recent.lastMatchPlayers != null ? `${p.recent.lastMatchPlayers} na última` : "—"
            ) : (
              <Missing />
            ),
          sub:
            p.recent && (p.recent.lastMatchPlayers != null || p.recent.avgPlayersLast5 != null)
              ? `média dos últimos 5: ${num(p.recent.avgPlayersLast5)}`
              : undefined,
        },
        {
          label: "Elenco (membros)",
          main:
            p.members && (p.members.count != null || p.members.avgOverall != null) ? (
              p.members.count != null ? `${p.members.count} membros` : "—"
            ) : (
              <Missing />
            ),
          sub:
            p.members && (p.members.count != null || p.members.avgOverall != null)
              ? `overall médio ${num(p.members.avgOverall)}`
              : undefined,
        },
        {
          label: "Contra nós",
          main:
            p.headToHead && p.headToHead.games > 0 ? (
              `${p.headToHead.games} ${p.headToHead.games === 1 ? "jogo" : "jogos"} · ${p.headToHead.wins}V ${p.headToHead.draws}E ${p.headToHead.losses}D`
            ) : (
              <span className="font-normal text-fg-subtle">Nunca nos enfrentamos</span>
            ),
          sub:
            p.headToHead && p.headToHead.games > 0
              ? `${p.headToHead.goalsFor != null && p.headToHead.goalsAgainst != null ? `gols ${p.headToHead.goalsFor}–${p.headToHead.goalsAgainst}` : ""}${
                  p.headToHead.lastPlayedAt ? ` · último em ${fmtDateBRShort(p.headToHead.lastPlayedAt)}` : ""
                }`
              : undefined,
        },
      ]
    : [];

  return (
    <Card className={`p-3 sm:p-4 ${className}`} aria-busy={status === "loading"}>
      <div className="flex items-start gap-3">
        {hasCrest ? (
          <Crest
            src={crestUrl(crestAssetId ?? customCrestAssetId)}
            fallbackSrc={crestAssetId && customCrestAssetId ? crestUrl(customCrestAssetId) : null}
            size={44}
            rounded="rounded-xl"
          />
        ) : null}
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-xl font-bold uppercase leading-tight tracking-wide text-fg [overflow-wrap:anywhere]">
            {p?.name || name}
          </h3>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <DivisionChip label="Div." value={p?.currentDivision} />
            {p?.bestDivision !== null && p?.bestDivision !== undefined && p.bestDivision !== p.currentDivision && (
              <DivisionChip label="Melhor div." value={p.bestDivision} />
            )}
            {p?.reputationTier !== null && p?.reputationTier !== undefined && p.reputationTier !== "" && (
              <span className={TAG_CLS}>Tier {p.reputationTier}</span>
            )}
            {p?.points !== null && p?.points !== undefined && <span className={TAG_CLS}>{p.points} pts</span>}
          </div>
        </div>
      </div>

      {status === "loading" && (
        <div className="mt-3" role="status">
          <span className="sr-only">Carregando estatísticas do adversário…</span>
          <div className="space-y-2" aria-hidden="true">
            <Skeleton className="h-14 rounded-xl" />
            <Skeleton className="h-10 rounded-xl" />
            <Skeleton className="h-10 rounded-xl" />
            <Skeleton className="h-10 rounded-xl" />
          </div>
        </div>
      )}

      {status === "error" && (
        <div role="alert" className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-negative/30 bg-negative-soft p-3 text-sm text-negative-fg">
          <span className="min-w-[12rem] flex-1">{error}</span>
          <button type="button" className="btn btn-secondary" onClick={onRetry}>
            Tentar de novo
          </button>
        </div>
      )}

      {status === "done" && !hasAny && (
        <p className="mt-3 text-sm text-fg-muted">Não há estatísticas disponíveis deste adversário agora. Você ainda pode iniciar o registro e anotar os gols.</p>
      )}

      {status === "done" && p && hasAny && (
        <>
          {/* Últimos 5: destaque em linha própria, com chips que cabem na largura do celular */}
          <div className="mt-3 rounded-xl border border-border bg-surface-raised px-3 py-2.5">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
              <span className={LABEL_CLS}>Últimos 5</span>
              {results.length > 0 ? (
                <div
                  className="flex gap-1.5"
                  role="img"
                  aria-label={`Últimos resultados, do mais recente: ${results.map((r) => (r === "W" ? "vitória" : r === "D" ? "empate" : "derrota")).join(", ")}`}
                >
                  {results.map((r, i) => (
                    <ResultPill key={i} outcome={r} variant="solid" />
                  ))}
                </div>
              ) : (
                <Missing />
              )}
            </div>
            {results.length > 0 && (p.recent?.avgGoalsFor != null || p.recent?.avgGoalsAgainst != null) && (
              <div className="mt-1.5 text-xs text-fg-muted tabular-nums">
                gols/jogo: {num(p.recent?.avgGoalsFor)} pró · {num(p.recent?.avgGoalsAgainst)} contra
              </div>
            )}
          </div>

          {/* Celular: rótulo em cima e valor embaixo, usando a largura toda (não aperta nem quebra o texto) */}
          <dl className="mt-2 divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface-raised sm:hidden">
            {facts.map((f) => (
              <div key={f.label} className="px-3 py-2">
                <dt className={LABEL_CLS}>{f.label}</dt>
                <dd className="mt-0.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm text-fg">
                  <span className="font-semibold tabular-nums">{f.main}</span>
                  {f.sub ? <span className="text-xs text-fg-muted tabular-nums">{f.sub}</span> : null}
                </dd>
              </div>
            ))}
          </dl>

          {/* Telas maiores: grade de blocos */}
          <div className="mt-2 hidden grid-cols-2 gap-2 sm:grid lg:grid-cols-3">
            {facts.map((f) => (
              <Tile key={f.label} fact={f} />
            ))}
          </div>
        </>
      )}

      {status === "done" && p?.warnings && p.warnings.length > 0 && (
        <ul className="mt-3 space-y-1 rounded-xl border border-warning/40 bg-warning-soft p-3 text-xs text-warning-fg">
          {p.warnings.map((w, i) => (
            <li key={i} className="flex gap-1.5">
              <span aria-hidden="true">⚠</span>
              <span>{w}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
});
