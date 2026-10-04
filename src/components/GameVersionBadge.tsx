import React from "react";
import { gameVersionLabel } from "../hooks/useGameVersions.tsx";

/** Selo pequeno com a versão do jogo (ex.: "FC26"). Não renderiza nada quando a versão é desconhecida. */
export const GameVersionBadge = React.memo(function GameVersionBadge({
  version,
  className = "",
}: {
  version?: number | null;
  className?: string;
}) {
  if (version === null || version === undefined) return null;
  return (
    <span
      title={`Versão do jogo: ${gameVersionLabel(version)}`}
      className={`inline-flex items-center px-1.5 py-0.5 rounded border border-accent/30 bg-accent/10 text-accent text-[11px] font-semibold leading-none tabular-nums ${className}`}
    >
      {gameVersionLabel(version)}
    </span>
  );
});
