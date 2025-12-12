import React, { useState, useEffect } from 'react';
import { Users, Calendar, Clock, Plus, ArrowRight, DollarSign, Loader2, AlertTriangle } from 'lucide-react';
import { getPatients, getSessions } from '../services/storageService';
import { Patient, Session, ViewState } from '../types';

interface DashboardProps {
  onNavigate: (view: ViewState) => void;
  onSelectPatient: (id: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate, onSelectPatient }) => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const fetchData = async () => {
        try {
            const [p, s] = await Promise.all([getPatients(), getSessions()]);
            if (mounted) {
                setPatients(p);
                setSessions(s);
            }
        } catch (err: any) {
            if (mounted) {
                console.error("Dashboard Error:", err);
                setError(err.message || "Erro ao carregar dados.");
            }
        } finally {
            if (mounted) setLoading(false);
        }
    };
    fetchData();
    return () => { mounted = false; };
  }, []);

  if (loading) return <div className="flex justify-center p-10"><Loader2 className="animate-spin text-[var(--primary)]" /></div>;

  if (error) return (
      <div className="p-8 text-center text-red-500 bg-red-100/10 border border-red-500/20 rounded-xl">
          <AlertTriangle className="mx-auto mb-2" size={32} />
          <p>{error}</p>
          <button onClick={() => window.location.reload()} className="mt-4 underline text-sm">Tentar novamente</button>
      </div>
  );

  // Filter today's sessions
  const today = new Date().toISOString().split('T')[0];
  const todaysSessions = sessions
    .filter(s => s.date === today && s.status !== 'canceled')
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  const recentPatients = [...patients].sort((a, b) => new Date(b.registrationDate).getTime() - new Date(a.registrationDate).getTime()).slice(0, 5);

  const getPatientName = (id: string) => patients.find(p => p.id === id)?.fullName || 'Desconhecido';

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-[var(--text-main)]">Olá, Dr(a).</h2>
          <p className="text-[var(--text-secondary)]">Aqui está o resumo do seu dia.</p>
        </div>
        <button 
          onClick={() => onNavigate('PATIENTS')}
          className="bg-[var(--primary)] text-white px-6 py-3 rounded-[10px] hover:bg-[var(--primary-hover)] transition flex items-center space-x-2 shadow-sm font-medium"
        >
          <Plus size={18} />
          <span>Novo Paciente</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-[var(--bg-card)] p-6 rounded-xl shadow-sm border border-[var(--border-color)] flex items-center space-x-4">
          <div className="w-12 h-12 bg-[var(--primary)] bg-opacity-20 text-[var(--primary)] rounded-full flex items-center justify-center">
            <Calendar size={24} />
          </div>
          <div>
            <p className="text-sm text-[var(--text-secondary)] font-medium">Hoje</p>
            <h3 className="text-xl font-bold text-[var(--text-main)]">{todaysSessions.length} <span className="text-xs font-normal text-[var(--text-secondary)]">sessões</span></h3>
          </div>
        </div>
        <div className="bg-[var(--bg-card)] p-6 rounded-xl shadow-sm border border-[var(--border-color)] flex items-center space-x-4">
          <div className="w-12 h-12 bg-emerald-900/30 text-emerald-400 rounded-full flex items-center justify-center">
            <Users size={24} />
          </div>
          <div>
            <p className="text-sm text-[var(--text-secondary)] font-medium">Pacientes</p>
            <h3 className="text-xl font-bold text-[var(--text-main)]">{patients.length}</h3>
          </div>
        </div>
        <div className="bg-[var(--bg-card)] p-6 rounded-xl shadow-sm border border-[var(--border-color)] flex items-center space-x-4">
          <div className="w-12 h-12 bg-purple-900/30 text-purple-400 rounded-full flex items-center justify-center">
            <Clock size={24} />
          </div>
          <div>
            <p className="text-sm text-[var(--text-secondary)] font-medium">Realizadas</p>
            <h3 className="text-xl font-bold text-[var(--text-main)]">{sessions.filter(s => s.status === 'completed').length}</h3>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Next Sessions */}
        <div className="bg-[var(--bg-card)] rounded-xl shadow-sm border border-[var(--border-color)] overflow-hidden">
          <div className="p-6 border-b border-[var(--border-color)] flex justify-between items-center">
            <h3 className="font-bold text-[var(--text-main)]">Próximos Atendimentos</h3>
            <button onClick={() => onNavigate('AGENDA')} className="text-[var(--primary)] text-sm hover:text-[var(--primary-hover)] hover:underline">Ver agenda</button>
          </div>
          <div className="p-0">
            {todaysSessions.length === 0 ? (
              <div className="p-8 text-center text-[var(--text-secondary)]">
                <p>Nenhum atendimento agendado para hoje.</p>
              </div>
            ) : (
              <ul>
                {todaysSessions.map(session => (
                  <li key={session.id} className="p-4 border-b last:border-0 border-[var(--border-color)] hover:bg-[var(--nav-hover)] transition flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="bg-[var(--primary)] bg-opacity-20 text-[var(--primary)] font-bold px-2 py-1 rounded-[6px] text-xs">
                        {session.startTime}
                      </div>
                      <div>
                        <p className="font-medium text-[var(--text-main)]">{getPatientName(session.patientId)}</p>
                        <div className="flex items-center space-x-2">
                             <p className="text-xs text-[var(--text-secondary)]">Sessão {
                                session.status === 'completed' ? 'Realizada' : 
                                session.status === 'absent' ? 'Faltou' : 'Agendada'
                             }</p>
                             <span className="text-[10px] uppercase border border-[var(--border-color)] px-1 rounded text-[var(--text-secondary)]">{session.type || 'ONLINE'}</span>
                        </div>
                      </div>
                    </div>
                    <button 
                      onClick={() => onSelectPatient(session.patientId)}
                      className="text-[var(--text-secondary)] hover:text-[var(--primary)]"
                    >
                      <ArrowRight size={18} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Recent Patients */}
        <div className="bg-[var(--bg-card)] rounded-xl shadow-sm border border-[var(--border-color)] overflow-hidden">
          <div className="p-6 border-b border-[var(--border-color)] flex justify-between items-center">
            <h3 className="font-bold text-[var(--text-main)]">Pacientes Recentes</h3>
            <button onClick={() => onNavigate('PATIENTS')} className="text-[var(--primary)] text-sm hover:text-[var(--primary-hover)] hover:underline">Ver todos</button>
          </div>
          <div className="p-0">
            {recentPatients.length === 0 ? (
              <div className="p-8 text-center text-[var(--text-secondary)]">
                <p>Nenhum paciente cadastrado.</p>
              </div>
            ) : (
              <ul>
                {recentPatients.map(patient => (
                  <li key={patient.id} className="p-4 border-b last:border-0 border-[var(--border-color)] hover:bg-[var(--nav-hover)] transition flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-full bg-[var(--bg-input)] flex items-center justify-center text-[var(--text-secondary)] font-bold text-xs">
                        {patient.fullName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-[var(--text-main)]">{patient.fullName}</p>
                        <p className="text-xs text-[var(--text-secondary)]">{patient.phone}</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => onSelectPatient(patient.id)}
                      className="text-[var(--text-secondary)] hover:text-[var(--primary)]"
                    >
                      <ArrowRight size={18} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};