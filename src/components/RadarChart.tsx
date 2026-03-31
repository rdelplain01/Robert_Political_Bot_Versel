"use client";

import { useMemo } from "react";

type RadarChartProps = {
  /** Values keyed by label, each 1-5 (disabled traits should be omitted or set to 0) */
  data: { label: string; value: number }[];
  size?: number;
};

export default function RadarChart({ data, size = 200 }: RadarChartProps) {
  const cx = size / 2;
  const cy = size / 2;
  const maxR = size / 2 - 24; // leave room for labels
  const levels = 5;

  const angleStep = (2 * Math.PI) / data.length;

  // helper: polar to cartesian
  const polar = (angle: number, radius: number) => ({
    x: cx + radius * Math.sin(angle),
    y: cy - radius * Math.cos(angle),
  });

  // grid rings
  const rings = useMemo(
    () =>
      Array.from({ length: levels }, (_, i) => {
        const r = (maxR / levels) * (i + 1);
        return data
          .map((_, j) => {
            const p = polar(j * angleStep, r);
            return `${p.x},${p.y}`;
          })
          .join(" ");
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.length, maxR]
  );

  // data polygon
  const dataPoints = data.map((d, i) => {
    const r = (d.value / levels) * maxR;
    return polar(i * angleStep, r);
  });
  const dataPoly = dataPoints.map((p) => `${p.x},${p.y}`).join(" ");

  // axis lines
  const axes = data.map((_, i) => {
    const end = polar(i * angleStep, maxR);
    return { x1: cx, y1: cy, x2: end.x, y2: end.y };
  });

  // labels
  const labels = data.map((d, i) => {
    const p = polar(i * angleStep, maxR + 14);
    // shorten long labels
    const short = d.label.length > 6 ? d.label.slice(0, 5) + "…" : d.label;
    return { ...p, text: short, full: d.label };
  });

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      className="drop-shadow-lg"
    >
      <defs>
        <radialGradient id="radarFill" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#818cf8" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#6366f1" stopOpacity="0.12" />
        </radialGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Grid rings */}
      {rings.map((pts, i) => (
        <polygon
          key={`ring-${i}`}
          points={pts}
          fill="none"
          stroke="rgba(148,163,184,0.12)"
          strokeWidth={1}
        />
      ))}

      {/* Axis lines */}
      {axes.map((a, i) => (
        <line
          key={`axis-${i}`}
          {...a}
          stroke="rgba(148,163,184,0.1)"
          strokeWidth={1}
        />
      ))}

      {/* Data polygon */}
      <polygon
        points={dataPoly}
        fill="url(#radarFill)"
        stroke="#818cf8"
        strokeWidth={2}
        filter="url(#glow)"
        strokeLinejoin="round"
      />

      {/* Data points */}
      {dataPoints.map((p, i) => (
        <circle
          key={`pt-${i}`}
          cx={p.x}
          cy={p.y}
          r={3.5}
          fill="#a5b4fc"
          stroke="#6366f1"
          strokeWidth={1.5}
        />
      ))}

      {/* Labels */}
      {labels.map((l, i) => (
        <text
          key={`lbl-${i}`}
          x={l.x}
          y={l.y}
          textAnchor="middle"
          dominantBaseline="middle"
          className="fill-slate-400 text-[9px] font-medium"
        >
          <title>{l.full}</title>
          {l.text}
        </text>
      ))}
    </svg>
  );
}
