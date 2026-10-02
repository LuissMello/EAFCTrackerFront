import React, { useEffect, useId, useRef, useState } from "react";
import { Crest, Skeleton } from "../ui.tsx";
import { crestUrl } from "../../config/urls.ts";
import { SEARCH_MAX_RESULTS, SEARCH_MIN_CHARS, useOpponentSearch } from "../../hooks/useOpponentSearch.ts";
import { timesFacedLabel } from "../../utils/goalRegistration.ts";
import type { OpponentResult } from "../../types/goalRegistration.ts";
import { DivisionChip } from "./DivisionChip.tsx";
import { INPUT_CLS, TAG_CLS } from "./shared.ts";

const ResultCard = React.memo(function ResultCard({
  r,
  selected,
  onSelect,
}: {
  r: OpponentResult;
  selected: boolean;
  onSelect: (r: OpponentResult) => void;
}) {
  const faced = timesFacedLabel(r.timesFaced) ?? (r.source !== "ea" ? "Já enfrentamos" : null);
  const rec = r.record;
  return (
    <li>
      <button
        type="button"
        aria-pressed={selected}
        onClick={() => onSelect(r)}
        className={`flex w-full min-h-[64px] items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
          selected ? "border-accent bg-accent/10 ring-2 ring-accent/40" : "border-border bg-surface hover:border-accent/60 hover:bg-surface-raised"
        }`}
      >
        {r.crestAssetId || r.customCrestAssetId ? (
          <Crest
            src={crestUrl(r.crestAssetId ?? r.customCrestAssetId)}
            fallbackSrc={r.crestAssetId && r.customCrestAssetId ? crestUrl(r.customCrestAssetId) : null}
            size={40}
            rounded="rounded-lg"
          />
        ) : null}
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-base font-semibold text-fg">{r.name}</span>
            {selected && (
              <span className="flex-shrink-0 rounded-md bg-accent px-1.5 py-0.5 text-[11px] font-bold text-accent-fg">Selecionado</span>
            )}
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-1.5">
            <DivisionChip value={r.currentDivision} />
            {faced && <span className={TAG_CLS}>{faced}</span>}
            {r.source === "ea" && <span className={TAG_CLS}>da EA</span>}
            {rec && (
              <span className="text-[11px] font-medium tabular-nums text-fg-muted">
                J {rec.games} · V {rec.wins} · E {rec.draws} · D {rec.losses}
              </span>
            )}
          </span>
        </span>
      </button>
    </li>
  );
});

interface Props {
  clubId: number;
  selectedId: number | null;
  onSelect: (r: OpponentResult) => void;
  /** Foca o campo ao montar (ex.: depois de "Trocar adversário"). */
  autoFocus?: boolean;
  /** Painel da seleção atual (preview + botão OK), exibido entre o campo e a lista. */
  selectionSlot?: React.ReactNode;
}

/** Campo de busca do adversário (debounce 300 ms, >= 2 letras) + cards de resultado. */
export function OpponentSearch({ clubId, selectedId, onSelect, autoFocus = false, selectionSlot }: Props) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const hintId = useId();
  const { status, results, eaAvailable, eaTruncated, error, tooShort, term, retry } = useOpponentSearch(query, clubId);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  const statusText =
    status === "loading"
      ? "Buscando adversários…"
      : status === "done"
      ? results.length === 0
        ? `Nenhum time encontrado para “${term}”.`
        : `${results.length} ${results.length === 1 ? "time encontrado" : "times encontrados"}.`
      : "";

  return (
    <div>
      <label htmlFor={inputId} className="mb-1 block text-sm font-semibold text-fg-secondary">
        Nome do adversário
      </label>
      <input
        ref={inputRef}
        id={inputId}
        type="search"
        inputMode="search"
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        className={INPUT_CLS}
        placeholder="Digite o nome do time (mín. 2 letras)"
        value={query}
        maxLength={60}
        aria-describedby={hintId}
        onChange={(e) => setQuery(e.target.value)}
      />
      <p id={hintId} className="mt-1 text-xs text-fg-muted">
        {tooShort ? `Digite pelo menos ${SEARCH_MIN_CHARS} letras.` : "A busca da EA procura pelo começo do nome; times já enfrentados aparecem também por qualquer trecho."}
      </p>

      {selectionSlot}

      <div className="mt-3" aria-live="polite" aria-atomic="true">
        <p className={status === "loading" || status === "done" ? "text-sm text-fg-muted" : "sr-only"}>{statusText}</p>
      </div>

      {status === "loading" && (
        <ul className="mt-2 space-y-2" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <li key={i}>
              <Skeleton className="h-16 rounded-xl" />
            </li>
          ))}
        </ul>
      )}

      {status === "error" && (
        <div role="alert" className="mt-2 flex flex-wrap items-center gap-2 rounded-xl border border-negative/30 bg-negative-soft p-3 text-sm text-negative-fg">
          <span className="min-w-[12rem] flex-1">{error}</span>
          <button type="button" className="btn btn-secondary" onClick={retry}>
            Tentar de novo
          </button>
        </div>
      )}

      {status === "done" && !eaAvailable && (
        <p className="mt-2 rounded-xl border border-warning/40 bg-warning-soft p-3 text-sm text-warning-fg">
          Busca na EA indisponível; mostrando apenas adversários já enfrentados.
        </p>
      )}

      {status === "done" && eaAvailable && eaTruncated && (
        <p className="mt-2 text-xs text-fg-muted">Mostrando só os primeiros resultados da EA. Continue digitando para refinar.</p>
      )}

      {status === "done" && results.length === 0 && (
        <p className="mt-2 rounded-xl border border-dashed border-border-strong p-4 text-sm text-fg-muted">
          Nenhum time encontrado. Confira a grafia ou digite o começo do nome.
        </p>
      )}

      {status === "done" && results.length > 0 && (
        <ul className="mt-2 space-y-2" aria-label={`Resultados da busca (máx. ${SEARCH_MAX_RESULTS})`}>
          {results.map((r) => (
            <ResultCard key={r.clubId} r={r} selected={r.clubId === selectedId} onSelect={onSelect} />
          ))}
        </ul>
      )}
    </div>
  );
}
