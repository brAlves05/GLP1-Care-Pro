export type AlertSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type TreatmentStatus = 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'ABANDONED';
export type Medication = 'SEMAGLUTIDE' | 'TIRZEPATIDE' | 'LIRAGLUTIDE' | 'OTHER';
export type AppointmentStatus = 'SCHEDULED' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';

export interface Patient {
  id: string;
  name: string;
  email: string;
  age: number;
  sex: 'F' | 'M';
  avatarInitials: string;
  avatarColor: string;
  treatment: {
    medication: Medication;
    currentDose: string;
    status: TreatmentStatus;
    startDate: string;
    weeksOnTreatment: number;
    adherence: number;
  };
  biometrics: {
    weightKg: number;
    weightDeltaKg: number;
    glucoseMgDl?: number;
    bpSystolic?: number;
    bpDiastolic?: number;
    waistCm?: number;
  };
  lastCheckin: string;
  openAlerts: number;
  nextAppointment: string | null;
  weeklyWeights: number[];
}

export interface ClinicalAlert {
  id: string;
  patientId: string;
  patientName: string;
  type: string;
  severity: AlertSeverity;
  message: string;
  triggeredAt: string;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
}

export interface Appointment {
  id: string;
  patientId: string;
  patientName: string;
  patientAvatar: string;
  patientAvatarColor: string;
  type: 'INITIAL' | 'RETURN' | 'URGENCY';
  status: AppointmentStatus;
  scheduledAt: string;
  notes?: string;
  isTeleconsult: boolean;
}

export interface ConversationPreview {
  id: string;
  from: string;
  fromInitials: string;
  fromColor: string;
  preview: string;
  time: string;
  unread: number;
  isPatient: boolean;
}

export const PATIENTS: Patient[] = [
  {
    id: 'pat_01', name: 'Maria Santos', email: 'maria.santos@email.com',
    age: 45, sex: 'F', avatarInitials: 'MS', avatarColor: 'bg-violet-500',
    treatment: { medication: 'SEMAGLUTIDE', currentDose: '0,5 mg', status: 'ACTIVE', startDate: '2024-09-10', weeksOnTreatment: 28, adherence: 96 },
    biometrics: { weightKg: 88.4, weightDeltaKg: -9.2, glucoseMgDl: 112, bpSystolic: 128, bpDiastolic: 82, waistCm: 96 },
    lastCheckin: 'há 1 dia', openAlerts: 0, nextAppointment: '2025-04-18',
    weeklyWeights: [97.6, 96.8, 95.4, 94.1, 92.8, 91.3, 89.7, 88.4],
  },
  {
    id: 'pat_02', name: 'João Silva', email: 'joao.silva@email.com',
    age: 52, sex: 'M', avatarInitials: 'JS', avatarColor: 'bg-sky-500',
    treatment: { medication: 'TIRZEPATIDE', currentDose: '5 mg', status: 'ACTIVE', startDate: '2024-11-03', weeksOnTreatment: 20, adherence: 78 },
    biometrics: { weightKg: 104.1, weightDeltaKg: -6.3, glucoseMgDl: 145, bpSystolic: 142, bpDiastolic: 91, waistCm: 108 },
    lastCheckin: 'há 2 dias', openAlerts: 2, nextAppointment: '2025-04-16',
    weeklyWeights: [110.4, 109.8, 108.5, 107.2, 106.8, 106.1, 105.0, 104.1],
  },
  {
    id: 'pat_03', name: 'Ana Oliveira', email: 'ana.oliveira@email.com',
    age: 38, sex: 'F', avatarInitials: 'AO', avatarColor: 'bg-emerald-500',
    treatment: { medication: 'LIRAGLUTIDE', currentDose: '1,2 mg', status: 'PAUSED', startDate: '2024-07-15', weeksOnTreatment: 36, adherence: 91 },
    biometrics: { weightKg: 72.8, weightDeltaKg: -4.6, glucoseMgDl: 98, bpSystolic: 118, bpDiastolic: 76, waistCm: 84 },
    lastCheckin: 'há 5 dias', openAlerts: 1, nextAppointment: '2025-04-22',
    weeklyWeights: [77.4, 76.9, 76.2, 75.8, 74.9, 74.1, 73.5, 72.8],
  },
  {
    id: 'pat_04', name: 'Carlos Ferreira', email: 'carlos.ferreira@email.com',
    age: 60, sex: 'M', avatarInitials: 'CF', avatarColor: 'bg-amber-500',
    treatment: { medication: 'SEMAGLUTIDE', currentDose: '1 mg', status: 'ACTIVE', startDate: '2025-01-06', weeksOnTreatment: 14, adherence: 85 },
    biometrics: { weightKg: 118.5, weightDeltaKg: -5.1, glucoseMgDl: 168, bpSystolic: 136, bpDiastolic: 88, waistCm: 118 },
    lastCheckin: 'há 3 dias', openAlerts: 1, nextAppointment: '2025-04-19',
    weeklyWeights: [123.6, 122.9, 122.1, 121.4, 120.6, 119.8, 119.1, 118.5],
  },
  {
    id: 'pat_05', name: 'Fernanda Lima', email: 'fernanda.lima@email.com',
    age: 42, sex: 'F', avatarInitials: 'FL', avatarColor: 'bg-rose-500',
    treatment: { medication: 'TIRZEPATIDE', currentDose: '2,5 mg', status: 'ACTIVE', startDate: '2025-02-10', weeksOnTreatment: 9, adherence: 100 },
    biometrics: { weightKg: 95.2, weightDeltaKg: -3.3, glucoseMgDl: 131, bpSystolic: 124, bpDiastolic: 80, waistCm: 101 },
    lastCheckin: 'hoje', openAlerts: 0, nextAppointment: '2025-04-25',
    weeklyWeights: [98.5, 98.1, 97.4, 97.0, 96.5, 96.0, 95.6, 95.2],
  },
];

