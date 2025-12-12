import React, { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { ViewState, UserSettings } from './types';
import { Dashboard } from './pages/Dashboard';
import { PatientsList } from './pages/PatientsList';
import { PatientDetail } from './pages/PatientDetail';
import { Agenda } from './pages/Agenda';
import { Documents } from './pages/Documents';
import { Settings } from './pages/Settings';
import { Finance } from './pages/Finance';
import { auth, getStoredTheme, saveStoredTheme, getSettings, saveSettings } from './services/storageService';
import { Brain, Loader2, Database, AlertTriangle, CheckCircle, Copy, Save, X } from 'lucide-react';

// --- SQL Script Component ---
const DatabaseSetupScreen = () => {
  const [copied, setCopied] = useState(false);

  const sqlScript = `
-- =================================================================
-- SCRIPT DE CORREÇÃO E CONFIGURAÇÃO (RLS + CASCADE)
-- Rode este script completo no SQL Editor do Supabase
-- =================================================================

-- 1. Habilitar extensões necessárias
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- 2. CRIAÇÃO DAS TABELAS (Se não existirem)
create table if not exists public.user_settings (
  user_id uuid references auth.users(id) on delete cascade not null primary key,
  name text,
  email text,
  crp text,
  phone text,
  address text,
  document_number text,
  specializations text[],
  approach text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.patients (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  full_name text not null,
  cpf text,
  birth_date text,
  phone text,
  email text,
  preferred_type text default 'ONLINE',
  clinical_history text,
  notes text,
  diagnosis text,
  registration_date text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.sessions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  patient_id uuid references public.patients(id) on delete cascade not null,
  date text not null,
  start_time text not null,
  end_time text not null,
  status text not null,
  type text,
  notes text,
  clinical_record jsonb,
  value numeric,
  is_paid boolean default false,
  recurrence_id text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.documents (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  patient_id uuid references public.patients(id) on delete cascade not null,
  type text not null,
  title text not null,
  content text,
  storage_path text,
  created_at text not null
);

-- 3. AJUSTE DE CONSTRAINTS (Garantir ON DELETE CASCADE)
-- Isso permite que o banco tente excluir sessões quando o paciente for apagado
alter table public.sessions drop constraint if exists sessions_patient_id_fkey;
alter table public.sessions add constraint sessions_patient_id_fkey 
  foreign key (patient_id) references public.patients(id) on delete cascade;

alter table public.documents drop constraint if exists documents_patient_id_fkey;
alter table public.documents add constraint documents_patient_id_fkey 
  foreign key (patient_id) references public.patients(id) on delete cascade;

-- 4. SEGURANÇA (ROW LEVEL SECURITY)
-- Habilita RLS em todas as tabelas
alter table public.user_settings enable row level security;
alter table public.patients enable row level security;
alter table public.sessions enable row level security;
alter table public.documents enable row level security;

-- 5. POLICIES (REGRAS DE ACESSO)
-- Removemos todas as policies antigas para evitar conflitos e regras genéricas (FOR ALL)
-- que costumam bloquear o DELETE cascade.

-- Limpeza de policies antigas
do $$ 
declare
  pol record;
begin
  for pol in select policyname, tablename from pg_policies where schemaname = 'public' loop
    execute format('drop policy if exists %I on public.%I', pol.policyname, pol.tablename);
  end loop;
end $$;

-- === POLICIES PARA USER_SETTINGS ===
create policy "settings_select" on public.user_settings for select using (auth.uid() = user_id);
create policy "settings_insert" on public.user_settings for insert with check (auth.uid() = user_id);
create policy "settings_update" on public.user_settings for update using (auth.uid() = user_id);
create policy "settings_delete" on public.user_settings for delete using (auth.uid() = user_id);

-- === POLICIES PARA PATIENTS ===
create policy "patients_select" on public.patients for select using (auth.uid() = user_id);
create policy "patients_insert" on public.patients for insert with check (auth.uid() = user_id);
create policy "patients_update" on public.patients for update using (auth.uid() = user_id);
create policy "patients_delete" on public.patients for delete using (auth.uid() = user_id);

-- === POLICIES PARA SESSIONS ===
-- O DELETE aqui é crucial: auth.uid() = user_id permite que o dono da sessão a exclua.
-- Como o CASCADE é disparado pelo usuário dono do paciente (que também é dono da sessão),
-- essa regra libera a exclusão em cascata.
create policy "sessions_select" on public.sessions for select using (auth.uid() = user_id);
create policy "sessions_insert" on public.sessions for insert with check (auth.uid() = user_id);
create policy "sessions_update" on public.sessions for update using (auth.uid() = user_id);
create policy "sessions_delete" on public.sessions for delete using (auth.uid() = user_id);

-- === POLICIES PARA DOCUMENTS ===
create policy "documents_select" on public.documents for select using (auth.uid() = user_id);
create policy "documents_insert" on public.documents for insert with check (auth.uid() = user_id);
create policy "documents_update" on public.documents for update using (auth.uid() = user_id);
create policy "documents_delete" on public.documents for delete using (auth.uid() = user_id);

-- 6. STORAGE (Bucket de Documentos)
insert into storage.buckets (id, name, public) values ('documents', 'documents', false) ON CONFLICT (id) DO NOTHING;

-- Policies de Storage (Drop e recria)
drop policy if exists "Storage Select Own" on storage.objects;
drop policy if exists "Storage Insert Own" on storage.objects;
drop policy if exists "Storage Delete Own" on storage.objects;

create policy "Storage Select Own" ON storage.objects FOR SELECT TO public USING (bucket_id = 'documents' AND auth.uid() = owner);
create policy "Storage Insert Own" ON storage.objects FOR INSERT TO public WITH CHECK (bucket_id = 'documents' AND auth.uid() = owner);
create policy "Storage Delete Own" ON storage.objects FOR DELETE TO public USING (bucket_id = 'documents' AND auth.uid() = owner);
`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(sqlScript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[var(--bg-main)] flex items-center justify-center p-4">
      <div className="bg-[var(--bg-card)] rounded-xl shadow-2xl p-8 max-w-4xl w-full border border-[var(--border-color)]">
        <div className="flex items-center space-x-3 mb-6 text-amber-500">
          <AlertTriangle size={32} />
          <h1 className="text-2xl font-bold text-[var(--text-main)]">Atualização de Segurança Necessária</h1>
        </div>
        
        <p className="text-[var(--text-secondary)] mb-6">
          Detectamos que as permissões do banco de dados precisam ser atualizadas para permitir a exclusão completa de pacientes e seus registros vinculados.
        </p>

        <div className="bg-blue-900/10 border border-blue-900/30 rounded-lg p-4 mb-6">
          <h3 className="font-bold text-blue-500 mb-2 flex items-center">
             <Database size={18} className="mr-2" />
             Como Corrigir:
          </h3>
          <ol className="list-decimal list-inside text-sm text-[var(--text-main)] space-y-1">
             <li>Copie o código SQL abaixo.</li>
             <li>Vá para o painel do <strong>Supabase</strong> {'>'} <strong>SQL Editor</strong>.</li>
             <li>Cole o código e clique em <strong>Run</strong>.</li>
             <li>Volte aqui e recarregue a página.</li>
          </ol>
        </div>

        <div className="relative group">
          <pre className="bg-[#1e1e1e] text-gray-300 p-4 rounded-lg overflow-x-auto text-xs h-96 font-mono border border-gray-700 leading-relaxed selection:bg-blue-500/30">
            {sqlScript}
          </pre>
          <button 
            onClick={copyToClipboard}
            className="absolute top-4 right-4 bg-white text-black px-4 py-2 rounded-md text-sm font-bold flex items-center hover:bg-gray-200 transition shadow-lg z-10"
          >
            {copied ? <CheckCircle size={16} className="mr-2 text-green-600" /> : <Copy size={16} className="mr-2" />}
            {copied ? 'SQL Copiado!' : 'Copiar SQL Completo'}
          </button>
        </div>
      </div>
    </div>
  );
};

// --- Onboarding Modal Component ---
interface OnboardingModalProps {
  initialSettings: UserSettings;
  onComplete: () => void;
}

const OnboardingModal: React.FC<OnboardingModalProps> = ({ initialSettings, onComplete }) => {
  const [settings, setSettings] = useState<UserSettings>(initialSettings);
  const [saving, setSaving] = useState(false);
  const [currentTag, setCurrentTag] = useState('');

  // Fields that are mandatory: Name, CRP, Document, Address
  // Approach and Specializations are optional
  const isFormValid = 
    settings.name?.trim().length > 0 &&
    settings.crp?.trim().length > 0 &&
    settings.document?.trim().length > 0 &&
    settings.address?.trim().length > 0;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) return;

    setSaving(true);
    try {
      await saveSettings(settings);
      onComplete();
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar dados. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const addTag = () => {
    if (currentTag.trim() && !settings.specializations?.includes(currentTag.trim())) {
      setSettings(prev => ({
        ...prev,
        specializations: [...(prev.specializations || []), currentTag.trim()]
      }));
      setCurrentTag('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setSettings(prev => ({
      ...prev,
      specializations: (prev.specializations || []).filter(tag => tag !== tagToRemove)
    }));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-md">
      <div className="bg-[var(--bg-card)] rounded-xl shadow-2xl w-full max-w-2xl border border-[var(--border-color)] flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-[var(--border-color)]">
           <h2 className="text-2xl font-bold text-[var(--text-main)] flex items-center">
             <Brain className="mr-3 text-[var(--primary)]" />
             Complete seu Perfil Profissional
           </h2>
           <p className="text-[var(--text-secondary)] mt-2">
             Para acessar a plataforma e emitir documentos válidos, precisamos de alguns dados obrigatórios.
           </p>
        </div>
        
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
           <form id="onboarding-form" onSubmit={handleSave} className="space-y-6">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="md:col-span-2">
                    <label className="block text-sm font-bold text-[var(--text-main)] mb-2">Nome Completo <span className="text-red-500">*</span></label>
                    <input 
                      required
                      type="text" 
                      value={settings.name}
                      onChange={e => setSettings({...settings, name: e.target.value})}
                      className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-main)] rounded-[10px] p-[14px] focus:ring-2 focus:ring-[var(--primary)] outline-none"
                      placeholder="Ex: Dr. João Silva"
                    />
                 </div>

                 <div>
                    <label className="block text-sm font-bold text-[var(--text-main)] mb-2">CRP / Registro <span className="text-red-500">*</span></label>
                    <input 
                      required
                      type="text" 
                      value={settings.crp}
                      onChange={e => setSettings({...settings, crp: e.target.value})}
                      className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-main)] rounded-[10px] p-[14px] focus:ring-2 focus:ring-[var(--primary)] outline-none"
                      placeholder="00/00000"
                    />
                 </div>

                 <div>
                    <label className="block text-sm font-bold text-[var(--text-main)] mb-2">CPF ou CNPJ <span className="text-red-500">*</span></label>
                    <input 
                      required
                      type="text" 
                      value={settings.document || ''}
                      onChange={e => setSettings({...settings, document: e.target.value})}
                      className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-main)] rounded-[10px] p-[14px] focus:ring-2 focus:ring-[var(--primary)] outline-none"
                      placeholder="Documento para recibos"
                    />
                 </div>

                 <div className="md:col-span-2">
                    <label className="block text-sm font-bold text-[var(--text-main)] mb-2">Endereço Profissional <span className="text-red-500">*</span></label>
                    <input 
                      required
                      type="text" 
                      value={settings.address}
                      onChange={e => setSettings({...settings, address: e.target.value})}
                      className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-main)] rounded-[10px] p-[14px] focus:ring-2 focus:ring-[var(--primary)] outline-none"
                      placeholder="Rua, Número, Sala, Cidade - UF"
                    />
                 </div>
                 
                 <div className="md:col-span-2">
                    <label className="block text-sm font-bold text-[var(--text-main)] mb-2">Abordagem de Atendimento <span className="text-[var(--text-secondary)] font-normal text-xs">(Opcional)</span></label>
                    <input 
                      type="text" 
                      value={settings.approach || ''}
                      onChange={e => setSettings({...settings, approach: e.target.value})}
                      className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-main)] rounded-[10px] p-[14px] focus:ring-2 focus:ring-[var(--primary)] outline-none"
                      placeholder="Ex: Terapia Cognitivo-Comportamental (TCC)"
                    />
                 </div>

                 <div className="md:col-span-2">
                    <label className="block text-sm font-bold text-[var(--text-main)] mb-2">Especializações (Tags) <span className="text-[var(--text-secondary)] font-normal text-xs">(Opcional)</span></label>
                    <div className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-[10px] p-2 focus-within:ring-2 focus-within:ring-[var(--primary)]">
                       <div className="flex flex-wrap gap-2 mb-2">
                          {settings.specializations?.map(tag => (
                             <span key={tag} className="bg-[var(--primary)] bg-opacity-10 text-[var(--primary)] px-2 py-1 rounded-md text-sm flex items-center border border-[var(--primary)]/20">
                                {tag}
                                <button type="button" onClick={() => removeTag(tag)} className="ml-1 hover:text-red-500">
                                   <X size={14} />
                                </button>
                             </span>
                          ))}
                       </div>
                       <input 
                         type="text" 
                         value={currentTag}
                         onChange={e => setCurrentTag(e.target.value)}
                         onKeyDown={handleKeyDown}
                         onBlur={addTag}
                         className="bg-transparent outline-none w-full text-[var(--text-main)] placeholder-[var(--text-placeholder)] min-w-[200px]"
                         placeholder={settings.specializations?.length ? "Adicionar outra..." : "Digite e pressione Enter (ex: Ansiedade, Depressão)..."}
                       />
                    </div>
                    <p className="text-xs text-[var(--text-secondary)] mt-1">Pressione Enter ou Vírgula para adicionar.</p>
                 </div>
              </div>
           </form>
        </div>

        <div className="p-6 border-t border-[var(--border-color)] bg-[var(--bg-card)] rounded-b-xl flex justify-end">
           <button 
             type="submit"
             form="onboarding-form"
             disabled={!isFormValid || saving}
             className={`
               px-8 py-3 rounded-[10px] font-bold text-white flex items-center transition shadow-lg
               ${!isFormValid || saving ? 'bg-gray-400 cursor-not-allowed' : 'bg-[var(--primary)] hover:bg-[var(--primary-hover)]'}
             `}
           >
             {saving && <Loader2 className="animate-spin mr-2" />}
             {!isFormValid ? 'Preencha todos os campos obrigatórios' : 'Salvar e Acessar Sistema'}
           </button>
        </div>
      </div>
    </div>
  );
};


