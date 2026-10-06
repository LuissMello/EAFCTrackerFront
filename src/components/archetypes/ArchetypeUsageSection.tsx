import React from "react";
import { Link } from "react-router-dom";
import ArchetypeBadge, { archetypeGroupLabel } from "./ArchetypeBadge.tsx";
import type { ArchetypeChange, ArchetypeUsage } from "../../types/archetypes.ts";
import { fmtDateBR } from "../../utils/date.ts";
import { fmtNum, fmtPct } from "../../utils/analyticsFormat.ts";

function overallText(v: number | null): string {
  return v == null ? "—" : fmtNum(v, 1);
}

/** Uso por arquétipo (perfil do jogador): tabela no desktop, cartões no mobile. */
export function ArchetypeUsageList({ usage, className = "" }: { usage: ArchetypeUsage[]; className?: string }) {
  const th = "px-3 py-2.5 font-medium whitespace-nowrap";
  return (
    <div className={className}>
      <div className="hidden sm:block">
        <table className="w-full text-sm">
          <caption className="sr-only">Uso por arquétipo</caption>
          <thead>
            <tr className="border-b text-fg-muted text-xs uppercase tracking-wide">
              <th scope="col" className={`${th} text-left`}>Arquétipo</th>
              <th scope="col" className={`${th} text-right`}>Jogos</th>
              <th scope="col" className={`${th} text-right`}>%</th>
              <th scope="col" className={`${th} text-right`}>Nota</th>
              <th scope="col" className={`${th} text-right`} title="Overall médio">OVR</th>
              <th scope="col" className={`${th} text-right`} title="Gols / assistências">G / A</th>
              <th scope="col" className={`${th} text-right`}>1ª vez</th>
              <th scope="col" className={`${th} text-right`}>Última</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {usage.map((u, i) => (
              <tr key={u.archetype.id}>
                <th scope="row" className="px-3 py-2.5 text-left font-medium">
                  <ArchetypeBadge archetype={u.archetype} emphasis={i === 0} />
                  {archetypeGroupLabel(u.archetype.positionGroup) && (
                    <span className="ml-2 text-[11px] font-normal text-fg-subtle">{archetypeGroupLabel(u.archetype.positionGroup)}</span>
                  )}
                </th>
                <td className="px-3 py-2.5 text-right tabular-nums">{fmtNum(u.matches)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{fmtPct(u.pct, 0)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{fmtNum(u.avgRating, 2)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{overallText(u.avgProOverall)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums whitespace-nowrap">
                  {u.goals} / {u.assists}
                </td>
                <td className="px-3 py-2.5 text-right text-xs text-fg-muted whitespace-nowrap">{fmtDateBR(u.firstPlayedAt)}</td>
                <td className="px-3 py-2.5 text-right text-xs text-fg-muted whitespace-nowrap">{fmtDateBR(u.lastPlayedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="sm:hidden divide-y">
        {usage.map((u, i) => (
          <li key={u.archetype.id} className="px-4 py-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <ArchetypeBadge archetype={u.archetype} emphasis={i === 0} />
              <span className="text-xs text-fg-muted tabular-nums">
                {fmtNum(u.matches)} {u.matches === 1 ? "jogo" : "jogos"} · {fmtPct(u.pct, 0)}
              </span>
            </div>
            <dl className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <dt className="text-fg-subtle">Nota</dt>
                <dd className="font-semibold tabular-nums text-fg-secondary">{fmtNum(u.avgRating, 2)}</dd>
              </div>
              <div>
                <dt className="text-fg-subtle">OVR</dt>
                <dd className="font-semibold tabular-nums text-fg-secondary">{overallText(u.avgProOverall)}</dd>
              </div>
              <div>
                <dt className="text-fg-subtle">G / A</dt>
                <dd className="font-semibold tabular-nums text-fg-secondary">
                  {u.goals} / {u.assists}
                </dd>
              </div>
            </dl>
            <p className="text-[11px] text-fg-subtle">
              {fmtDateBR(u.firstPlayedAt)} até {fmtDateBR(u.lastPlayedAt)}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Linha do tempo das trocas de arquétipo (ordem cronológica, mais recente primeiro). */
export function ArchetypeTimeline({ changes, className = "" }: { changes: ArchetypeChange[]; className?: string }) {
  const ordered = [...changes].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  return (
    <ol className={`relative space-y-4 border-l border-border-strong ml-1.5 ${className}`} aria-label="Trocas de arquétipo">
      {ordered.map((c) => (
        <li key={`${c.matchId}-${c.to.id}`} className="pl-4 relative">
          <span aria-hidden="true" className="absolute -left-[5px] top-1.5 h-2 w-2 rounded-full bg-accent ring-2 ring-surface" />
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <time dateTime={c.at} className="text-xs font-semibold text-fg-muted tabular-nums">
              {fmtDateBR(c.at)}
            </time>
            <span className="inline-flex flex-wrap items-center gap-1.5">
              <ArchetypeBadge archetype={c.from} hideEmpty={!c.from} />
              {c.from ? (
                <span aria-hidden="true" className="text-fg-subtle">→</span>
              ) : (
                <span className="text-xs text-fg-subtle">passou a usar</span>
              )}
              <span className="sr-only">para</span>
              <ArchetypeBadge archetype={c.to} emphasis />
            </span>
            <Link to={`/match/${c.matchId}`} className="text-xs text-fg-subtle hover:text-accent underline underline-offset-2">
              Ver partida
            </Link>
          </div>
        </li>
      ))}
    </ol>
  );
}
