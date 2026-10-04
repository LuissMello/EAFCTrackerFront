import React from "react";
import { Link } from "react-router-dom";
import { ArrowDown, ArrowUp } from "lucide-react";
import { Card, Skeleton } from "../ui.tsx";
import { EmptyPanel, ErrorPanel } from "../analytics/Controls.tsx";
import { ReliabilityBadge, formatDelta, statsLine } from "./labShared.tsx";
import type { Duo, DuosResponse } from "../../types/lab";
import type { ResourceError } from "../../hooks/useApiResource.ts";

function Delta({ v, kind }: { v: number; kind: "win" | "points" }) {
  const tone = v > 0 ? "text-positive-fg" : v < 0 ? "text-negative-fg" : "text-fg-muted";
  const Icon = v > 0 ? ArrowUp : v < 0 ? ArrowDown : null;
  return (
    <span className={`inline-flex items-center gap-0.5 font-semibold tabular-nums whitespace-nowrap ${tone}`}>
      {Icon && <Icon size={11} aria-hidden="true" />}
      {formatDelta(kind, v)}
    </span>
  );
}

function DuoCard({ duo, rank }: { duo: Duo; rank: number }) {
  return (
    <li>
      <Card className="p-3 sm:p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-widest text-fg-subtle">#{rank}</div>
            <div className="font-semibold text-fg break-words">
              <Link to={`/player/${duo.aPlayerEntityId}`} className="hover:text-accent">{duo.aName}</Link>
              <span className="text-fg-subtle"> + </span>
              <Link to={`/player/${duo.bPlayerEntityId}`} className="hover:text-accent">{duo.bName}</Link>
            </div>
          </div>
          <ReliabilityBadge value={duo.reliability} />
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
          <dt className="text-fg-subtle">Juntos</dt>
          <dd className="text-fg-secondary tabular-nums">{statsLine(duo.together)}</dd>
          <dt className="text-fg-subtle">Separados</dt>
          <dd className="text-fg-secondary tabular-nums">{duo.apart ? statsLine(duo.apart) : "nunca jogaram separados"}</dd>
        </dl>
        {duo.delta && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-fg-muted border-t border-border pt-2">
            <span>
              Δ % vitórias: <Delta v={duo.delta.winRatePct} kind="win" />
            </span>
            <span>
              Δ pontos/jogo: <Delta v={duo.delta.pointsPerMatch} kind="points" />
            </span>
          </div>
        )}
      </Card>
    </li>
  );
}

function DuoList({ title, subtitle, duos }: { title: string; subtitle: string; duos: Duo[] }) {
  return (
    <section aria-label={title} className="space-y-3 min-w-0">
      <div>
        <h3 className="font-display font-bold text-lg uppercase tracking-wide text-fg">{title}</h3>
        <p className="text-xs text-fg-muted">{subtitle}</p>
      </div>
      {duos.length === 0 ? (
        <Card className="p-4 text-sm text-fg-muted">Nenhuma dupla com jogos suficientes neste recorte.</Card>
      ) : (
        <ol className="space-y-2.5">
          {duos.map((d, i) => (
            <DuoCard key={`${d.aPlayerEntityId}-${d.bPlayerEntityId}`} duo={d} rank={i + 1} />
          ))}
        </ol>
      )}
    </section>
  );
}

export default function DuosTab({
  data,
  loading,
  error,
  onRetry,
}: {
  data: DuosResponse | null;
  loading: boolean;
  error: ResourceError | null;
  onRetry: () => void;
}) {
  if (error) return <ErrorPanel message={error.message} onRetry={onRetry} />;
  if (loading || !data) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" role="status" aria-busy="true">
        <span className="sr-only">Carregando duplas…</span>
        <Skeleton className="h-64 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }
  const best = data.best ?? [];
  const worst = data.worst ?? [];
  if (best.length === 0 && worst.length === 0) {
    return (
      <EmptyPanel
        icon="🤝"
        title="Nenhuma dupla com jogos suficientes"
        message="Diminua o mínimo de jogos ou amplie o período para comparar duplas."
      />
    );
  }
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <DuoList
        title="Melhores duplas"
        subtitle='Duplas cujo time rende mais quando os dois jogam juntos (comparado aos jogos em que no máximo um dos dois joga).'
        duos={best}
      />
      <DuoList
        title="Duplas com desempenho menor"
        subtitle="Duplas cujo time rende menos quando os dois jogam juntos. Pode ser acaso, adversários mais fortes ou poucos jogos."
        duos={worst}
      />
    </div>
  );
}
