'use client';
import clsx from 'clsx';
import type { AlertSeverity, TreatmentStatus, Medication } from '@/lib/mock-data';

export function SeverityBadge({ severity }: { severity: AlertSeverity }) {
  const map: Record<AlertSeverity, { label: string; cls: string; dot: string }> = {
    LOW:      { label: 'Baixo',   cls: 'bg-blue-50 text-blue-700',     dot: 'bg-blue-400' },
    MEDIUM:   { label: 'Médio',   cls: 'bg-amber-50 text-amber-700',   dot: 'bg-amber-400' },
    HIGH:     { label: 'Alto',    cls: 'bg-orange-50 text-orange-700', dot: 'bg-orange-500' },
    CRITICAL: { label: 'Crítico', cls: 'bg-red-50 text-red-700',       dot: 'bg-red-500' },
  };
  const { label, cls, dot } = map[severity];
  return (
    <span className={clsx('badge', cls)}>
      <span className={clsx('w-1.5 h-1.5 rounded-full', dot)} />{label}
    </span>
  );
}

export function TreatmentStatusBadge({ status }: { status: TreatmentStatus }) {
  const map: Record<TreatmentStatus, { label: string; cls: string }> = {
    ACTIVE:    { label: 'Ativo',      cls: 'bg-green-50 text-green-700' },
    PAUSED:    { label: 'Pausado',    cls: 'bg-amber-50 text-amber-700' },
    COMPLETED: { label: 'Concluído',  cls: 'bg-blue-50 text-blue-700' },
    ABANDONED: { label: 'Abandonado', cls: 'bg-gray-100 text-gray-500' },
  };
  const { label, cls } = map[status];
  return <span className={clsx('badge', cls)}>{label}</span>;
}

export function MedicationBadge({ medication }: { medication: Medication }) {
  const map: Record<Medication, { label: string; cls: string }> = {
    SEMAGLUTIDE: { label: 'Semaglutida', cls: 'bg-purple-100 text-purple-700' },
    TIRZEPATIDE: { label: 'Tirzepatida', cls: 'bg-cyan-100 text-cyan-700' },
    LIRAGLUTIDE: { label: 'Liraglutida', cls: 'bg-teal-100 text-teal-700' },
    OTHER:       { label: 'Outro',       cls: 'bg-gray-100 text-gray-600' },
  };
  const { label, cls } = map[medication];
  return <span className={clsx('badge', cls)}>{label}</span>;
}

export function AdherenceBar({ value }: { value: number }) {
  const bar = value >= 90 ? 'bg-green-500' : value >= 70 ? 'bg-amber-500' : 'bg-red-500';
  const txt = value >= 90 ? 'text-green-700' : value >= 70 ? 'text-amber-700' : 'text-red-700';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={clsx('h-full rounded-full', bar)} style={{ width: `${value}%` }} />
      </div>
      <span className={clsx('text-xs font-semibold tabular-nums', txt)}>{value}%</span>
    </div>
  );
}

export function AdherenceGauge({ value, size = 80 }: { value: number; size?: number }) {
  const sw = 8;
  const r = (size - sw) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * r;
  const progress = (value / 100) * circ;
  const color = value >= 90 ? '#22c55e' : value >= 70 ? '#f59e0b' : '#ef4444';
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f1f5f9" strokeWidth={sw} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={sw}
        strokeLinecap="round" strokeDasharray={`${progress} ${circ}`}
        transform={`rotate(-90 ${cx} ${cy})`} />
      <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="middle"
        fontSize={size * 0.2} fontWeight="700" fill={color}>{value}%</text>
    </svg>
  );
}
