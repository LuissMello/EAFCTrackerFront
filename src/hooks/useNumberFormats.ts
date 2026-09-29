import { useMemo } from "react";

/** Formatadores pt-BR compartilhados: inteiro, 1 casa decimal (máx.) e 2 casas fixas. */
export function useNumberFormats() {
  const int = useMemo(() => new Intl.NumberFormat("pt-BR"), []);
  const p1 = useMemo(() => new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }), []);
  const p2 = useMemo(
    () => new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    []
  );
  return { int, p1, p2 };
}
