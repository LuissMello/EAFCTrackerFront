import React, { useId } from "react";
import { SelectField } from "../match/SelectField.tsx";
import { Field, FIELD_CLASS } from "../ui.tsx";
import { ArchetypeFilterSelect } from "./ArchetypeFilterSelect.tsx";
import { POSITION_FILTER_OPTIONS, parsePositionParam, type ArchetypeOption } from "../../utils/archetypeFilters.ts";
import type { ArchetypeFilterValue } from "../../hooks/useArchetypeFilter.ts";

/**
 * Filtro combinado "Posição" + "Arquétipo".
 * - Posição: Todas | Goleiro | Zagueiro | Meia | Atacante.
 * - Arquétipo: "Todos" + uma opção por arquétipo. `archetypeOptions` deve vir JÁ restrito à posição escolhida
 *   (sem posição: todos os arquétipos). Trocar a posição zera o arquétipo.
 * - `variant="pill"` (barras de filtro) ou `"field"` (grade de formulário).
 */
export function PositionArchetypeFilter({
  value,
  onChange,
  archetypeOptions,
  showCount = false,
  countUnit,
  variant = "pill",
  className = "",
  positionValues = null,
}: {
  value: ArchetypeFilterValue;
  onChange: (next: ArchetypeFilterValue) => void;
  archetypeOptions: ArchetypeOption[];
  showCount?: boolean;
  countUnit?: [string, string];
  variant?: "pill" | "field";
  className?: string;
  /** Se informado, a Posição lista só estes grupos (a escolhida continua visível para poder ser limpa). */
  positionValues?: string[] | null;
}) {
  const id = useId();
  const items = (
    <>
      <option value="">Todas</option>
      {POSITION_FILTER_OPTIONS.filter((o) => positionValues === null || positionValues.includes(o.value) || o.value === value.positionGroup).map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </>
  );
  const handlePos = (e: React.ChangeEvent<HTMLSelectElement>) =>
    onChange({ positionGroup: parsePositionParam(e.target.value), archetypeId: null });
  const handleArq = (arq: number | null) => onChange({ positionGroup: value.positionGroup, archetypeId: arq });

  return (
    <div className={`flex flex-wrap items-end gap-2 ${className}`} role="group" aria-label="Filtro de posição e arquétipo">
      {variant === "field" ? (
        <Field label="Posição" htmlFor={id}>
          <select id={id} className={FIELD_CLASS} value={value.positionGroup ?? ""} onChange={handlePos}>
            {items}
          </select>
        </Field>
      ) : (
        <SelectField label="Posição" active={value.positionGroup !== null} value={value.positionGroup ?? ""} onChange={handlePos}>
          {items}
        </SelectField>
      )}
      <ArchetypeFilterSelect
        options={archetypeOptions}
        value={value.archetypeId}
        onChange={handleArq}
        showCount={showCount}
        countUnit={countUnit}
        variant={variant}
        label="Arquétipo"
      />
    </div>
  );
}

export default PositionArchetypeFilter;
