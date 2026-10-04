import React from "react";
import { Link } from "react-router-dom";
import { Card, RatingPill } from "../ui.tsx";
import type { NightPlayerRow } from "../../types/gameNight";

const TH = "px-2.5 py-2 text-right font-semibold whitespace-nowrap";
const TD = "px-2.5 py-2 text-right tabular-nums";

const POSITION_LABELS: Record<string, string> = {
  goalkeeper: "GOL",
  defender: "ZAG",
  midfielder: "MEI",
  forward: "ATA",
};
/** Posição que o EA devolve em inglês ("forward") -> sigla pt-BR; desconhecida: mostra como veio. */
function positionLabel(pos: string): string {
  return POSITION_LABELS[pos.trim().toLowerCase()] ?? pos;
}

export default function NightPlayersTable({ players }: { players: NightPlayerRow[] }) {
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
              cartões vermelhos.
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
              {players.map((p) => (
                <tr key={p.playerEntityId} className="hover:bg-surface-raised">
                  <th scope="row" className="px-3 py-2 text-left font-medium text-fg whitespace-nowrap">
                    <Link to={`/player/${p.playerEntityId}`} className="hover:text-accent transition-colors">
                      {p.name}
                    </Link>
                    {p.position && <span className="ml-1.5 text-[11px] font-normal text-fg-subtle">{positionLabel(p.position)}</span>}
                  </th>
                  <td className={TD}>{p.matches}</td>
                  <td className={`${TD} ${p.goals > 0 ? "font-bold text-fg" : "text-fg-muted"}`}>{p.goals}</td>
                  <td className={`${TD} ${p.assists > 0 ? "font-bold text-fg" : "text-fg-muted"}`}>{p.assists}</td>
                  <td className={`${TD} text-fg-muted`}>{p.preAssists}</td>
                  <td className={TD}>
                    <RatingPill value={p.avgRating} size="sm" />
                  </td>
                  <td className={`${TD} ${p.motm > 0 ? "font-bold text-gold-fg" : "text-fg-muted"}`}>{p.motm}</td>
                  <td className={`${TD} ${p.redCards > 0 ? "font-bold text-negative-fg" : "text-fg-muted"}`}>{p.redCards}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </section>
  );
}
