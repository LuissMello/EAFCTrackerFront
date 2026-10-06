import React from "react";
import { Link } from "react-router-dom";
import { Card, RatingPill } from "../ui.tsx";
import type { NightPlayerRow } from "../../types/gameNight";
import { PlayerArchetype } from "../archetypes/PlayerArchetype.tsx";
import { ArchetypeBadge } from "../archetypes/ArchetypeBadge.tsx";
import { SegmentToggle, SegmentToggleSpacer, useSegmentExpansion } from "../archetypes/SegmentToggle.tsx";
import { positionShortLabel } from "../../utils/archetypeFilters.ts";

const TH = "px-2.5 py-2 text-right font-semibold whitespace-nowrap";
const TD = "px-2.5 py-2 text-right tabular-nums";

interface NumberRow {
  matches: number;
  goals: number;
  assists: number;
  preAssists: number;
  avgRating: number | null;
  motm: number;
  redCards: number;
}

/** Células numéricas (as mesmas para a linha agregada e para cada segmento). */
function NumberCells({ r }: { r: NumberRow }) {
  return (
    <>
      <td className={TD}>{r.matches}</td>
      <td className={`${TD} ${r.goals > 0 ? "font-bold text-fg" : "text-fg-muted"}`}>{r.goals}</td>
      <td className={`${TD} ${r.assists > 0 ? "font-bold text-fg" : "text-fg-muted"}`}>{r.assists}</td>
      <td className={`${TD} text-fg-muted`}>{r.preAssists}</td>
      <td className={TD}>
        <RatingPill value={r.avgRating} size="sm" />
      </td>
      <td className={`${TD} ${r.motm > 0 ? "font-bold text-gold-fg" : "text-fg-muted"}`}>{r.motm}</td>
      <td className={`${TD} ${r.redCards > 0 ? "font-bold text-negative-fg" : "text-fg-muted"}`}>{r.redCards}</td>
    </>
  );
}

export default function NightPlayersTable({ players }: { players: NightPlayerRow[] }) {
  // Jogadores com mais de uma combinação (arquétipo, posição) na noite podem ser separados em uma linha por segmento.
  const { isOpen, setOpen } = useSegmentExpansion();
  const anySegments = players.some((p) => p.segments && p.segments.length > 1);

  if (players.length === 0) return null;
  return (
    <section aria-labelledby="night-players-title">
      <h3 id="night-players-title" className="text-sm font-semibold text-fg-muted uppercase tracking-wide mb-3">
        Jogadores da noite
      </h3>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto scroll-touch-x" data-no-swipe>
          <table className="w-full text-sm">
            <caption className="sr-only">
              Estatísticas por jogador na noite: jogos, gols, assistências, pré-assistências, nota média, melhor em campo e
              cartões vermelhos. O selo sob o nome é o arquétipo usado na noite; &quot;+N&quot; indica que o jogador usou mais de um, e o
              botão &quot;Separar por arquétipo&quot; abre uma linha por arquétipo e posição.
            </caption>
            <thead className="bg-surface-raised text-xs text-fg-muted">
              <tr>
                <th scope="col" className="px-3 py-2 text-left font-semibold">Jogador</th>
                <th scope="col" className={TH} title="Jogos"><abbr title="Jogos" className="no-underline">J</abbr></th>
                <th scope="col" className={TH} title="Gols"><abbr title="Gols" className="no-underline">G</abbr></th>
                <th scope="col" className={TH} title="Assistências"><abbr title="Assistências" className="no-underline">A</abbr></th>
                <th scope="col" className={TH} title="Pré-assistências"><abbr title="Pré-assistências" className="no-underline">PA</abbr></th>
                <th scope="col" className={TH}>Nota</th>
                <th scope="col" className={TH} title="Melhor em campo"><abbr title="Melhor em campo" className="no-underline">MVP</abbr></th>
                <th scope="col" className={TH} title="Cartões vermelhos"><abbr title="Cartões vermelhos" className="no-underline">CV</abbr></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {players.map((p) => {
                const segs = p.segments && p.segments.length > 1 ? p.segments : null;
                const open = !!segs && isOpen(String(p.playerEntityId));
                const key = String(p.playerEntityId);

                const nameLink = (
                  <Link to={`/player/${p.playerEntityId}`} className="hover:text-accent transition-colors">
                    {p.name}
                  </Link>
                );

                if (segs && open) {
                  return (
                    <React.Fragment key={p.playerEntityId}>
                      {segs.map((s, i) => (
                        <tr key={`${p.playerEntityId}-${i}`} className="bg-surface-raised/60 hover:bg-surface-raised">
                          <th scope="row" className="px-3 py-2 text-left font-medium text-fg whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              {i === 0 ? (
                                <SegmentToggle idKey={key} open onToggle={(o) => setOpen(key, o)} name={p.name} count={segs.length} />
                              ) : (
                                <SegmentToggleSpacer />
                              )}
                              <div className="min-w-0">
                                {i === 0 ? nameLink : <span className="sr-only">{p.name}</span>}
                                <div className="flex flex-wrap items-center gap-1 font-normal leading-none">
                                  <ArchetypeBadge archetype={s.archetype} compact className="!px-1.5 !py-0 !text-[11px] leading-[1.15rem]" />
                                  {s.position && <span className="text-[11px] text-fg-subtle">{positionShortLabel(s.position)}</span>}
                                </div>
                              </div>
                            </div>
                          </th>
                          <NumberCells r={s} />
                        </tr>
                      ))}
                    </React.Fragment>
                  );
                }

                return (
                  <tr key={p.playerEntityId} className="hover:bg-surface-raised">
                    <th scope="row" className="px-3 py-2 text-left font-medium text-fg whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {segs ? (
                          <SegmentToggle idKey={key} open={false} onToggle={(o) => setOpen(key, o)} name={p.name} count={segs.length} />
                        ) : anySegments ? (
                          <SegmentToggleSpacer />
                        ) : null}
                        <div className="min-w-0">
                          {nameLink}
                          {p.position && <span className="ml-1.5 text-[11px] font-normal text-fg-subtle">{positionShortLabel(p.position)}</span>}
                          {(p.archetype || (p.archetypes && p.archetypes.length > 0)) && (
                            <div className="mt-0.5 font-normal leading-none">
                              <PlayerArchetype archetype={p.archetype} archetypes={p.archetypes} />
                            </div>
                          )}
                        </div>
                      </div>
                    </th>
                    <NumberCells r={p} />
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </section>
  );
}
