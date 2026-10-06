import React from "react";
import type { ArchetypeRef, ArchetypeUsage } from "../../types/archetypes.ts";
import { ArchetypeBadge } from "./ArchetypeBadge.tsx";
import { principalOf, usagesTitle } from "../../utils/archetypeFilters.ts";

/**
 * Selo do arquétipo de um jogador num recorte: o principal (mais jogos) e, quando houve mais de um,
 * um "+N" cujo title lista todos (jogos e %). Compacto por padrão para caber sob/ao lado do nome.
 */
export const PlayerArchetype: React.FC<{
  archetype?: ArchetypeRef | null;
  archetypes?: ArchetypeUsage[] | null;
  compact?: boolean;
  hideEmpty?: boolean;
  className?: string;
  layout?: "inline" | "responsive";
}> = ({ archetype, archetypes, compact = true, hideEmpty = true, className = "", layout = "inline" }) => {
  const main = principalOf({ archetype, archetypes });
  const many = archetypes && archetypes.length > 1 ? archetypes : null;
  const detail = many ? `Usou ${many.length} arquétipos:\n${usagesTitle(many)}` : undefined;
  if (!main) return hideEmpty ? null : <ArchetypeBadge archetype={null} className={className} />;
  return (
    <span className={`inline-flex flex-wrap items-center gap-1 align-middle ${className}`}>
      <ArchetypeBadge archetype={main} compact={compact} detail={detail} layout={layout} className={layout === "responsive" ? "" : "!px-1.5 !py-0 !text-[11px] leading-[1.15rem]"} />
      {many && (
        <span
          className="inline-flex flex-shrink-0 items-center whitespace-nowrap rounded-full border border-border-strong bg-surface px-1 text-[10px] font-semibold leading-[1.1rem] text-fg-muted"
          title={detail}
          aria-label={`Mais ${many.length - 1} ${many.length - 1 === 1 ? "arquétipo usado" : "arquétipos usados"}`}
        >
          +{many.length - 1}
        </span>
      )}
    </span>
  );
};

export default PlayerArchetype;
