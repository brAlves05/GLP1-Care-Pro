import Link from 'next/link';
import { Search, Filter, UserPlus, ChevronRight, TrendingDown, AlertTriangle } from 'lucide-react';
import { PATIENTS } from '@/lib/mock-data';
import { TreatmentStatusBadge, MedicationBadge, AdherenceBar } from '@/components/ui/badges';
import { Sparkline } from '@/components/charts/sparkline';

export default function PatientsPage() {
  return (
    <div className="p-6 space-y-6 max-w-[1400px]">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pacientes</h1>
          <p className="text-gray-500 text-sm mt-0.5">{PATIENTS.length} pacientes em acompanhamento</p>
        </div>
        <button className="btn-primary"><UserPlus className="w-4 h-4" /> Novo Paciente</button>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="search" placeholder="Buscar por nome ou e-mail..." className="input pl-10" />
        </div>
        <button className="btn-secondary"><Filter className="w-4 h-4" /> Filtros</button>
        {['Todos', 'Semaglutida', 'Tirzepatida', 'Liraglutida', 'Com alertas'].map((f, i) => (
          <button key={f} className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${i === 0 ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>{f}</button>
        ))}
      </div>

      {/* Tabela */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-100">
                {['Paciente', 'Medicamento', 'Dose Atual', 'Peso Atual', 'Variação', 'Evolução 8 sem.', 'Adesão', 'Status', 'Alertas', ''].map((h) => (
                  <th key={h} className="text-left px-4 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {PATIENTS.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50/50 transition-colors group">
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-full ${p.avatarColor} flex items-center justify-center flex-shrink-0`}>
                        <span className="text-white text-[11px] font-bold">{p.avatarInitials}</span>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900 whitespace-nowrap">{p.name}</p>
                        <p className="text-xs text-gray-400">{p.age} anos · {p.sex === 'F' ? 'Feminino' : 'Masculino'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4"><MedicationBadge medication={p.treatment.medication} /></td>
                  <td className="px-4 py-4">
                    <span className="text-sm font-semibold text-gray-700 tabular-nums">{p.treatment.currentDose}</span>
                    <p className="text-xs text-gray-400 mt-0.5">Sem. {p.treatment.weeksOnTreatment}</p>
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-sm font-bold text-gray-900 tabular-nums">{p.biometrics.weightKg} kg</span>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`flex items-center gap-1 text-sm font-bold tabular-nums whitespace-nowrap ${p.biometrics.weightDeltaKg < 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      <TrendingDown className="w-3.5 h-3.5" />
                      {p.biometrics.weightDeltaKg > 0 ? '+' : ''}{p.biometrics.weightDeltaKg} kg
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <Sparkline data={p.weeklyWeights} color="#3b82f6" fillColor="rgba(59,130,246,0.06)" width={100} height={30} />
                  </td>
                  <td className="px-4 py-4 min-w-[120px]"><AdherenceBar value={p.treatment.adherence} /></td>
                  <td className="px-4 py-4"><TreatmentStatusBadge status={p.treatment.status} /></td>
                  <td className="px-4 py-4">
                    {p.openAlerts > 0
                      ? <span className="badge bg-red-50 text-red-600"><AlertTriangle className="w-3 h-3" />{p.openAlerts}</span>
                      : <span className="text-gray-300 text-xs">—</span>}
                  </td>
                  <td className="px-4 py-4">
                    <Link href={`/patients/${p.id}`} className="opacity-0 group-hover:opacity-100 transition-opacity btn-secondary py-1.5 text-xs whitespace-nowrap">
                      Ver perfil <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3.5 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between">
          <p className="text-xs text-gray-400">{PATIENTS.length} pacientes exibidos</p>
          <div className="flex items-center gap-1">
            {[1, 2, 3].map((n) => (
              <button key={n} className={`w-7 h-7 rounded-lg text-xs font-medium transition-colors ${n === 1 ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-100'}`}>{n}</button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
