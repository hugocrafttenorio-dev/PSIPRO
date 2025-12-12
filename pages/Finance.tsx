import React, { useState, useEffect } from 'react';
import { DollarSign, TrendingUp, ChevronLeft, ChevronRight, Search, Calendar, CreditCard, Loader2 } from 'lucide-react';
import { getSessions, getPatients } from '../services/storageService';
import { Session, Patient } from '../types';

export const Finance: React.FC = () => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
        const [s, p] = await Promise.all([getSessions(), getPatients()]);
        setSessions(s);
        setPatients(p);
        setLoading(false);
    };
    load();
  }, []);

  if (loading) return <div className="flex justify-center p-10"><Loader2 className="animate-spin text-[var(--primary)]" /></div>;

  const getPatientName = (id: string) => patients.find(p => p.id === id)?.fullName || 'Desconhecido';

  const prevMonth = () => {
    const newDate = new Date(currentDate);
    newDate.setMonth(currentDate.getMonth() - 1);
    setCurrentDate(newDate);
  };

  const nextMonth = () => {
    const newDate = new Date(currentDate);
    newDate.setMonth(currentDate.getMonth() + 1);
    setCurrentDate(newDate);
  };

  const monthSessions = sessions.filter(session => {
    const sessionDate = new Date(session.date + 'T00:00:00'); 
    return (
        sessionDate.getMonth() === currentDate.getMonth() &&
        sessionDate.getFullYear() === currentDate.getFullYear()
    );
  });

  const paidSessions = monthSessions.filter(s => s.isPaid);

  const totalRevenue = paidSessions.reduce((acc, curr) => acc + (curr.value || 0), 0);
  const totalCompletedSessions = monthSessions.filter(s => s.status === 'completed').length;
  
  const displayedSessions = paidSessions.filter(s => 
      getPatientName(s.patientId).toLowerCase().includes(searchTerm.toLowerCase())
  ).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const monthLabel = currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-[var(--text-main)]">Faturamento & Financeiro</h2>
          <p className="text-[var(--text-secondary)]">Controle financeiro mensal e histórico de pagamentos.</p>
        </div>
      </div>

      {/* Main Stats Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 bg-[var(--bg-card)] rounded-xl shadow-sm border border-[var(--border-color)] p-6 relative overflow-hidden">
             <div className="absolute top-0 right-0 p-4 opacity-10">
                <DollarSign size={120} className="text-[var(--primary)]" />
             </div>
             <div className="relative z-10">
                 <div className="flex items-center space-x-2 text-[var(--text-secondary)] mb-2">
                    <Calendar size={18} />
                    <span className="capitalize font-medium">{monthLabel}</span>
                 </div>
                 <h3 className="text-4xl font-bold text-[var(--text-main)] mb-1">
                    R$ {totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                 </h3>
                 <p className="text-emerald-500 font-medium text-sm flex items-center mt-2">
                    <TrendingUp size={14} className="mr-1" />
                    Total faturado em sessões pagas
                 </p>
             </div>
          </div>

          <div className="bg-[var(--bg-card)] rounded-xl shadow-sm border border-[var(--border-color)] p-6 flex flex-col justify-center">
              <p className="text-[var(--text-secondary)] font-medium mb-1">Sessões Realizadas</p>
              <h3 className="text-3xl font-bold text-[var(--text-main)]">{totalCompletedSessions}</h3>
              <p className="text-xs text-[var(--text-secondary)] mt-1">Sessões marcadas como 'Realizada' neste mês</p>
          </div>
      </div>

      {/* History & Navigation */}
      <div className="bg-[var(--bg-card)] rounded-xl shadow-sm border border-[var(--border-color)] overflow-hidden">
          <div className="p-4 border-b border-[var(--border-color)] flex flex-col md:flex-row justify-between items-center gap-4">
               <div className="flex items-center space-x-4">
                   <button onClick={prevMonth} className="p-2 hover:bg-[var(--nav-hover)] rounded-[10px] text-[var(--text-main)] transition">
                       <ChevronLeft size={24} />
                   </button>
                   <h3 className="text-xl font-bold text-[var(--text-main)] capitalize w-48 text-center">{monthLabel}</h3>
                   <button onClick={nextMonth} className="p-2 hover:bg-[var(--nav-hover)] rounded-[10px] text-[var(--text-main)] transition">
                       <ChevronRight size={24} />
                   </button>
               </div>

               <div className="relative w-full md:w-64">
                    <input
                        type="text"
                        placeholder="Buscar paciente..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-[var(--bg-input)] text-[var(--text-main)] pl-10 pr-4 py-2 border border-[var(--border-color)] rounded-[10px] focus:ring-2 focus:ring-[var(--primary)] outline-none placeholder-[var(--text-placeholder)]"
                    />
                    <Search className="absolute left-3 top-2.5 text-[var(--text-placeholder)]" size={18} />
               </div>
          </div>

          <div className="overflow-x-auto">
              {displayedSessions.length === 0 ? (
                  <div className="p-12 text-center text-[var(--text-secondary)]">
                      <CreditCard size={48} className="mx-auto mb-4 text-[var(--border-color)]" />
                      <p className="text-lg font-medium">Nenhum pagamento registrado neste período.</p>
                      <p className="text-sm">Certifique-se de marcar as sessões como "Paga" na tela do paciente.</p>
                  </div>
              ) : (
                  <table className="w-full text-left">
                      <thead className="bg-[var(--bg-input)] text-[var(--text-secondary)] text-xs uppercase font-semibold">
                          <tr>
                              <th className="px-6 py-4">Data</th>
                              <th className="px-6 py-4">Paciente</th>
                              <th className="px-6 py-4">Tipo</th>
                              <th className="px-6 py-4 text-right">Valor</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border-color)]">
                          {displayedSessions.map(session => (
                              <tr key={session.id} className="hover:bg-[var(--nav-hover)] transition">
                                  <td className="px-6 py-4 text-[var(--text-secondary)]">
                                      {new Date(session.date).toLocaleDateString('pt-BR')}
                                  </td>
                                  <td className="px-6 py-4 font-medium text-[var(--text-main)]">
                                      {getPatientName(session.patientId)}
                                  </td>
                                  <td className="px-6 py-4">
                                      <span className="text-xs border border-[var(--border-color)] text-[var(--text-secondary)] px-2 py-0.5 rounded-full uppercase">
                                          {session.type || 'ONLINE'}
                                      </span>
                                  </td>
                                  <td className="px-6 py-4 text-right font-bold text-emerald-500">
                                      R$ {session.value?.toFixed(2)}
                                  </td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              )}
          </div>
      </div>
    </div>
  );
};