export const ALERTS: ClinicalAlert[] = [
  { id: 'alert_01', patientId: 'pat_02', patientName: 'João Silva', type: 'SINTOMA_SEVERO', severity: 'HIGH', message: 'Náusea com intensidade 8/10 e vômito 7/10 reportados no check-in semanal.', triggeredAt: '2025-04-13T09:22:00Z', acknowledgedAt: null, resolvedAt: null },
  { id: 'alert_02', patientId: 'pat_02', patientName: 'João Silva', type: 'PA_ELEVADA', severity: 'MEDIUM', message: 'Pressão arterial 142/91 mmHg registrada em biométrica manual.', triggeredAt: '2025-04-12T14:05:00Z', acknowledgedAt: '2025-04-12T16:30:00Z', resolvedAt: null },
  { id: 'alert_03', patientId: 'pat_03', patientName: 'Ana Oliveira', type: 'ADESAO_BAIXA', severity: 'MEDIUM', message: 'Tratamento em pausa há 12 dias sem justificativa clínica registrada.', triggeredAt: '2025-04-10T08:00:00Z', acknowledgedAt: null, resolvedAt: null },
  { id: 'alert_04', patientId: 'pat_04', patientName: 'Carlos Ferreira', type: 'GLICEMIA_ALTA', severity: 'HIGH', message: 'Glicemia de jejum 168 mg/dL — acima da meta terapêutica de 130 mg/dL.', triggeredAt: '2025-04-14T07:30:00Z', acknowledgedAt: null, resolvedAt: null },
  { id: 'alert_05', patientId: 'pat_01', patientName: 'Maria Santos', type: 'META_ATINGIDA', severity: 'LOW', message: 'Paciente atingiu perda de 9 kg (9,4% do peso inicial). Considerar escalonamento.', triggeredAt: '2025-04-11T11:15:00Z', acknowledgedAt: '2025-04-11T12:00:00Z', resolvedAt: '2025-04-11T12:00:00Z' },
];

export const APPOINTMENTS: Appointment[] = [
  { id: 'appt_01', patientId: 'pat_02', patientName: 'João Silva', patientAvatar: 'JS', patientAvatarColor: 'bg-sky-500', type: 'RETURN', status: 'CONFIRMED', scheduledAt: '2025-04-16T09:00:00', notes: 'Avaliar sintomas GI reportados no último check-in.', isTeleconsult: false },
  { id: 'appt_02', patientId: 'pat_04', patientName: 'Carlos Ferreira', patientAvatar: 'CF', patientAvatarColor: 'bg-amber-500', type: 'RETURN', status: 'SCHEDULED', scheduledAt: '2025-04-19T10:30:00', isTeleconsult: true },
  { id: 'appt_03', patientId: 'pat_01', patientName: 'Maria Santos', patientAvatar: 'MS', patientAvatarColor: 'bg-violet-500', type: 'RETURN', status: 'SCHEDULED', scheduledAt: '2025-04-18T14:00:00', notes: 'Revisar escalonamento para 1mg.', isTeleconsult: false },
  { id: 'appt_04', patientId: 'pat_05', patientName: 'Fernanda Lima', patientAvatar: 'FL', patientAvatarColor: 'bg-rose-500', type: 'RETURN', status: 'SCHEDULED', scheduledAt: '2025-04-25T15:00:00', isTeleconsult: true },
  { id: 'appt_05', patientId: 'pat_03', patientName: 'Ana Oliveira', patientAvatar: 'AO', patientAvatarColor: 'bg-emerald-500', type: 'RETURN', status: 'SCHEDULED', scheduledAt: '2025-04-22T11:00:00', isTeleconsult: false },
];

export const CONVERSATIONS: ConversationPreview[] = [
  { id: 'conv_01', from: 'João Silva', fromInitials: 'JS', fromColor: 'bg-sky-500', preview: 'Dr., a náusea piorou bastante ontem à noite. Consegui tomar...', time: '09:41', unread: 2, isPatient: true },
  { id: 'conv_02', from: 'Maria Santos', fromInitials: 'MS', fromColor: 'bg-violet-500', preview: 'Boa tarde! Registrei o peso hoje: 88,4 kg. Muito feliz com o progresso!', time: 'ontem', unread: 0, isPatient: true },
  { id: 'conv_03', from: 'Dra. Paula Nutrição', fromInitials: 'PN', fromColor: 'bg-teal-500', preview: 'Atualizei o plano da Ana para a Fase 2. Por favor, revisar antes da consulta.', time: 'ontem', unread: 1, isPatient: false },
  { id: 'conv_04', from: 'Carlos Ferreira', fromInitials: 'CF', fromColor: 'bg-amber-500', preview: 'Dr., minha glicemia de jejum hoje deu 168. Preciso ajustar a insulina?', time: '14/04', unread: 0, isPatient: true },
  { id: 'conv_05', from: 'Ana Oliveira', fromInitials: 'AO', fromColor: 'bg-emerald-500', preview: 'Precisei pausar o medicamento por causa de uma cirurgia. Quando posso retomar?', time: '10/04', unread: 0, isPatient: true },
];

export const MEDICATION_LABEL: Record<Medication, string> = {
  SEMAGLUTIDE: 'Semaglutida', TIRZEPATIDE: 'Tirzepatida', LIRAGLUTIDE: 'Liraglutida', OTHER: 'Outro',
};
export const MEDICATION_BRAND: Record<Medication, string> = {
  SEMAGLUTIDE: 'Ozempic / Wegovy', TIRZEPATIDE: 'Mounjaro', LIRAGLUTIDE: 'Saxenda', OTHER: '—',
};
