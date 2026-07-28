'use client';

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  fillColor?: string;
}

export function Sparkline({ data, width = 120, height = 36, color = '#3b82f6', fillColor }: SparklineProps) {
  if (data.length < 2) return null;
  const pad = 2;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const xStep = (width - pad * 2) / (data.length - 1);
  const points = data.map((v, i) => ({
    x: pad + i * xStep,
    y: pad + ((max - v) / range) * (height - pad * 2),
  }));
  const polyline = points.map((p) => `${p.x},${p.y}`).join(' ');
  const areaPath = fillColor
    ? `M${points[0]!.x},${height} ${points.map((p) => `L${p.x},${p.y}`).join(' ')} L${points.at(-1)!.x},${height} Z`
    : null;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} fill="none" aria-hidden>
      {areaPath && <path d={areaPath} fill={fillColor} />}
      <polyline points={polyline} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={points.at(-1)!.x} cy={points.at(-1)!.y} r="3" fill={color} />
    </svg>
  );
}
