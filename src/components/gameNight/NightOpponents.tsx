import React from "react";
import { Card } from "../ui.tsx";
import { OpponentCrest, VedChip } from "../analytics/Controls.tsx";
import type { NightOpponentRow } from "../../types/gameNight";
import { plural } from "../../utils/analyticsFormat.ts";

export default function NightOpponents({ opponents }: { opponents: NightOpponentRow[] }) {
  if (opponents.length === 0) return null;
  return (
    <section aria-labelledby="night-opponents-title">
      <h3 id="night-opponents-title" className="text-sm font-semibold text-fg-muted uppercase tracking-wide mb-3">
        Adversários da noite
      </h3>
      <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2.5">
        {opponents.map((o, i) => (
          <li key={`${o.opponentClubId}-${i}`}>
            <Card className="p-3 flex items-center gap-3">
              <OpponentCrest
                crestAssetId={o.crestAssetId}
                customCrestAssetId={o.customCrestAssetId}
                name={o.name}
                size={36}
              />
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-fg truncate" title={o.name ?? undefined}>
                  {o.name?.trim() || "Adversário"}
                </div>
                <div className="text-xs text-fg-muted">
                  {o.matches} {plural(o.matches, "jogo", "jogos")}
                </div>
              </div>
              <VedChip wins={o.wins} draws={o.draws} losses={o.losses} />
            </Card>
          </li>
        ))}
      </ul>
    </section>
  );
}