export default function App() {
  const [session, setSession] = useState<any>(null);
  const [isSessionLoading, setIsSessionLoading] = useState(true);
  const [currentView, setCurrentView] = useState<ViewState>('DASHBOARD');
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>(getStoredTheme());
  const [missingTables, setMissingTables] = useState(false);
  
  // Onboarding State
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [userSettings, setUserSettings] = useState<UserSettings | null>(null);

  // Auth States
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  useEffect(() => {
    let mounted = true;

    // 1. Get initial session
    auth.getSession().then(({ data: { session } }) => {
      if (mounted) {
        setSession(session);
        setIsSessionLoading(false);
        if (session) checkDatabaseAndProfile();
      }
    });

    // 2. Listen for changes (login, logout, refresh)
    const { data: { subscription } } = auth.onAuthStateChange((_event, session) => {
      if (mounted) {
        setSession(session);
        setIsSessionLoading(false);
        if (session) checkDatabaseAndProfile();
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const checkDatabaseAndProfile = async () => {
      try {
          const settings = await getSettings();
          setUserSettings(settings);
          
          // Check if profile is complete based on new requirements (Only Name, CRP, Document, Address are mandatory)
          const isProfileComplete = 
            settings.name?.length > 0 && 
            settings.crp?.length > 0 && 
            settings.address?.length > 0 &&
            settings.document?.length > 0;

          if (!isProfileComplete) {
             setShowOnboarding(true);
          } else {
             setShowOnboarding(false);
          }

      } catch (error: any) {
          if (error.code === 'MISSING_TABLES') {
              setMissingTables(true);
          }
      }
  };

  const handleOnboardingComplete = () => {
      setShowOnboarding(false);
      // Refresh settings to ensure app has latest state
      getSettings().then(setUserSettings);
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    saveStoredTheme(theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError(null);
    try {
        if (isSignUp) {
            const { error } = await auth.signUp({ email, password });
            if (error) throw error;
            alert('Cadastro realizado! Se o login não for automático, verifique seu email.');
            setIsSignUp(false);
        } else {
            const { error } = await auth.signInWithPassword({ email, password });
            if (error) throw error;
        }
    } catch (err: any) {
        setAuthError(err.message || 'Erro na autenticação. Verifique suas credenciais.');
    } finally {
        setAuthLoading(false);
    }
  };

  const handleNavigate = (view: ViewState) => {
    setCurrentView(view);
    if (view !== 'PATIENT_DETAIL') {
      setSelectedPatientId(null);
    }
  };

  const handleSelectPatient = (id: string) => {
    setSelectedPatientId(id);
    setCurrentView('PATIENT_DETAIL');
  };

  if (isSessionLoading) {
    return (
        <div className="min-h-screen flex items-center justify-center bg-[var(--bg-main)]">
            <Loader2 className="animate-spin text-[var(--primary)]" size={40} />
        </div>
    );
  }

  // If logged in but missing tables, show setup screen
  if (session && missingTables) {
      return <DatabaseSetupScreen />;
  }

  // Login Screen
  if (!session) {
    return (
      <div className="min-h-screen bg-[var(--bg-main)] flex items-center justify-center p-4 transition-colors duration-300">
        <div className="bg-[var(--bg-card)] p-8 rounded-[20px] shadow-2xl w-full max-w-md border border-[var(--border-color)]">
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-[var(--primary)] rounded-[15px] flex items-center justify-center text-white mb-4 shadow-lg shadow-[#6C63FF]/20">
              <Brain size={40} />
            </div>
            <h1 className="text-2xl font-bold text-[var(--text-main)]">PsiPro</h1>
            <p className="text-[var(--text-secondary)]">Gestão para Psicólogos</p>
          </div>
          
          <form onSubmit={handleAuth} className="space-y-4">
            {authError && (
                <div className="p-3 bg-red-900/20 border border-red-500/50 text-red-500 rounded text-sm text-center">
                    {authError}
                </div>
            )}
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Email</label>
              <input 
                type="email" 
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-main)] placeholder-[var(--text-placeholder)] rounded-[10px] p-[14px] focus:ring-2 focus:ring-[var(--primary)] outline-none transition"
                placeholder="seu@email.com"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Senha</label>
              <input 
                type="password" 
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-main)] placeholder-[var(--text-placeholder)] rounded-[10px] p-[14px] focus:ring-2 focus:ring-[var(--primary)] outline-none transition"
                placeholder="••••••••"
                required
              />
            </div>
            <button 
              type="submit"
              disabled={authLoading}
              className="w-full bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-semibold py-[14px] rounded-[10px] transition shadow-md disabled:opacity-50 flex justify-center"
            >
              {authLoading ? <Loader2 className="animate-spin" /> : (isSignUp ? 'Criar Conta' : 'Entrar')}
            </button>
            <p className="text-center text-xs text-[var(--text-secondary)] mt-4">
              <button type="button" onClick={() => { setIsSignUp(!isSignUp); setAuthError(null); }} className="hover:underline">
                  {isSignUp ? 'Já tem conta? Faça login.' : 'Não tem conta? Cadastre-se.'}
              </button>
            </p>
          </form>
        </div>
      </div>
    );
  }

  return (
    <>
      {showOnboarding && userSettings && (
        <OnboardingModal 
          initialSettings={userSettings} 
          onComplete={handleOnboardingComplete} 
        />
      )}
      
      <Layout 
        currentView={currentView} 
        onNavigate={handleNavigate}
        onLogout={() => auth.signOut()}
        theme={theme}
        onToggleTheme={toggleTheme}
      >
        {currentView === 'DASHBOARD' && (
          <Dashboard 
            onNavigate={handleNavigate} 
            onSelectPatient={handleSelectPatient} 
          />
        )}
        {currentView === 'PATIENTS' && (
          <PatientsList onSelectPatient={handleSelectPatient} />
        )}
        {currentView === 'PATIENT_DETAIL' && selectedPatientId && (
          <PatientDetail 
            patientId={selectedPatientId} 
            onBack={() => setCurrentView('PATIENTS')} 
          />
        )}
        {currentView === 'AGENDA' && (
          <Agenda />
        )}
        {currentView === 'DOCUMENTS' && (
          <Documents />
        )}
        {currentView === 'FINANCE' && (
          <Finance />
        )}
        {currentView === 'SETTINGS' && (
          <Settings />
        )}
      </Layout>
    </>
  );
}