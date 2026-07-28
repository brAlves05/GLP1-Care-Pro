import { CalendarDays, Clock, Video, MapPin, ChevronRight, UserPlus, Filter } from 'lucide-react';
import { APPOINTMENTS } from '@/lib/mock-data';

const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

const TODAY = new Date('2025-04-15');
const YEAR  = TODAY.getFullYear();
const MONTH = TODAY.getMonth();

function buildCalendarDays() {
  const firstDay = new Date(YEAR, MONTH, 1).getDay();
  const daysInMonth = new Date(YEAR, MONTH + 1, 0).getDate();
  const cells: (number | null)[] = Array.from({ length: firstDay }, () => null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

const APPT_DAYS = new Set(
  APPOINTMENTS.map((a) => new Date(a.scheduledAt).getDate()),
);

const STATUS_STYLES: Record<string, string> = {
  SCHEDULED:  'bg-blue-50 text-blue-700',
  CONFIRMED:  'bg-violet-50 text-violet-700',
  COMPLETED:  'bg-emerald-50 text-emerald-700',
  CANCELLED:  'bg-gray-100 text-gray-400',
};

const STATUS_LABELS: Record<string, string> = {
  SCHEDULED: 'Agendada',
  CONFIRMED: 'Confirmada',
  COMPLETED: 'Realizada',
  CANCELLED: 'Cancelada',
};

export default function AppointmentsPage() {
  const cells    = buildCalendarDays();
  const upcoming = APPOINTMENTS.filter((a) => a.status !== 'COMPLETED' && a.status !== 'CANCELLED')
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
  const past     = APPOINTMENTS.filter((a) => a.status === 'COMPLETED' || a.status === 'CANCELLED')
    .sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt));

  return (
    <div className="p-6 space-y-6 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Agenda</h1>
          <p className="text-gray-500 text-sm mt-0.5">{upcoming.length} consulta{upcoming.length !== 1 ? 's' : ''} aguardando</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-secondary"><Filter className="w-4 h-4" /> Filtrar</button>
          <button className="btn-primary"><UserPlus className="w-4 h-4" /> Nova Consulta</button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Mini calendar */}
        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-900">{MONTHS[MONTH]} {YEAR}</h2>
            <div className="flex items-center gap-1">
              <button className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 text-sm">‹</button>
              <button className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 text-sm">›</button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-0.5 text-center">
            {DAYS.map((d) => (
              <div key={d} className="text-[10px] font-semibold text-gray-400 py-1">{d}</div>
            ))}
            {cells.map((day, i) => {
              if (!day) return <div key={`e-${i}`} />;
              const isToday  = day === TODAY.getDate();
              const hasAppt  = APPT_DAYS.has(day);
              return (
                <button key={day}
                  className={`relative w-8 h-8 rounded-lg text-xs font-medium mx-auto flex items-center justify-center transition-colors
                    ${isToday ? 'bg-blue-600 text-white' : 'hover:bg-gray-100 text-gray-700'}`}>
                  {day}
                  {hasAppt && !isToday && (
                    <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-blue-400" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-600 inline-block" />
              <span className="text-[11px] text-gray-500">Hoje</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />
              <span className="text-[11px] text-gray-500">Com consulta</span>
            </div>
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            {[
              { label: 'Este mês', value: APPOINTMENTS.length },
              { label: 'Tele', value: APPOINTMENTS.filter((a) => a.isTeleconsult).length },
              { label: 'Presencial', value: APPOINTMENTS.filter((a) => !a.isTeleconsult).length },
              { label: 'Concluídas', value: APPOINTMENTS.filter((a) => a.status === 'COMPLETED').length },
            ].map(({ label, value }) => (
              <div key={label} className="bg-gray-50 rounded-xl p-3">
                <p className="text-xl font-bold text-gray-900 tabular-nums">{value}</p>
                <p className="text-[11px] text-gray-500 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Appointment list */}
        <div className="xl:col-span-2 space-y-5">
          {/* Upcoming */}
          <div>
            <h2 className="text-base font-bold text-gray-900 mb-3">Próximas</h2>
            <div className="space-y-3">
              {upcoming.map((appt) => {
                const dt = new Date(appt.scheduledAt);
                return (
                  <div key={appt.id} className="card p-4 flex items-center gap-4">
                    {/* Date block */}
                    <div className="w-14 flex-shrink-0 text-center bg-blue-50 rounded-xl py-2 px-1">
                      <p className="text-[11px] font-semibold text-blue-500 uppercase">
                        {dt.toLocaleDateString('pt-BR', { month: 'short' })}
                      </p>
                      <p className="text-2xl font-bold text-blue-700 leading-none">{dt.getDate()}</p>
                    </div>

                    {/* Avatar */}
                    <div className={`w-10 h-10 rounded-full ${appt.patientAvatarColor} flex items-center justify-center flex-shrink-0`}>
                      <span className="text-white text-[11px] font-bold">{appt.patientAvatar}</span>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900">{appt.patientName}</p>
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        <span className="flex items-center gap-1 text-xs text-gray-500">
                          <Clock className="w-3 h-3" />
                          {dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {appt.isTeleconsult
                          ? <span className="badge bg-violet-50 text-violet-600"><Video className="w-2.5 h-2.5" /> Teleconsulta</span>
                          : <span className="badge bg-gray-100 text-gray-600"><MapPin className="w-2.5 h-2.5" /> Presencial</span>
                        }
                        <span className={`badge ${STATUS_STYLES[appt.status]}`}>{STATUS_LABELS[appt.status]}</span>
                      </div>
                      {appt.notes && <p className="text-xs text-gray-400 mt-1 truncate">{appt.notes}</p>}
                    </div>

                    <button className="btn-secondary py-1.5 text-xs flex-shrink-0">
                      Detalhes <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Past */}
          {past.length > 0 && (
            <div>
              <h2 className="text-base font-bold text-gray-900 mb-3">Histórico Recente</h2>
              <div className="card divide-y divide-gray-50">
                {past.map((appt) => {
                  const dt = new Date(appt.scheduledAt);
                  return (
                    <div key={appt.id} className="p-4 flex items-center gap-3 opacity-70">
                      <div className={`w-9 h-9 rounded-full ${appt.patientAvatarColor} flex items-center justify-center flex-shrink-0`}>
                        <span className="text-white text-[10px] font-bold">{appt.patientAvatar}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800">{appt.patientName}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <CalendarDays className="w-3 h-3 text-gray-400" />
                          <p className="text-xs text-gray-500">
                            {dt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </p>
                          <span className={`badge text-[10px] ${STATUS_STYLES[appt.status]}`}>{STATUS_LABELS[appt.status]}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
