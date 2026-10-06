import React from "react";
import {
  Hand,
  Footprints,
  ArrowUpRight,
  Shield,
  Cog,
  Swords,
  Recycle,
  Music2,
  Lightbulb,
  Zap,
  WandSparkles,
  Crosshair,
  Target,
  CircleHelp,
  type LucideIcon,
} from "lucide-react";
import type { ArchetypeGroup, ArchetypeRef } from "../../types/archetypes.ts";
import { ARCHETYPE_ICON_DATA } from "./archetypeIconData.ts";

/**
 * Ícone de cada arquétipo (conjunto próprio em traço, herda a cor do texto — funciona em claro/escuro).
 * Chave = archetypeid da EA (1..13). Ids sem ícone caem no ícone do grupo de posição, ou no genérico.
 *   1 Shot Stopper · 2 Sweeper Keeper · 3 Progressor · 4 Boss · 5 Disruptor · 6 Marauder · 7 Recycler
 *   8 Maestro · 9 Creator · 10 Spark · 11 Magician · 12 Finisher · 13 Target
 */
const BY_ID: Record<number, LucideIcon> = {
  1: Hand,
  2: Footprints,
  3: ArrowUpRight,
  4: Shield,
  5: Cog,
  6: Swords,
  7: Recycle,
  8: Music2,
  9: Lightbulb,
  10: Zap,
  11: WandSparkles,
  12: Crosshair,
  13: Target,
};

const BY_GROUP: Record<ArchetypeGroup, LucideIcon> = {
  GOLEIRO: Hand,
  DEFESA: Shield,
  MEIO: Cog,
  ATAQUE: Target,
};

export function archetypeIconFor(a: Pick<ArchetypeRef, "id" | "positionGroup"> | null | undefined): LucideIcon {
  if (!a) return CircleHelp;
  return BY_ID[a.id] ?? (a.positionGroup ? BY_GROUP[a.positionGroup] : CircleHelp);
}

/**
 * Ícone decorativo (o nome acessível fica no elemento pai: title/aria-label do selo).
 * Ids 1..13 usam a arte oficial (vetor inline, herda a cor do texto); os demais caem nos ícones de traço.
 */
export const ArchetypeIcon: React.FC<{
  archetype: Pick<ArchetypeRef, "id" | "positionGroup"> | null | undefined;
  size?: number;
  className?: string;
}> = ({ archetype, size = 16, className = "" }) => {
  const data = archetype ? ARCHETYPE_ICON_DATA[archetype.id] : undefined;
  if (data) {
    return (
      <svg
        viewBox={data.viewBox}
        width={size}
        height={size}
        fill="currentColor"
        aria-hidden="true"
        focusable="false"
        className={`shrink-0 ${className}`}
        dangerouslySetInnerHTML={{ __html: data.inner }}
      />
    );
  }
  const Icon = archetypeIconFor(archetype);
  return <Icon size={size} strokeWidth={2} aria-hidden="true" focusable="false" className={`shrink-0 ${className}`} />;
};

export default ArchetypeIcon;
