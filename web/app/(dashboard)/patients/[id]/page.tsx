import Link from 'next/link';
import {
  ArrowLeft, Activity, Syringe, CalendarDays, MessageSquare,
  TrendingDown, AlertTriangle, CheckCircle2, Clock, Video,
  Heart, Ruler, ChevronRight, ClipboardList,
} from 'lucide-react';
import { PATIENTS, APPOINTMENTS, ALERTS, MEDICATION_BRAND } from '@/lib/mock-data';
import { SeverityBadge, TreatmentStatusBadge, MedicationBadge, AdherenceBar, AdherenceGauge } from '@/components/ui/badges';
import { Sparkline } from '@/components/charts/sparkline';

const CHECKINS = [
  { week: 'Semana 28', date: '14/04', nausea: 2, vomit: 0, constipation: 1, fatigue: 3, energy: 7, appetite: 5, weight: 88.4 },
  { week: 'Semana 27', date: '07/04', nausea: 3, vomit: 1, constipation: 2, fatigue: 3, energy: 6, appetite: 4, weight: 89.0 },
  { week: 'Semana 26', date: '31/03', nausea: 1, vomit: 0, constipation: 1, fatigue: 2, energy: 8, appetite: 5, weight: 89.7 },
];

function ScoreBar({ value }: { value: number }) {
  const color = value <= 3 ? 'bg-green-400' : value <= 6 ? 'bg-amber-400' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${value * 10}%` }} />
      </div>
      <span className="text-xs font-semibold tabular-nums text-gray-600 w-4 text-right">{value}</span>
    </div>
  );
}

export default function PatientDetailPage({ params }: { params: { id: string } }) {
  const patient = PATIENTS.find((p) => p.id === params.id) ?? PATIENTS[0]!;
  const alerts  = ALERTS.filter((a) => a.patientId === patient.id && !a.resolvedAt);
  const nextAppt = APPOINTMENTS.find((a) => a.patientId === patient.id);

  return (
    <div className="p-6 space-y-6 max-w-[1400px]">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <Link href="/patients" className="text-gray-400 hover:text-gray-600 flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> Pacientes
        </Link>
        <span className="text-gray-300">/</span>
        <span className="text-gray-700 font-medium">{patient.name}</span>
      </div>

      {/* Header */}
      <div className="card p-6">
        <div className="flex items-start gap-5 flex-wrap">
          <div className={`w-16 h-16 rounded-2xl ${patient.avatarColor} flex items-center justify-center flex-shrink-0`}>
            <span className="text-white text-xl font-bold">{patient.avatarInitials}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-bold text-gray-900">{patient.name}</h1>
              <TreatmentStatusBadge status={patient.treatment.status} />
              {alerts.length > 0 && (
                <span className="badge bg-red-50 text-red-600">
                  <AlertTriangle className="w-3 h-3" /> {alerts.length} alerta{alerts.length > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <p className="text-gray-500 text-sm mt-1">{patient.email}</p>
            <div className="flex items-center gap-4 mt-2 flex-wrap text-sm text-gray-500">
              <span>{patient.age} anos · {patient.sex === 'F' ? 'Feminino' : 'Masculino'}</span>
              <span className="text-gray-200">|</span>
              <span>Semana {patient.treatment.weeksOnTreatment} de tratamento</span>
              <span className="text-gray-200">|</span>
              <span>Último check-in: {patient.lastCheckin}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="btn-secondary"><MessageSquare className="w-4 h-4" /> Mensagem</button>
            <button className="btn-primary"><CalendarDays className="w-4 h-4" /> Agendar</button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Coluna principal */}
        <div className="xl:col-span-2 space-y-6">

          {/* Tratamento */}
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Syringe className="w-4 h-4 text-blue-600" />
              <h2 className="text-base font-bold text-gray-900">Tratamento Atual</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-xs text-gray-500 mb-1">Medicamento</p>
                <MedicationBadge medication={patient.treatment.medication} />
                <p className="text-[11px] text-gray-400 mt-1">{MEDICATION_BRAND[patient.treatment.medication]}</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-xs text-gray-500 mb-1">Dose Atual</p>
                <p className="text-lg font-bold text-gray-900">{patient.treatment.currentDose}</p>
                <p className="text-[11px] text-gray-400">subcut. / semana</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-xs text-gray-500 mb-1">Início</p>
                <p className="text-sm font-bold text-gray-900">{new Date(patient.treatment.startDate).toLocaleDateString('pt-BR')}</p>
                <p className="text-[11px] text-gray-400">{patient.treatment.weeksOnTreatment} semanas</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-xs text-gray-500 mb-2">Adesão à Dose</p>
                <AdherenceBar value={patient.treatment.adherence} />
              </div>
            </div>
            {/* Protocolo */}
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-xs font-semibold text-gray-500 mb-3">Protocolo de Escalonamento</p>
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {[
                  { w: '1–4 sem', dose: '0,25 mg', done: true, curr: false },
                  { w: '5–8 sem', dose: '0,5 mg',  done: true, curr: true },
                  { w: '9–12 sem',dose: '1 mg',    done: false, curr: false },
                  { w: '13+ sem', dose: '2 mg',    done: false, curr: false },
                ].map((s, i, arr) => (
                  <div key={s.w} className="flex items-center gap-2 flex-shrink-0">
                    <div className={`px-3 py-2 rounded-xl border-2 text-center ${s.curr ? 'border-blue-500 bg-blue-50' : s.done ? 'border-green-400 bg-green-50' : 'border-gray-200 bg-white'}`}>
                      <span className={`text-xs font-bold block ${s.curr ? 'text-blue-600' : s.done ? 'text-green-600' : 'text-gray-400'}`}>{s.dose}</span>
                      <span className="text-[10px] text-gray-400">{s.w}</span>
                    </div>
                    {i < arr.length - 1 && <ChevronRight className="w-3 h-3 text-gray-300 flex-shrink-0" />}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Evolução de peso */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-blue-600" />
                <h2 className="text-base font-bold text-gray-900">Evolução do Peso</h2>
              </div>
              <span className={`text-sm font-bold flex items-center gap-1 ${patient.biometrics.weightDeltaKg < 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                <TrendingDown className="w-4 h-4" />
                {patient.biometrics.weightDeltaKg > 0 ? '+' : ''}{patient.biometrics.weightDeltaKg} kg total
              </span>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 mb-4">
              <Sparkline data={patient.weeklyWeights} color="#3b82f6" fillColor="rgba(59,130,246,0.1)" width={640} height={100} />
              <div className="flex justify-between mt-2">
                {['Sem 21','Sem 22','Sem 23','Sem 24','Sem 25','Sem 26','Sem 27','Hoje'].map((w) => (
                  <span key={w} className="text-[10px] text-gray-400">{w}</span>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Peso Inicial', value: `${patient.weeklyWeights[0]} kg`, cls: 'bg-gray-50 text-gray-700', lCls: 'text-gray-500' },
                { label: 'Peso Atual',   value: `${patient.biometrics.weightKg} kg`, cls: 'bg-blue-50 text-blue-700', lCls: 'text-blue-500' },
                { label: 'Perda Total',  value: `${Math.abs(patient.biometrics.weightDeltaKg)} kg`, cls: 'bg-emerald-50 text-emerald-700', lCls: 'text-emerald-600' },
              ].map(({ label, value, cls, lCls }) => (
                <div key={label} className={`text-center p-3 rounded-xl ${cls.split(' ')[0]}`}>
                  <p className={`text-xs ${lCls}`}>{label}</p>
                  <p className={`text-lg font-bold tabular-nums mt-0.5 ${cls.split(' ')[1]}`}>{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Check-ins */}
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <ClipboardList className="w-4 h-4 text-blue-600" />
              <h2 className="text-base font-bold text-gray-900">Check-ins Semanais</h2>
            </div>
            <div className="space-y-3">
              {CHECKINS.map((c) => (
                <div key={c.week} className="border border-gray-100 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-gray-700">{c.week}</span>
                      <span className="text-xs text-gray-400">{c.date}</span>
                    </div>
                    <span className="text-sm font-bold text-gray-900 tabular-nums">{c.weight} kg</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2">
                    {[['Náusea', c.nausea], ['Vômito', c.vomit], ['Constipação', c.constipation], ['Fadiga', c.fatigue], ['Energia', c.energy], ['Apetite', c.appetite]].map(([label, val]) => (
                      <div key={label as string}>
                        <span className="text-[11px] text-gray-500 block mb-0.5">{label}</span>
                        <ScoreBar value={val as number} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Coluna direita */}
        <div className="space-y-5">
          {/* Biométricas */}
          <div className="card p-5">
            <h2 className="text-base font-bold text-gray-900 mb-4">Biométricas</h2>
            <div className="space-y-3">
              {[
                { icon: Activity, bg: 'bg-blue-50', color: 'text-blue-600', label: 'Glicemia de Jejum', value: `${patient.biometrics.glucoseMgDl} mg/dL`, warn: (patient.biometrics.glucoseMgDl ?? 0) > 130 },
                { icon: Heart,    bg: 'bg-red-50',  color: 'text-red-600',  label: 'Pressão Arterial', value: `${patient.biometrics.bpSystolic}/${patient.biometrics.bpDiastolic} mmHg`, warn: (patient.biometrics.bpSystolic ?? 0) > 140 },
                { icon: Ruler,    bg: 'bg-violet-50', color: 'text-violet-600', label: 'Circunf. Abdominal', value: `${patient.biometrics.waistCm} cm`, warn: false },
              ].map(({ icon: Icon, bg, color, label, value, warn }) => (
                <div key={label} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50/80">
                  <div className={`w-8 h-8 ${bg} rounded-lg flex items-center justify-center flex-shrink-0`}>
                    <Icon className={`w-4 h-4 ${color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-gray-500">{label}</p>
                    <p className="text-sm font-bold text-gray-900 tabular-nums">{value}</p>
                  </div>
                  {warn ? <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" /> : <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />}
                </div>
              ))}
            </div>
          </div>

          {/* Gauge adesão */}
          <div className="card p-5">
            <h2 className="text-base font-bold text-gray-900 mb-4">Adesão ao Tratamento</h2>
            <div className="flex items-center gap-4">
              <AdherenceGauge value={patient.treatment.adherence} size={80} />
              <div>
                <p className="text-xs text-gray-500">das doses foram aplicadas</p>
                <p className="text-xs text-gray-400 mt-1">últimas 8 semanas</p>
                {patient.treatment.adherence >= 90 && (
                  <span className="badge bg-green-50 text-green-700 mt-2"><CheckCircle2 className="w-3 h-3" /> Excelente</span>
                )}
              </div>
            </div>
          </div>

          {/* Alertas */}
          {alerts.length > 0 && (
            <div className="card p-5">
              <h2 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500" /> Alertas Abertos
              </h2>
              <div className="space-y-3">
                {alerts.map((a) => (
                  <div key={a.id} className="p-3 bg-red-50 rounded-xl border border-red-100">
                    <div className="flex items-center justify-between mb-1">
                      <SeverityBadge severity={a.severity} />
                      <span className="text-[10px] text-gray-400">{new Date(a.triggeredAt).toLocaleDateString('pt-BR')}</span>
                    </div>
                    <p className="text-xs text-gray-700 mt-1">{a.message}</p>
                    <button className="mt-2 text-xs text-blue-600 hover:underline">Reconhecer</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Próxima consulta */}
          {nextAppt && (
            <div className="card p-5">
              <h2 className="text-base font-bold text-gray-900 mb-3 flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-blue-600" /> Próxima Consulta
              </h2>
              <div className="p-3 bg-blue-50 rounded-xl">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="w-3.5 h-3.5 text-blue-600" />
                  <span className="text-sm font-bold text-blue-900">
                    {new Date(nextAppt.scheduledAt).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </span>
                </div>
                <p className="text-sm text-blue-700">
                  {new Date(nextAppt.scheduledAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  {nextAppt.isTeleconsult && <span className="ml-2 badge bg-violet-100 text-violet-600"><Video className="w-2.5 h-2.5" /> Tele</span>}
                </p>
                {nextAppt.notes && <p className="text-xs text-blue-600 mt-2 italic">{nextAppt.notes}</p>}
              </div>
              <button className="btn-secondary w-full mt-3 justify-center text-xs">Ver pré-relatório</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
