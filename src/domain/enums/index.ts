// src/domain/enums/index.ts
// Enumerações do domínio clínico — espelham o schema Prisma
// Mantidos separados para que a camada de domínio não dependa do Prisma

/** Perfis de acesso na plataforma */
export enum Role {
  DOCTOR = 'DOCTOR',
  NUTRITIONIST = 'NUTRITIONIST',
  PATIENT = 'PATIENT',
}

/** Status de verificação de credenciais profissionais */
export enum VerificationStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

/** Sexo biológico — usado em cálculos clínicos (TMB, ajuste de dose) */
export enum BiologicalSex {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
  INTERSEX = 'INTERSEX',
}

/** Medicamentos agonistas GLP-1 suportados */
export enum Medication {
  /** Semaglutida — Ozempic / Wegovy */
  SEMAGLUTIDE = 'SEMAGLUTIDE',
  /** Tirzepatida — Mounjaro */
  TIRZEPATIDE = 'TIRZEPATIDE',
  /** Liraglutida — Saxenda / Victoza */
  LIRAGLUTIDE = 'LIRAGLUTIDE',
  OTHER = 'OTHER',
}

/** Status do tratamento */
export enum TreatmentStatus {
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  COMPLETED = 'COMPLETED',
  ABANDONED = 'ABANDONED',
}

/** Sítios de aplicação subcutânea */
export enum InjectionSite {
  ABDOMEN = 'ABDOMEN',
  THIGH = 'THIGH',
  ARM = 'ARM',
}

/** Tipo de biométrica */
export enum BiometricType {
  WEIGHT = 'WEIGHT',
  GLUCOSE = 'GLUCOSE',
  BLOOD_PRESSURE = 'BLOOD_PRESSURE',
  HEART_RATE = 'HEART_RATE',
  WAIST_CIRCUMFERENCE = 'WAIST_CIRCUMFERENCE',
}

/** Origem do dado biométrico */
export enum BiometricSource {
  MANUAL = 'MANUAL',
  DEVICE = 'DEVICE',
  APPLE_HEALTH = 'APPLE_HEALTH',
  GOOGLE_FIT = 'GOOGLE_FIT',
}

/** Gravidade do alerta clínico */
export enum AlertSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

/** Tipo de consulta */
export enum AppointmentType {
  INITIAL = 'INITIAL',
  RETURN = 'RETURN',
  URGENCY = 'URGENCY',
}

/** Status da consulta */
export enum AppointmentStatus {
  SCHEDULED = 'SCHEDULED',
  CONFIRMED = 'CONFIRMED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  NO_SHOW = 'NO_SHOW',
}

/** Fase do plano nutricional */
export enum NutritionalPhase {
  PHASE_1 = 'PHASE_1',
  PHASE_2 = 'PHASE_2',
  PHASE_3 = 'PHASE_3',
}

/** Status do plano nutricional */
export enum NutritionalPlanStatus {
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  SUPERSEDED = 'SUPERSEDED',
}

/** Tipo de refeição */
export enum MealType {
  BREAKFAST = 'BREAKFAST',
  LUNCH = 'LUNCH',
  DINNER = 'DINNER',
  SNACK = 'SNACK',
  SUPPER = 'SUPPER',
}

/** Tipo de mensagem na comunicação */
export enum MessageType {
  TEXT = 'TEXT',
  AUDIO = 'AUDIO',
  DOCUMENT = 'DOCUMENT',
  IMAGE = 'IMAGE',
}

/** Status do vínculo clínico */
export enum ClinicalTeamStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}
