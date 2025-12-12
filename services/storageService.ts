import { supabase } from './supabaseClient';
import { Patient, Session, ClinicalDocument, UserSettings } from '../types';

// --- Theme (Local Storage is fine for Theme) ---
const THEME_KEY = 'psipro_theme';
export const getStoredTheme = (): 'light' | 'dark' => {
  return (localStorage.getItem(THEME_KEY) as 'light' | 'dark') || 'dark';
};

export const saveStoredTheme = (theme: 'light' | 'dark') => {
  localStorage.setItem(THEME_KEY, theme);
};

// --- Helpers ---
class DatabaseError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.name = 'DatabaseError';
    this.code = code;
  }
}

// Helper to handle Supabase errors
const handleSupabaseError = (error: any, context: string) => {
    console.error(`Error in ${context}:`, error);
    
    // Code 42P01: Relation (table) does not exist
    if (error?.code === '42P01') {
        throw new DatabaseError(
            `As tabelas do banco de dados não foram encontradas.`,
            'MISSING_TABLES'
        );
    }
    
    // Code 23505: Unique violation
    if (error?.code === '23505') {
        throw new Error('Já existe um registro com estes dados únicos.');
    }

    // Code 42501: RLS violation (Permission denied)
    if (error?.code === '42501') {
        throw new Error('Permissão negada. Verifique se você está logado.');
    }

    throw new Error(error.message || `Erro desconhecido em ${context}`);
};

const getCurrentUserId = async () => {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  
  if (sessionError || !session) {
     // Try to refresh
     const { data: { user }, error: userError } = await supabase.auth.getUser();
     if (userError || !user) {
         console.error("Auth Error:", userError || sessionError);
         throw new Error('Sessão expirada. Recarregue a página e faça login novamente.');
     }
     return user.id;
  }
  return session.user.id;
};

// --- Patients ---
export const getPatients = async (): Promise<Patient[]> => {
  await getCurrentUserId(); // Enforce Auth

  const { data, error } = await supabase
    .from('patients')
    .select('*')
    .order('full_name');
  
  if (error) handleSupabaseError(error, 'getPatients');

  return (data || []).map((p: any) => ({
    id: p.id,
    fullName: p.full_name,
    birthDate: p.birth_date || '',
    cpf: p.cpf || '',
    phone: p.phone || '',
    email: p.email || '',
    preferredType: p.preferred_type || 'ONLINE',
    clinicalHistory: p.clinical_history || '',
    notes: p.notes || '',
    diagnosis: p.diagnosis || '',
    registrationDate: p.registration_date || new Date().toISOString()
  }));
};

export const savePatient = async (patient: Patient) => {
  const userId = await getCurrentUserId();
  
  const dbPatient = {
    id: patient.id, 
    user_id: userId,
    full_name: patient.fullName,
    birth_date: patient.birthDate,
    cpf: patient.cpf,
    phone: patient.phone,
    email: patient.email,
    preferred_type: patient.preferredType,
    clinical_history: patient.clinicalHistory,
    notes: patient.notes,
    diagnosis: patient.diagnosis,
    registration_date: patient.registrationDate
  };

  const { error } = await supabase.from('patients').upsert(dbPatient);
  if (error) handleSupabaseError(error, 'savePatient');
};

export const deletePatient = async (id: string) => {
  await getCurrentUserId();
  const { error } = await supabase.from('patients').delete().eq('id', id);
  if (error) handleSupabaseError(error, 'deletePatient');
};

// --- Sessions ---
export const getSessions = async (): Promise<Session[]> => {
  await getCurrentUserId();

  const { data, error } = await supabase.from('sessions').select('*');

  if (error) handleSupabaseError(error, 'getSessions');

  return (data || []).map((s: any) => ({
    id: s.id,
    patientId: s.patient_id,
    date: s.date,
    startTime: s.start_time,
    endTime: s.end_time,
    status: s.status,
    type: s.type || 'ONLINE',
    notes: s.notes || '',
    clinicalRecord: s.clinical_record, 
    value: s.value || 0,
    isPaid: s.is_paid || false,
    recurrenceId: s.recurrence_id
  }));
};

export const saveSession = async (session: Session) => {
  const userId = await getCurrentUserId();

  const dbSession = {
    id: session.id,
    user_id: userId,
    patient_id: session.patientId,
    date: session.date,
    start_time: session.startTime,
    end_time: session.endTime,
    status: session.status,
    type: session.type,
    notes: session.notes,
    clinical_record: session.clinicalRecord,
    value: session.value,
    is_paid: session.isPaid,
    recurrence_id: session.recurrenceId
  };

  const { error } = await supabase.from('sessions').upsert(dbSession);
  if (error) handleSupabaseError(error, 'saveSession');
};

export const saveMultipleSessions = async (newSessions: Session[]) => {
  const userId = await getCurrentUserId();
  const dbSessions = newSessions.map(s => ({
    id: s.id,
    user_id: userId,
    patient_id: s.patientId,
    date: s.date,
    start_time: s.startTime,
    end_time: s.endTime,
    status: s.status,
    type: s.type,
    notes: s.notes,
    clinical_record: s.clinicalRecord,
    value: s.value,
    is_paid: s.isPaid,
    recurrence_id: s.recurrenceId
  }));

  const { error } = await supabase.from('sessions').upsert(dbSessions);
  if (error) handleSupabaseError(error, 'saveMultipleSessions');
};

