import React from "react";
import { Skeleton } from "../ui.tsx";
import type { PlayerCard } from "../../types/playerCards";
import { PlayerCardButton, type CardSlot } from "./PlayerCard.tsx";

/** 2 colunas no celular (1 coluna só em telas minúsculas), crescendo até 5. */
const GRID_CLASS =
  "grid grid-cols-2 max-[339px]:grid-cols-1 gap-3.5 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5";

export const CardGrid = React.memo(function CardGrid({
  cards,
  crestAssetId,
  clubName,
  compareMode,
  slotOf,
  onSelect,
  label,
}: {
  cards: PlayerCard[];
  crestAssetId?: string | null;
  clubName?: string | null;
  compareMode: boolean;
  slotOf: (playerEntityId: number) => CardSlot;
  onSelect: (card: PlayerCard) => void;
  label: string;
}) {
  return (
    <ul aria-label={label} className={`${GRID_CLASS} pt-2`}>
      {cards.map((c) => (
        <li key={c.playerEntityId} className="min-w-0">
          <PlayerCardButton
            card={c}
            crestAssetId={crestAssetId}
            clubName={clubName}
            slot={slotOf(c.playerEntityId)}
            compareMode={compareMode}
            onSelect={onSelect}
          />
        </li>
      ))}
    </ul>
  );
});

export function CardGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className={`${GRID_CLASS} pt-2`} aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className="h-[17.5rem] rounded-2xl" />
      ))}
    </div>
  );
}
