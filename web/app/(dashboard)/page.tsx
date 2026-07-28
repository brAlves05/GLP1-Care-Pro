import Link from 'next/link';
import {
  Users, Bell, CalendarDays, Activity, ArrowUpRight,
  AlertTriangle, Clock, TrendingDown, ChevronRight, Video,
} from 'lucide-react';
import { PATIENTS, ALERTS, APPOINTMENTS } from '@/lib/mock-data';
import { SeverityBadge, MedicationBadge, TreatmentStatusBadge } from '@/components/ui/badges';
import { Sparkline } from '@/components/charts/sparkline';

const STATS = [
  { label: 'Pacientes Ativos',       value: '24',  delta: '+3 este mês',           icon: Users,       bg: 'bg-blue-50',    color: 'text-blue-600',    trend: 'up' },
  { label: 'Alertas Abertos',         value: '4',   delta: '2 críticos agora',      icon: Bell,        bg: 'bg-red-50',     color: 'text-red-600',     trend: 'warn' },
  { label: 'Consultas esta semana',   value: '7',   delta: '3 presencial · 4 tele', icon: CalendarDays,bg: 'bg-violet-50',  color: 'text-violet-600',  trend: 'neutral' },
  { label: 'Adesão média à dose',     value: '88%', delta: '+4% vs. mês anterior',  icon: Activity,    bg: 'bg-emerald-50', color: 'text-emerald-600', trend: 'up' },
];

export default function DashboardPage() {
  const openAlerts    = ALERTS.filter((a) => !a.resolvedAt).slice(0, 4);
  const upcomingAppts = APPOINTMENTS.filter((a) => a.status !== 'COMPLETED').sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt)).slice(0, 4);

  return (
    <div className="p-6 space-y-6 max-w-[1400px]">
      {/* Saudação */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bom dia, Dr. Rafael 👋</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {new Date('2025-04-15').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <Link href="/appointments" className="btn-secondary">
          <CalendarDays className="w-4 h-4" /> Ver agenda completa
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {STATS.map(({ label, value, delta, icon: Icon, bg, color, trend }) => (
          <div key={label} className="card p-5">
            <div className="flex items-start justify-between mb-3">
              <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center`}>
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
              <ArrowUpRight className="w-4 h-4 text-gray-300" />
            </div>
            <p className="text-3xl font-bold text-gray-900 tabular-nums">{value}</p>
            <p className="text-sm font-medium text-gray-500 mt-0.5">{label}</p>
            <p className={`text-xs mt-1 font-medium ${trend === 'up' ? 'text-emerald-600' : trend === 'warn' ? 'text-red-500' : 'text-gray-400'}`}>{delta}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Pacientes */}
        <div className="xl:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-gray-900">Pacientes em Tratamento</h2>
            <Link href="/patients" className="text-sm text-blue-600 hover:underline flex items-center gap-1">
              Ver todos <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="card divide-y divide-gray-50">
            {PATIENTS.slice(0, 4).map((p) => (
              <Link key={p.id} href={`/patients/${p.id}`}
                className="flex items-center gap-4 p-4 hover:bg-gray-50/80 transition-colors">
                <div className={`w-10 h-10 rounded-full ${p.avatarColor} flex items-center justify-center flex-shrink-0`}>
                  <span className="text-white text-xs font-bold">{p.avatarInitials}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-gray-900">{p.name}</p>
                    <TreatmentStatusBadge status={p.treatment.status} />
                    {p.openAlerts > 0 && (
                      <span className="badge bg-red-50 text-red-600">
                        <AlertTriangle className="w-3 h-3" />{p.openAlerts} alerta{p.openAlerts > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    <MedicationBadge medication={p.treatment.medication} />
                    <span className="text-xs text-gray-400">{p.treatment.currentDose}</span>
                    <span className={`text-xs font-semibold flex items-center gap-1 ${p.biometrics.weightDeltaKg < 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      <TrendingDown className="w-3 h-3" />
                      {p.biometrics.weightDeltaKg > 0 ? '+' : ''}{p.biometrics.weightDeltaKg} kg
                    </span>
                  </div>
                </div>
                <div className="hidden sm:block flex-shrink-0">
                  <Sparkline data={p.weeklyWeights} color="#3b82f6" fillColor="rgba(59,130,246,0.08)" width={90} height={32} />
                </div>
                <div className="hidden md:block text-right flex-shrink-0">
                  <p className="text-base font-bold text-gray-900 tabular-nums">{p.biometrics.weightKg} kg</p>
                  <p className="text-xs text-gray-400">{p.lastCheckin}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
              </Link>
            ))}
          </div>
        </div>

        {/* Coluna direita */}
        <div className="space-y-4">
          {/* Alertas */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold text-gray-900">Alertas Recentes</h2>
              <Link href="/alerts" className="text-sm text-blue-600 hover:underline flex items-center gap-1">
                Ver todos <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <div className="card divide-y divide-gray-50">
              {openAlerts.map((a) => (
                <div key={a.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className={`w-4 h-4 flex-shrink-0 mt-0.5 ${a.severity === 'HIGH' ? 'text-red-500' : 'text-amber-500'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-xs font-semibold text-gray-700">{a.patientName}</p>
                        <SeverityBadge severity={a.severity} />
                      </div>
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2">{a.message}</p>
                      <p className="text-[11px] text-gray-400 mt-1">
                        {new Date(a.triggeredAt).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Próximas consultas */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold text-gray-900">Próximas Consultas</h2>
              <Link href="/appointments" className="text-sm text-blue-600 hover:underline flex items-center gap-1">
                Agenda <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <div className="card divide-y divide-gray-50">
              {upcomingAppts.map((a) => (
                <div key={a.id} className="p-4 flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full ${a.patientAvatarColor} flex items-center justify-center flex-shrink-0`}>
                    <span className="text-white text-[10px] font-bold">{a.patientAvatar}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{a.patientName}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <Clock className="w-3 h-3 text-gray-400" />
                      <p className="text-xs text-gray-500">
                        {new Date(a.scheduledAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} · {new Date(a.scheduledAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                      {a.isTeleconsult && <span className="badge bg-violet-50 text-violet-600"><Video className="w-2.5 h-2.5" /> Tele</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