export const deleteSession = async (id: string) => {
  await getCurrentUserId();
  const { error } = await supabase.from('sessions').delete().eq('id', id);
  if (error) handleSupabaseError(error, 'deleteSession');
};

export const checkSessionConflict = async (date: string, startTime: string, endTime: string, excludeSessionId?: string): Promise<boolean> => {
  try {
      // For scalability, we should ideally use a DB query here, but for now fetching all sessions for the user is acceptable for < 1000 sessions.
      const sessions = await getSessions(); 
      return sessions.some(s => {
        if (s.id === excludeSessionId) return false;
        if (s.date !== date) return false;
        if (s.status === 'canceled') return false;
        // Simple time overlap check
        return (startTime < s.endTime && endTime > s.startTime);
      });
  } catch (error) {
      // If table is missing, we can't check conflict, so return false to allow UI to proceed (and then crash at save if needed)
      // but usually getSessions above will throw first.
      return false;
  }
};

// --- Documents ---
export const getDocuments = async (): Promise<ClinicalDocument[]> => {
  await getCurrentUserId();

  const { data, error } = await supabase.from('documents').select('*');
  if (error) handleSupabaseError(error, 'getDocuments');
  
  return (data || []).map((d: any) => ({
    id: d.id,
    patientId: d.patient_id,
    type: d.type,
    title: d.title,
    content: d.content || '',
    storagePath: d.storage_path,
    createdAt: d.created_at
  }));
};

export const uploadAndSaveDocument = async (doc: ClinicalDocument, fileBlob: Blob) => {
  const userId = await getCurrentUserId();
  
  // 1. Upload to Storage
  const fileName = `${userId}/${doc.patientId}/${doc.id}.html`; 
  
  // Ensure bucket exists or fail gracefully
  const { error: storageError } = await supabase.storage
    .from('documents')
    .upload(fileName, fileBlob, {
      upsert: true,
      contentType: 'text/html'
    });

  if (storageError) {
     if ((storageError as any).statusCode === '404') {
        throw new Error('Bucket de armazenamento "documents" não encontrado.');
     }
     handleSupabaseError(storageError, 'uploadDocument');
  }

  // 2. Save Metadata
  const dbDoc = {
    id: doc.id,
    user_id: userId,
    patient_id: doc.patientId,
    type: doc.type,
    title: doc.title,
    content: doc.content, 
    storage_path: fileName,
    created_at: doc.createdAt
  };

  const { error: dbError } = await supabase.from('documents').upsert(dbDoc);
  if (dbError) handleSupabaseError(dbError, 'saveDocument (Metadata)');
};

export const deleteDocument = async (id: string) => {
  await getCurrentUserId();
  
  // Try to get path first
  const { data: doc } = await supabase.from('documents').select('storage_path').eq('id', id).single();
  
  if (doc?.storage_path) {
    const { error: storageError } = await supabase.storage.from('documents').remove([doc.storage_path]);
    if (storageError) console.warn("Storage warning:", storageError);
  }

  const { error } = await supabase.from('documents').delete().eq('id', id);
  if (error) handleSupabaseError(error, 'deleteDocument');
};

export const getDocumentDownloadUrl = async (path: string) => {
  const { data, error } = await supabase.storage.from('documents').createSignedUrl(path, 60 * 60);
  if (error) {
      console.error("Error signing URL:", error);
      return null;
  }
  return data?.signedUrl;
};

// --- Settings ---
export const getSettings = async (): Promise<UserSettings> => {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase.from('user_settings').select('*').eq('user_id', userId).single();
  
  if (error) {
    if (error.code === 'PGRST116') { // Row not found
        return { name: '', email: '', crp: '', phone: '', address: '', document: '', specializations: [], approach: '' };
    }
    if (error.code === '42P01') {
        // Table doesn't exist. Throw specialized error so App can catch it.
        throw new DatabaseError('Tabela de configurações não encontrada', 'MISSING_TABLES');
    }
    // Log but don't crash for other errors, return empty
    console.error('Error fetching settings:', error);
    return { name: '', email: '', crp: '', phone: '', address: '', document: '', specializations: [], approach: '' };
  }
  
  if (!data) return { name: '', email: '', crp: '', phone: '', address: '', document: '', specializations: [], approach: '' };
  
  return {
      name: data.name,
      email: data.email,
      crp: data.crp,
      phone: data.phone,
      address: data.address,
      document: data.document_number, // Mapeia snake_case para camelCase
      specializations: data.specializations || [],
      approach: data.approach
  };
};

export const saveSettings = async (settings: UserSettings) => {
  const userId = await getCurrentUserId();
  const dbSettings = {
    user_id: userId,
    name: settings.name,
    email: settings.email,
    crp: settings.crp,
    phone: settings.phone,
    address: settings.address,
    document_number: settings.document, // Mapeia camelCase para snake_case
    specializations: settings.specializations,
    approach: settings.approach
  };
  
  const { error } = await supabase.from('user_settings').upsert(dbSettings);
  if (error) handleSupabaseError(error, 'saveSettings');
};

export const auth = supabase.auth;