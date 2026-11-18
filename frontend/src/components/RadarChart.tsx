interface RadarChartProps {
  scores: { label: string; value: number }[];
  size?: number;
}

export default function RadarChart({ scores, size = 220 }: RadarChartProps) {
  const center = size / 2;
  const radius = size / 2 - 30;
  const n = scores.length;
  const angleStep = (2 * Math.PI) / n;

  const point = (i: number, r: number) => {
    const angle = i * angleStep - Math.PI / 2;
    return {
      x: center + r * Math.cos(angle),
      y: center + r * Math.sin(angle),
    };
  };

  const gridLevels = [0.25, 0.5, 0.75, 1];
  const dataPoints = scores.map((s, i) => point(i, (s.value / 100) * radius));
  const dataPath = dataPoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ") + " Z";

  return (
    <svg width={size} height={size} className="mx-auto">
      {gridLevels.map((level) => {
        const pts = scores.map((_, i) => point(i, radius * level));
        const d = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ") + " Z";
        return (
          <path key={level} d={d} fill="none" stroke="rgba(15, 23, 42, 0.1)" strokeWidth={1} />
        );
      })}
      {scores.map((s, i) => {
        const outer = point(i, radius);
        const label = point(i, radius + 18);
        return (
          <g key={s.label}>
            <line x1={center} y1={center} x2={outer.x} y2={outer.y} stroke="rgba(15, 23, 42, 0.1)" />
            <text
              x={label.x}
              y={label.y}
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-ink-muted text-[10px] font-semibold"
            >
              {s.label}
            </text>
          </g>
        );
      })}
      <path d={dataPath} fill="rgba(8, 145, 178, 0.16)" stroke="#0891b2" strokeWidth={2.2} />
      {dataPoints.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r={5} fill="white" stroke="#0891b2" strokeWidth={2} />
          <circle cx={p.x} cy={p.y} r={2} fill="#0891b2" />
        </g>
      ))}
    </svg>
  );
}
