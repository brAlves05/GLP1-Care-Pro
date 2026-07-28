import { AlertTriangle, CheckCircle2, Clock, Filter, Bell, ShieldAlert, Activity } from 'lucide-react';
import { ALERTS } from '@/lib/mock-data';
import { SeverityBadge } from '@/components/ui/badges';

const SEVERITY_COUNTS = {
  HIGH:   ALERTS.filter((a) => a.severity === 'HIGH'   && !a.resolvedAt).length,
  MEDIUM: ALERTS.filter((a) => a.severity === 'MEDIUM' && !a.resolvedAt).length,
  LOW:    ALERTS.filter((a) => a.severity === 'LOW'    && !a.resolvedAt).length,
};

const STAT_CARDS = [
  { label: 'Críticos',    value: SEVERITY_COUNTS.HIGH,   icon: ShieldAlert,  bg: 'bg-red-50',    color: 'text-red-600',    border: 'border-red-100' },
  { label: 'Moderados',   value: SEVERITY_COUNTS.MEDIUM, icon: AlertTriangle,bg: 'bg-amber-50',  color: 'text-amber-600',  border: 'border-amber-100' },
  { label: 'Baixos',      value: SEVERITY_COUNTS.LOW,    icon: Bell,         bg: 'bg-blue-50',   color: 'text-blue-600',   border: 'border-blue-100' },
  { label: 'Resolvidos',  value: ALERTS.filter((a) => a.resolvedAt).length, icon: CheckCircle2, bg: 'bg-emerald-50', color: 'text-emerald-600', border: 'border-emerald-100' },
];

const TYPE_LABELS: Record<string, string> = {
  SYMPTOM_SCORE:       'Score de Sintomas',
  MISSED_DOSE:         'Dose Não Registrada',
  ADHERENCE_DROP:      'Queda de Adesão',
  WEIGHT_PLATEAU:      'Platô de Peso',
  GLUCOSE_SPIKE:       'Pico Glicêmico',
  APPOINTMENT_MISSED:  'Consulta Perdida',
};

export default function AlertsPage() {
  const open     = ALERTS.filter((a) => !a.resolvedAt);
  const resolved = ALERTS.filter((a) =>  a.resolvedAt);

  return (
    <div className="p-6 space-y-6 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Alertas Clínicos</h1>
          <p className="text-gray-500 text-sm mt-0.5">{open.length} alerta{open.length !== 1 ? 's' : ''} pendente{open.length !== 1 ? 's' : ''}</p>
        </div>
        <button className="btn-secondary"><Filter className="w-4 h-4" /> Filtrar</button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {STAT_CARDS.map(({ label, value, icon: Icon, bg, color, border }) => (
          <div key={label} className={`card p-5 border ${border}`}>
            <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center mb-3`}>
              <Icon className={`w-5 h-5 ${color}`} />
            </div>
            <p className="text-3xl font-bold text-gray-900 tabular-nums">{value}</p>
            <p className="text-sm text-gray-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Open alerts */}
        <div className="xl:col-span-2 space-y-3">
          <h2 className="text-base font-bold text-gray-900">Alertas Abertos</h2>
          {open.length === 0 && (
            <div className="card p-10 flex flex-col items-center gap-3 text-center">
              <CheckCircle2 className="w-10 h-10 text-emerald-400" />
              <p className="text-gray-500 text-sm">Nenhum alerta aberto — tudo em dia!</p>
            </div>
          )}
          {open.map((alert) => (
            <div key={alert.id}
              className={`card p-5 border-l-4 ${alert.severity === 'HIGH' ? 'border-l-red-500' : alert.severity === 'MEDIUM' ? 'border-l-amber-400' : 'border-l-blue-400'}`}>
              <div className="flex items-start gap-4">
                <div className={`w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center ${alert.severity === 'HIGH' ? 'bg-red-50' : alert.severity === 'MEDIUM' ? 'bg-amber-50' : 'bg-blue-50'}`}>
                  <AlertTriangle className={`w-4 h-4 ${alert.severity === 'HIGH' ? 'text-red-500' : alert.severity === 'MEDIUM' ? 'text-amber-500' : 'text-blue-500'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className="text-sm font-semibold text-gray-900">{alert.patientName}</p>
                    <SeverityBadge severity={alert.severity} />
                    <span className="badge bg-gray-100 text-gray-600">{TYPE_LABELS[alert.type] ?? alert.type}</span>
                  </div>
                  <p className="text-sm text-gray-600">{alert.message}</p>
                  <div className="flex items-center gap-1.5 mt-2 text-xs text-gray-400">
                    <Clock className="w-3 h-3" />
                    {new Date(alert.triggeredAt).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                <div className="flex flex-col gap-2 flex-shrink-0">
                  <button className="btn-primary py-1.5 text-xs whitespace-nowrap">Avaliar</button>
                  <button className="btn-secondary py-1.5 text-xs whitespace-nowrap">Ignorar</button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Resolved + Activity */}
        <div className="space-y-4">
          <h2 className="text-base font-bold text-gray-900">Resolvidos Recentemente</h2>
          <div className="card divide-y divide-gray-50">
            {resolved.length === 0 && (
              <p className="p-5 text-xs text-gray-400 text-center">Nenhum alerta resolvido</p>
            )}
            {resolved.map((alert) => (
              <div key={alert.id} className="p-4 flex items-start gap-3 opacity-70">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-gray-700">{alert.patientName}</p>
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{alert.message}</p>
                  {alert.resolvedAt && (
                    <p className="text-[11px] text-gray-400 mt-1">
                      Resolvido {new Date(alert.resolvedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Summary */}
          <div className="card p-4 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <Activity className="w-4 h-4 text-blue-600" />
              <h3 className="text-sm font-bold text-gray-900">Resumo 7 dias</h3>
            </div>
            {[
              { label: 'Alertas disparados',  value: '12' },
              { label: 'Tempo médio resolução', value: '4h 23min' },
              { label: 'Taxa de resolução',    value: '83%' },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between">
                <p className="text-xs text-gray-500">{label}</p>
                <p className="text-xs font-bold text-gray-800">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
