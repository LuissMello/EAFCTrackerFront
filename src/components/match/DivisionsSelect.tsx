import React from "react";
import { ChevronDown } from "lucide-react";
import { divisionCrestUrl, hideImgOnError } from "../../config/urls.ts";

export function DivisionsSelect({
  value,
  onChange,
  className = "",
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement | null>(null);

  // Fecha ao clicar fora / Escape (só enquanto aberto)
  React.useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const selectedUrl = divisionCrestUrl(value);
  const active = value != null;

  const baseBtn = `inline-flex items-center gap-1.5 h-9 pl-3 pr-2 rounded-lg border text-sm transition ${
    active ? "border-accent/60 bg-accent/5" : "border-border bg-surface-sunken hover:border-border-strong"
  }`;

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={baseBtn}
        title="Filtrar por divisão do adversário"
      >
        <span
          className={`text-[11px] font-semibold uppercase tracking-wide ${active ? "text-accent" : "text-fg-subtle"}`}
        >
          Div.
        </span>
        {selectedUrl ? (
          <img
            src={selectedUrl}
            onError={hideImgOnError}
            alt={value ? `Divisão ${value}` : "Todos"}
            width={24}
            height={24}
            className="h-6 w-6 object-contain"
            loading="lazy"
          />
        ) : (
          <span className="text-sm font-medium text-fg-secondary">Todos</span>
        )}
        <ChevronDown className="w-3.5 h-3.5 text-fg-subtle" />
      </button>

      {open && (
        <div role="listbox" className="absolute z-30 mt-1 w-[260px] rounded-lg border bg-surface p-2 shadow-lg">
          {/* Opção: Todos */}
          <button
            type="button"
            role="option"
            aria-selected={!value}
            className={`w-full text-left px-2 py-2 rounded hover:bg-surface-raised ${!value ? "bg-surface-raised" : ""}`}
            onClick={() => {
              onChange(null);
              setOpen(false);
            }}
          >
            Todos
          </button>

          <div className="mt-1 grid grid-cols-3 gap-2">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
              const url = divisionCrestUrl(n);
              return (
                <button
                  key={n}
                  type="button"
                  role="option"
                  aria-selected={value === n}
                  className={`flex items-center justify-center rounded border p-2 hover:bg-surface-raised ${
                    value === n ? "ring-2 ring-accent border-accent" : ""
                  }`}
                  onClick={() => {
                    onChange(n);
                    setOpen(false);
                  }}
                  title={`Divisão ${n}`}
                >
                  {url ? (
                    <img
                      src={url}
                      onError={hideImgOnError}
                      alt={`Divisão ${n}`}
                      width={32}
                      height={32}
                      className="h-8 w-8 object-contain"
                      loading="lazy"
                    />
                  ) : (
                    <span className="text-sm">D{n}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
