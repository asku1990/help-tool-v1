'use client';

type Segment = {
  date: string;
  lPer100: number;
};

export default function ConsumptionChart({ segments }: { segments: Segment[] }) {
  if (!segments.length)
    return <div className="text-sm text-gray-500">No consumption data yet.</div>;

  const width = 600;
  const height = 160;
  const padding = 16;
  const points = segments.map((s, i) => ({ x: i, y: s.lPer100 }));
  const xMax = Math.max(1, points.length - 1);
  const yVals = points.map(p => p.y).filter(Number.isFinite);
  const yMin = Math.min(...yVals);
  const yMax = Math.max(...yVals);
  const yRange = yMax - yMin || 1;

  const toX = (i: number) => padding + (i / xMax) * (width - padding * 2);
  const toY = (v: number) => padding + (1 - (v - yMin) / yRange) * (height - padding * 2);

  const d = points
    .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${toX(p.x).toFixed(2)} ${toY(p.y).toFixed(2)}`)
    .join(' ');

  const avg = yVals.reduce((a, b) => a + b, 0) / yVals.length;
  const avgY = toY(avg);

  return (
    <div className="bg-white p-4 rounded-xl shadow-sm border">
      <div className="text-sm font-medium mb-2">Consumption trend</div>
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Fuel consumption trend chart"
      >
        <rect x="0" y="0" width={width} height={height} fill="white" />
        {/* average line */}
        <line
          x1={padding}
          y1={avgY}
          x2={width - padding}
          y2={avgY}
          stroke="#e5e7eb"
          strokeDasharray="4 4"
        />
        {/* path */}
        <path d={d} fill="none" stroke="#2563eb" strokeWidth="2" />
        {/* points */}
        {points.map((p, i) => (
          <circle key={i} cx={toX(p.x)} cy={toY(p.y)} r={3} fill="#2563eb" />
        ))}
      </svg>
      <div className="text-xs text-gray-500 mt-2">
        Avg: {avg.toFixed(2)} L/100km • Min: {Math.min(...yVals).toFixed(2)} • Max:{' '}
        {Math.max(...yVals).toFixed(2)}
      </div>
    </div>
  );
}
