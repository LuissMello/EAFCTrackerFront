import React, { useId } from "react";
import { SelectField } from "../match/SelectField.tsx";
import { Field, FIELD_CLASS } from "../ui.tsx";
import { withSelected, type ArchetypeOption } from "../../utils/archetypeFilters.ts";

/**
 * Filtro "Arquétipo". Opções sempre vindas dos dados/backend; `value = null` = "Todos".
 * Se o id da URL não estiver nas opções ele continua visível, para poder ser removido.
 * - `variant="pill"` (padrão): pill compacta no padrão das barras de filtro (Cartas, chips).
 * - `variant="field"`: rótulo + select de formulário (grade de filtros das Estatísticas).
 */
export function ArchetypeFilterSelect({
  options,
  value,
  onChange,
  label = "Arquétipo",
  title,
  showCount = false,
  countUnit,
  variant = "pill",
  className = "",
}: {
  options: ArchetypeOption[];
  value: number | null;
  onChange: (id: number | null) => void;
  label?: string;
  title?: string;
  showCount?: boolean;
  /** Unidade da contagem nas opções (singular, plural). Sem ela: "(n)". */
  countUnit?: [string, string];
  variant?: "pill" | "field";
  className?: string;
}) {
  const id = useId();
  const opts = withSelected(options, value);
  const items = (
    <>
      <option value="">Todos</option>
      {opts.map((o) => (
        <option key={o.id} value={o.id}>
          {o.label}
          {showCount && o.count > 0 ? (countUnit ? ` · ${o.count} ${o.count === 1 ? countUnit[0] : countUnit[1]}` : ` (${o.count})`) : ""}
        </option>
      ))}
    </>
  );
  const handle = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const v = e.target.value;
    onChange(v === "" ? null : Number(v));
  };

  if (variant === "field") {
    return (
      <Field label={label} htmlFor={id} className={className}>
        <select id={id} className={FIELD_CLASS} value={value ?? ""} onChange={handle} title={title}>
          {items}
        </select>
      </Field>
    );
  }
  return (
    <SelectField label={label} title={title} active={value !== null} value={value ?? ""} onChange={handle}>
      {items}
    </SelectField>
  );
}

export default ArchetypeFilterSelect;

/** Aviso sob o filtro de arquétipo das Estatísticas: explica a semântica (principal; números não são recalculados). */
export function ArchetypeFilterNote({
  label,
  shown,
  total,
  className = "",
}: {
  label: string;
  shown: number;
  total: number;
  className?: string;
}) {
  return (
    <p role="status" className={`text-xs text-fg-muted ${className}`}>
      Filtro: <strong className="text-fg-secondary">{label}</strong> (posição e arquétipo da linha; quem jogou assim em algum jogo aparece, e &quot;Separar por arquétipo&quot; mostra só essa fatia) —{" "}
      {shown} de {total} {total === 1 ? "jogador" : "jogadores"}. Os números de cada jogador continuam somando todos os jogos do recorte.
    </p>
  );
}
