import React from "react";
import { fmtNum } from "../../utils/analyticsFormat.ts";
import { formAriaLabel, ratingBand, validForm } from "../../utils/playerCards.ts";

/**
 * Últimas notas (a mais recente primeiro) como pontos coloridos COM o valor em texto.
 * Fica sobre uma placa escura fixa, então as cores têm o mesmo contraste em qualquer tier/tema.
 */
export const FormDots = React.memo(function FormDots({
  form,
  size = "sm",
  className = "",
}: {
  form: number[];
  size?: "sm" | "md";
  className?: string;
}) {
  const f = validForm(form);
  const dot = size === "md" ? "h-8 min-w-[2.25rem] px-1 text-xs" : "h-[22px] min-w-[1.4rem] px-[3px] text-[10px]";
  return (
    <div
      role="img"
      aria-label={formAriaLabel(f)}
      className={`inline-flex items-center gap-[2px] rounded-full bg-[rgba(11,18,32,0.82)] px-1 py-1 ${className}`}
    >
      {f.length === 0 ? (
        <span className="px-2 text-[10px] font-semibold text-slate-300">sem notas recentes</span>
      ) : (
        f.map((n, i) => (
          <span
            key={i}
            aria-hidden="true"
            title={i === 0 ? "Mais recente" : undefined}
            className={`inline-flex items-center justify-center rounded-full font-bold tabular-nums text-[#0b1220] ${dot}`}
            style={{ background: ratingBand(n).bg }}
          >
            {fmtNum(n, 1)}
          </span>
        ))
      )}
    </div>
  );
});

/** Mini gráfico de linha das últimas notas (da mais antiga para a mais recente). */
export const FormSparkline = React.memo(function FormSparkline({ form }: { form: number[] }) {
  const f = validForm(form).slice().reverse();
  if (f.length < 2) return null;
  const w = 160;
  const h = 44;
  const pad = 6;
  const min = Math.min(5, ...f);
  const max = Math.max(9, ...f);
  const x = (i: number) => pad + (i * (w - pad * 2)) / (f.length - 1);
  const y = (v: number) => h - pad - ((v - min) / (max - min)) * (h - pad * 2);
  const d = f.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      role="img"
      aria-label={`Evolução das últimas notas, da mais antiga para a mais recente: ${f.map((n) => fmtNum(n, 1)).join(", ")}`}
      className="h-11 w-40 max-w-full"
    >
      <path d={d} fill="none" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" style={{ stroke: "rgb(var(--color-accent))" }} />
      {f.map((v, i) => (
        <circle key={i} cx={x(i)} cy={y(v)} r={3} style={{ fill: "rgb(var(--color-surface))", stroke: "rgb(var(--color-accent))" }} strokeWidth={2} />
      ))}
    </svg>
  );
});
