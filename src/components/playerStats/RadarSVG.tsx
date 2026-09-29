import React from "react";
import { clamp01to100 } from "../../utils/number.ts";

/** Radar em SVG (sem libs) */
export function RadarSVG({ data }: { data: { group: string; value: number }[] }) {
  const size = 260;
  const center = size / 2;
  const radius = 100;
  const points = Math.max(3, data.length);

  const angleFor = (i: number) => (Math.PI * 2 * i) / points - Math.PI / 2;
  const toXY = (r: number, angle: number) => ({ x: center + r * Math.cos(angle), y: center + r * Math.sin(angle) });

  const webLines = Array.from({ length: 5 }).map((_, ring) => {
    const r = radius * ((ring + 1) / 5);
    const d =
      data
        .map((_, i) => {
          const a = angleFor(i);
          const { x, y } = toXY(r, a);
          return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
        })
        .join(" ") + " Z";
    return <path key={ring} d={d} fill="none" className="stroke-border" strokeWidth={1} />;
  });

  const spokes = data.map((_, i) => {
    const a = angleFor(i);
    const { x, y } = toXY(radius, a);
    return <line key={i} x1={center} y1={center} x2={x} y2={y} className="stroke-border" strokeWidth={1} />;
  });

  const polygon =
    data
      .map((d, i) => {
        const a = angleFor(i);
        const r = (clamp01to100(d.value) / 100) * radius;
        const { x, y } = toXY(r, a);
        return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(" ") + " Z";

  return (
    <div className="w-full flex items-center justify-center">
      <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-sm">
        <g>{webLines}</g>
        <g>{spokes}</g>
        <path d={polygon} className="fill-accent stroke-accent" fillOpacity={0.25} strokeWidth={2} />
        {data.map((d, i) => {
          const a = angleFor(i);
          const { x, y } = toXY(radius + 16, a);
          return (
            <text
              key={i}
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-fg-muted text-[10px]"
            >
              {d.group}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
