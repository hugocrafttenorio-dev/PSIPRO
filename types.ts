
export interface Patient {
  id: string;
  fullName: string;
  birthDate: string;
  cpf: string;
  phone: string;
  email?: string;
  preferredType: 'ONLINE' | 'PRESENCIAL';
  clinicalHistory: string;
  notes: string;
  diagnosis?: string;
  registrationDate: string;
}

export interface ClinicalNotes {
  keyPoints: string;
  summary: string;
  feelings: string;
  behaviors: string;
  quotes: string;
  names: string;
  interventions: string;
  evolution: string;
  insights: string;
  mood: string;
  technicalRegister: string;
}

export interface Session {
  id: string;
  patientId: string;
  date: string;
  startTime: string;
  endTime: string;
  status: 'scheduled' | 'completed' | 'canceled' | 'absent';
  type: 'ONLINE' | 'PRESENCIAL';
  notes: string;
  
  clinicalRecord?: ClinicalNotes;
  
  value: number;
  isPaid: boolean;
  
  recurrenceId?: string;
}

export enum DocumentType {
  DECLARATION = 'DECLARATION',
  REPORT = 'REPORT',
  SESSION_RECORD = 'SESSION_RECORD'
}

export interface ClinicalDocument {
  id: string;
  patientId: string;
  type: DocumentType;
  title: string;
  content: string;
  storagePath?: string; // New field for Supabase Storage
  createdAt: string;
}

export interface UserSettings {
  name: string;
  email: string;
  crp: string;
  phone?: string;
  address?: string;
  
  // Novos campos obrigatórios
  document?: string; // CPF/CNPJ ou RG
  specializations?: string[]; // Array de tags
  approach?: string; // Abordagem teórica
}

export type ViewState = 
  | 'DASHBOARD' 
  | 'PATIENTS' 
  | 'PATIENT_DETAIL' 
  | 'AGENDA' 
  | 'DOCUMENTS' 
  | 'SETTINGS'
  | 'FINANCE';