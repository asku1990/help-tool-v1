'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type Segment = {
  date: string;
  lPer100: number;
};

export default function ConsumptionChart({ segments }: { segments: Segment[] }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState<number>(600);
  const height = 180;
  const padding = 16;

  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        if (w && Number.isFinite(w)) setWidth(Math.max(320, Math.floor(w)));
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { points, yVals, yMin, yRange, avg, avgY, pathD, gridYs } = useMemo(() => {
    const pts = segments.map((s, i) => ({ x: i, y: s.lPer100, date: s.date }));
    const xMax = Math.max(1, pts.length - 1);
    const yvRaw = pts.map(p => p.y).filter(Number.isFinite);
    const hasData = yvRaw.length > 0;
    const yv = hasData ? yvRaw : [0];
    const ymin = hasData ? Math.min(...yv) : 0;
    const ymax = hasData ? Math.max(...yv) : 1;
    const yrange = ymax - ymin || 1;
    const toX = (i: number) => padding + (i / xMax) * (width - padding * 2);
    const toY = (v: number) => padding + (1 - (v - ymin) / yrange) * (height - padding * 2);
    const d = pts
      .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${toX(p.x).toFixed(2)} ${toY(p.y).toFixed(2)}`)
      .join(' ');
    const a = yv.reduce((acc, b) => acc + b, 0) / (yv.length || 1);
    const ay = toY(a);
    const gridStep = Math.max(1, Math.round(yrange / 4));
    const gridValues: number[] = [];
    for (let v = Math.floor(ymin); v <= Math.ceil(ymax); v += gridStep) gridValues.push(v);
    return {
      points: pts,
      yVals: hasData ? yvRaw : [],
      yMin: ymin,
      yRange: yrange,
      avg: a,
      avgY: ay,
      pathD: d,
      gridYs: gridValues.map(v => ({ v, y: toY(v) })),
    };
  }, [segments, width]);

  if (!segments.length) {
    return <div className="text-sm text-gray-500">No consumption data yet.</div>;
  }

  return (
    <div ref={containerRef} className="bg-white p-4 rounded-xl shadow-sm border">
      <div className="text-sm font-medium mb-2">Consumption trend (L/100km)</div>
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Fuel consumption trend chart"
      >
        <rect x="0" y="0" width={width} height={height} fill="white" />
        {gridYs.map(g => (
          <g key={g.v}>
            <line x1={padding} y1={g.y} x2={width - padding} y2={g.y} stroke="#f1f5f9" />
            <text x={padding - 6} y={g.y + 3} fontSize="10" textAnchor="end" fill="#64748b">
              {g.v.toFixed(0)}
            </text>
          </g>
        ))}
        <line
          x1={padding}
          y1={avgY}
          x2={width - padding}
          y2={avgY}
          stroke="#e5e7eb"
          strokeDasharray="4 4"
        />
        <path d={pathD} fill="none" stroke="#2563eb" strokeWidth="2" />
        {points.map((p, i) => {
          const x = padding + (i / Math.max(1, points.length - 1)) * (width - padding * 2);
          const y = padding + (1 - (p.y - yMin) / (yRange || 1)) * (height - padding * 2);
          return (
            <g key={i}>
              <circle cx={x} cy={y} r={3} fill="#2563eb">
                <title>
                  {new Date(p.date).toLocaleDateString()}: {p.y.toFixed(2)} L/100km
                </title>
              </circle>
            </g>
          );
        })}
      </svg>
      <div className="text-xs text-gray-500 mt-2">
        Avg: {avg.toFixed(2)} L/100km • Min: {Math.min(...yVals).toFixed(2)} • Max:{' '}
        {Math.max(...yVals).toFixed(2)}
      </div>
    </div>
  );
}
