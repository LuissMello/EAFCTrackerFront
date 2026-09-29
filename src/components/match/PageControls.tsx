/** Controles de paginação (definido fora da página: dentro do componente seria recriado — e remontado — a cada render). */
export function PageControls({
  page,
  pageSize,
  totalPages,
  totalCount,
  hasNext,
  hasPrev,
  onPageSize,
  onGoTo,
  onNext,
  onPrev,
}: {
  page: number;
  pageSize: number;
  totalPages: number;
  totalCount: number;
  hasNext: boolean;
  hasPrev: boolean;
  onPageSize: (n: number) => void;
  onGoTo: (p: number) => void;
  onNext: () => void;
  onPrev: () => void;
}) {
  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4">
      <div className="flex items-center gap-2 text-sm">
        <label htmlFor="home-page-size" className="text-fg-muted">
          Itens por página:
        </label>
        <select
          id="home-page-size"
          className="border rounded-lg px-2 py-2 bg-surface text-fg"
          value={pageSize}
          onChange={(e) => onPageSize(Number(e.target.value))}
        >
          {[10, 20, 30, 50, 100, 200].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>
      <div className="text-sm text-fg-muted">
        Página <span className="font-semibold">{totalPages ? page : 0}</span> de{" "}
        <span className="font-semibold">{totalPages}</span> — {totalCount} partidas
      </div>
      <div className="flex items-center gap-2">
        <button type="button" className="btn btn-secondary" onClick={() => onGoTo(1)} disabled={!hasPrev}>
          « Primeira
        </button>
        <button type="button" className="btn btn-secondary" onClick={onPrev} disabled={!hasPrev}>
          ‹ Anterior
        </button>
        <button type="button" className="btn btn-secondary" onClick={onNext} disabled={!hasNext}>
          Próxima ›
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => onGoTo(totalPages)} disabled={!hasNext}>
          Última »
        </button>
      </div>
    </div>
  );
}
