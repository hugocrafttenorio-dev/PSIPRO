import React, { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Loader2, CheckCircle, XCircle, X, Plus, Clock, Search, AlertCircle } from 'lucide-react';
import { getSessions, getPatients, saveSession, checkSessionConflict } from '../services/storageService';
import { Session, Patient } from '../types';

export const Agenda: React.FC = () => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [loading, setLoading] = useState(true);

  // Configurações da Agenda
  const [slotDuration, setSlotDuration] = useState<number>(60); // Intervalo visual em minutos
  const [startHour, setStartHour] = useState<number>(7);
  const [endHour, setEndHour] = useState<number>(20);
  const [showCalendar, setShowCalendar] = useState(false);

  // Estado do Modal de Criação
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newSessionData, setNewSessionData] = useState<{
    startTime: string;
    patientId: string;
    type: 'ONLINE' | 'PRESENCIAL';
    notes: string;
    duration: number; // Duração livre em minutos
  }>({
    startTime: '',
    patientId: '',
    type: 'ONLINE',
    notes: '',
    duration: 60
  });
  const [isSavingNew, setIsSavingNew] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Estado do Modal de Presença/Falta
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [justification, setJustification] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [s, p] = await Promise.all([getSessions(), getPatients()]);
    setSessions(s);
    setPatients(p);
    setLoading(false);
  };

  const getPatientName = (id: string) => patients.find(p => p.id === id)?.fullName || 'Paciente Removido';

  // --- Navegação de Data ---
  const nextDay = () => {
    const next = new Date(selectedDate);
    next.setDate(selectedDate.getDate() + 1);
    setSelectedDate(next);
  };

  const prevDay = () => {
    const prev = new Date(selectedDate);
    prev.setDate(selectedDate.getDate() - 1);
    setSelectedDate(prev);
  };

  const formattedDate = selectedDate.toISOString().split('T')[0];
  const displayDate = selectedDate.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

  // --- Lógica de Slots de Tempo ---
  const generateTimeSlots = () => {
      const slots = [];
      let current = startHour * 60; // em minutos
      const end = endHour * 60;

      while (current < end) {
          const h = Math.floor(current / 60);
          const m = current % 60;
          const timeString = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
          slots.push(timeString);
          current += slotDuration;
      }
      return slots;
  };

  const timeSlots = generateTimeSlots();

  // Encontra sessão que COMEÇA neste horário
  const getSessionStartingAt = (time: string) => {
      return sessions.find(s => 
          s.date === formattedDate && 
          s.status !== 'canceled' &&
          s.startTime === time
      );
  };

  // Verifica se o horário está ocupado por uma sessão que começou antes
  const isSlotOccupiedByPreviousSession = (time: string) => {
      return sessions.some(s => {
          if (s.date !== formattedDate || s.status === 'canceled') return false;
          // Se o horário atual é maior que o início E menor que o fim da sessão
          return time > s.startTime && time < s.endTime;
      });
  };

  // --- Criação de Sessão ---
  const handleSlotClick = (time: string) => {
      setCreateError(null);
      setNewSessionData({
          startTime: time,
          patientId: '',
          type: 'ONLINE',
          notes: '',
          duration: slotDuration // Sugere o intervalo padrão, mas permite editar
      });
      setShowCreateModal(true);
  };

  const calculateEndTime = (start: string, durationMins: number) => {
      const [h, m] = start.split(':').map(Number);
      const startInMins = h * 60 + m;
      const endInMins = startInMins + durationMins;
      const endH = Math.floor(endInMins / 60);
      const endM = endInMins % 60;
      return `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`;
  };

  const handleCreateSession = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newSessionData.patientId) return;
      
      setIsSavingNew(true);
      setCreateError(null);

      const endTime = calculateEndTime(newSessionData.startTime, newSessionData.duration);
      
      // Verifica conflito
      const hasConflict = await checkSessionConflict(formattedDate, newSessionData.startTime, endTime);
      if (hasConflict) {
          setCreateError("Conflito de horário! Já existe uma sessão neste intervalo.");
          setIsSavingNew(false);
          return;
      }

      const newSession: Session = {
          id: crypto.randomUUID(),
          patientId: newSessionData.patientId,
          date: formattedDate,
          startTime: newSessionData.startTime,
          endTime: endTime,
          status: 'scheduled',
          type: newSessionData.type,
          notes: newSessionData.notes,
          value: 150, // Valor padrão, poderia vir da config
          isPaid: false
      };

      await saveSession(newSession);
      await loadData();
      setIsSavingNew(false);
      setShowCreateModal(false);
  };

  // --- Lógica de Presença (Mantida) ---
  const handleQuickAttendance = async (session: Session, status: 'completed') => {
      const updatedSessions = sessions.map(s => s.id === session.id ? { ...s, status } : s);
      setSessions(updatedSessions);
      const updatedSession = { ...session, status };
      await saveSession(updatedSession);
  };

  const openAbsenceModal = (session: Session) => {
      setSelectedSession(session);
      if (session.status === 'absent' && session.notes.startsWith('JUSTIFICATIVA DE FALTA:')) {
        const existingJustification = session.notes.split('\n\n')[0].replace('JUSTIFICATIVA DE FALTA: ', '');
        setJustification(existingJustification);
      } else {
        setJustification('');
      }
      setShowAttendanceModal(true);
  };

  const confirmAbsence = async () => {
      if (!selectedSession) return;
      if (!justification.trim()) {
          alert("A justificativa é obrigatória.");
          return;
      }
      let updatedNotes = selectedSession.notes;
      if (updatedNotes.startsWith('JUSTIFICATIVA DE FALTA:')) {
          const parts = updatedNotes.split('\n\n');
          parts.shift();
          updatedNotes = parts.join('\n\n');
      }
      const finalNotes = `JUSTIFICATIVA DE FALTA: ${justification}\n\n${updatedNotes}`;
      const status: 'absent' = 'absent';

      const updatedSessions = sessions.map(s => s.id === selectedSession.id ? { ...s, status, notes: finalNotes.trim() } : s);
      setSessions(updatedSessions);
      const updatedSession: Session = { ...selectedSession, status, notes: finalNotes.trim() };
      await saveSession(updatedSession);
      setShowAttendanceModal(false);
  };

  // --- Componente Mini Calendário ---
  const MiniCalendar = () => {
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay(); // 0 = Domingo
    
    const days = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(i);

    const hasSessionOnDay = (day: number) => {
        const checkDate = new Date(year, month, day).toISOString().split('T')[0];
        return sessions.some(s => s.date === checkDate && s.status !== 'canceled');
    };

    return (
        <div className="bg-[var(--bg-card)] p-4 rounded-xl border border-[var(--border-color)] shadow-xl absolute top-14 left-0 sm:left-auto sm:right-0 z-30 w-64 animate-fade-in">
            <div className="flex justify-between items-center mb-3 border-b border-[var(--border-color)] pb-2">
                <span className="font-bold text-sm text-[var(--text-main)] capitalize">
                    {selectedDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                </span>
                <button onClick={() => setShowCalendar(false)} className="text-[var(--text-secondary)] hover:text-[var(--text-main)]">
                    <X size={16} />
                </button>
            </div>
            <div className="grid grid-cols-7 text-center text-xs gap-y-2">
                {['D','S','T','Q','Q','S','S'].map(d => <span key={d} className="font-bold text-[var(--text-secondary)]">{d}</span>)}
                {days.map((d, idx) => (
                    <button 
                        key={idx} 
                        disabled={!d}
                        onClick={() => {
                            if(d) {
                                const newDate = new Date(year, month, d);
                                setSelectedDate(newDate);
                                setShowCalendar(false);
                            }
                        }}
                        className={`
                            h-8 w-8 rounded-full flex items-center justify-center relative transition
                            ${!d ? '' : d === selectedDate.getDate() ? 'bg-[var(--primary)] text-white shadow-md' : 'hover:bg-[var(--nav-hover)] text-[var(--text-main)]'}
                        `}
                    >
                        {d}
                        {d && hasSessionOnDay(d) && d !== selectedDate.getDate() && (
                            <span className="absolute bottom-1 w-1 h-1 bg-[var(--primary)] rounded-full"></span>
                        )}
                    </button>
                ))}
            </div>
        </div>
    );
  };

  if (loading) return <div className="flex justify-center p-10"><Loader2 className="animate-spin text-[var(--primary)]" /></div>;

  return (
    <div className="space-y-4 h-[calc(100vh-100px)] flex flex-col">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 flex-none">
        <div>
            <h2 className="text-2xl font-bold text-[var(--text-main)]">Agenda</h2>
            <div className="flex items-center space-x-2 text-[var(--text-secondary)] text-sm">
                <p>Gerencie seus horários.</p>
                <span className="hidden sm:inline">•</span>
                <div className="flex items-center space-x-1">
                    <Clock size={12} />
                    <span>Slots:</span>
                    <select 
                        value={slotDuration} 
                        onChange={(e) => setSlotDuration(Number(e.target.value))}
                        className="bg-transparent border-none outline-none font-bold text-[var(--primary)] cursor-pointer hover:underline p-0"
                    >
                        <option value={30}>30 min</option>
                        <option value={40}>40 min</option>
                        <option value={50}>50 min</option>
                        <option value={60}>1 hora</option>
                    </select>
                </div>
            </div>
        </div>
        
        {/* Navegador de Data */}
        <div className="bg-[var(--bg-card)] rounded-lg border border-[var(--border-color)] flex items-center p-1 shadow-sm relative">
            <button onClick={prevDay} className="p-2 hover:bg-[var(--nav-hover)] rounded-md transition text-[var(--text-secondary)]">
                <ChevronLeft size={20} />
            </button>
            <button 
                onClick={() => setShowCalendar(!showCalendar)}
                className="flex items-center space-x-2 px-4 py-1 hover:bg-[var(--nav-hover)] rounded-md transition min-w-[160px] justify-center"
            >
                <CalendarIcon className="text-[var(--primary)]" size={18} />
                <span className="font-bold text-[var(--text-main)] capitalize text-sm">{displayDate}</span>
            </button>
            <button onClick={nextDay} className="p-2 hover:bg-[var(--nav-hover)] rounded-md transition text-[var(--text-secondary)]">
                <ChevronRight size={20} />
            </button>
            
            {showCalendar && <MiniCalendar />}
        </div>
      </div>

      {/* Grid da Agenda */}
      <div className="bg-[var(--bg-card)] rounded-xl shadow-sm border border-[var(--border-color)] flex-1 overflow-hidden flex flex-col">
         <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
            <div className="space-y-2">
                {timeSlots.map((time) => {
                    const session = getSessionStartingAt(time);
                    const isOccupied = isSlotOccupiedByPreviousSession(time);
                    
                    return (
                        <div key={time} className="flex group min-h-[70px]">
                            {/* Coluna do Horário */}
                            <div className="w-16 flex-none text-right pr-4 pt-3 border-r border-transparent">
                                <span className={`text-sm font-bold font-mono ${session || isOccupied ? 'text-[var(--text-main)]' : 'text-[var(--text-secondary)] opacity-50'}`}>
                                    {time}
                                </span>
                            </div>

                            {/* Conteúdo do Slot */}
                            <div className="flex-1 pl-4 relative py-1">
                                {session ? (
                                    // SLOT COM SESSÃO (CARD)
                                    <div className={`
                                        h-full p-3 rounded-[10px] border-l-4 transition relative shadow-sm hover:shadow-md
                                        ${
                                            session.status === 'completed' ? 'border-green-500 bg-green-900/10' : 
                                            session.status === 'canceled' ? 'border-red-500 bg-red-900/10' : 
                                            session.status === 'absent' ? 'border-orange-500 bg-orange-900/10' :
                                            'border-[var(--primary)] bg-[var(--primary)] bg-opacity-10'
                                        }
                                    `}>
                                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-1">
                                            <div className="flex items-center space-x-3">
                                                <div>
                                                    <h4 className="font-bold text-[var(--text-main)] leading-tight">{getPatientName(session.patientId)}</h4>
                                                    <div className="flex items-center space-x-2 text-xs text-[var(--text-secondary)] mt-0.5">
                                                        <span>{session.startTime} - {session.endTime}</span>
                                                        <span>•</span>
                                                        <span className="uppercase">{session.type}</span>
                                                    </div>
                                                </div>
                                                
                                                {/* Botões de Ação Rápida */}
                                                <div className="flex items-center space-x-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity ml-2">
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); handleQuickAttendance(session, 'completed'); }}
                                                        className={`p-1.5 rounded-full border transition ${session.status === 'completed' ? 'bg-green-500 text-white border-green-500' : 'bg-white text-green-600 border-green-200 hover:bg-green-50'}`}
                                                        title="Compareceu"
                                                    >
                                                        <CheckCircle size={14} />
                                                    </button>
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); openAbsenceModal(session); }}
                                                        className={`p-1.5 rounded-full border transition ${session.status === 'absent' ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-orange-600 border-orange-200 hover:bg-orange-50'}`}
                                                        title="Faltou"
                                                    >
                                                        <XCircle size={14} />
                                                    </button>
                                                </div>
                                            </div>

                                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider self-start sm:self-center
                                                ${
                                                    session.status === 'completed' ? 'text-green-600 bg-green-100' : 
                                                    session.status === 'canceled' ? 'text-red-600 bg-red-100' : 
                                                    session.status === 'absent' ? 'text-orange-600 bg-orange-100' :
                                                    'text-[var(--primary)] bg-white border border-[var(--primary)]'
                                                }
                                            `}>
                                                {session.status === 'scheduled' ? 'Agendado' : session.status === 'completed' ? 'Realizada' : session.status === 'absent' ? 'Faltou' : 'Cancelada'}
                                            </span>
                                        </div>
                                        {session.notes && (
                                            <p className="text-xs text-[var(--text-secondary)] mt-1 truncate opacity-70 max-w-md">{session.notes}</p>
                                        )}
                                    </div>
                                ) : isOccupied ? (
                                    // SLOT OCUPADO VISUALMENTE (CONTINUAÇÃO)
                                    <div className="h-full border-l-2 border-dashed border-[var(--border-color)] ml-1 pl-4 flex items-center opacity-30">
                                        <span className="text-xs text-[var(--text-placeholder)] select-none">Em atendimento...</span>
                                    </div>
                                ) : (
                                    // SLOT VAZIO (DISPONÍVEL)
                                    <button 
                                        onClick={() => handleSlotClick(time)}
                                        className="w-full h-full border border-dashed border-[var(--border-color)] rounded-[10px] flex items-center justify-start pl-4 text-[var(--text-placeholder)] hover:border-[var(--primary)] hover:text-[var(--primary)] hover:bg-[var(--primary)]/5 transition group/slot"
                                    >
                                        <div className="flex items-center space-x-2 opacity-0 group-hover/slot:opacity-100 transition-opacity">
                                            <Plus size={16} />
                                            <span className="text-sm font-medium">Agendar {time}</span>
                                        </div>
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
         </div>
      </div>

      {/* Modal de Justificativa de Falta */}
      {showAttendanceModal && selectedSession && (
          <div className="fixed inset-0 bg-[var(--modal-overlay)] flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-[var(--bg-card)] rounded-[20px] w-full max-w-sm shadow-2xl p-6 border border-[var(--border-color)]">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h3 className="text-xl font-bold text-[var(--text-main)]">Registrar Falta</h3>
                        <p className="text-sm text-[var(--text-secondary)]">
                           {getPatientName(selectedSession.patientId)} • {selectedSession.startTime}
                        </p>
                    </div>
                    <button onClick={() => setShowAttendanceModal(false)} className="text-[var(--text-secondary)] hover:text-[var(--text-main)]">
                        <X size={20} />
                    </button>
                </div>
                
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-[var(--text-main)] mb-2">Justificativa <span className="text-red-500">*</span></label>
                        <textarea 
                            value={justification}
                            onChange={(e) => setJustification(e.target.value)}
                            placeholder="Descreva o motivo da falta..."
                            className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-main)] rounded-[10px] p-[14px] focus:ring-2 focus:ring-[var(--primary)] outline-none h-24 resize-none"
                            autoFocus
                        />
                    </div>
                    <div className="flex space-x-3">
                        <button 
                            onClick={() => setShowAttendanceModal(false)}
                            className="flex-1 py-2 text-[var(--text-secondary)] hover:bg-[var(--nav-hover)] rounded-[10px]"
                        >
                            Cancelar
                        </button>
                        <button 
                            onClick={confirmAbsence}
                            className="flex-1 py-2 bg-orange-500 text-white rounded-[10px] hover:bg-orange-600 font-medium"
                        >
                            Confirmar Falta
                        </button>
                    </div>
                </div>
            </div>
          </div>
      )}

      {/* Modal de Criação de Sessão */}
      {showCreateModal && (
          <div className="fixed inset-0 bg-[var(--modal-overlay)] flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-[var(--bg-card)] rounded-[20px] w-full max-w-md shadow-2xl p-6 border border-[var(--border-color)]">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h3 className="text-xl font-bold text-[var(--text-main)]">Novo Agendamento</h3>
                        <p className="text-sm text-[var(--text-secondary)]">
                           {formattedDate.split('-').reverse().join('/')} às {newSessionData.startTime}
                        </p>
                    </div>
                    <button onClick={() => setShowCreateModal(false)} className="text-[var(--text-secondary)] hover:text-[var(--text-main)]">
                        <X size={20} />
                    </button>
                </div>

                {createError && (
                    <div className="mb-4 bg-[#FF4D4D]/10 text-[#FF4D4D] p-3 rounded-lg flex items-center text-sm border border-[#FF4D4D]/20">
                        <AlertCircle size={16} className="mr-2" />
                        {createError}
                    </div>
                )}

                <form onSubmit={handleCreateSession} className="space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-[var(--text-main)] mb-2">Paciente</label>
                        <div className="relative">
                            <select 
                                required
                                value={newSessionData.patientId}
                                onChange={e => setNewSessionData({...newSessionData, patientId: e.target.value})}
                                className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-main)] rounded-[10px] p-[14px] appearance-none focus:ring-2 focus:ring-[var(--primary)] outline-none"
                            >
                                <option value="">Selecione um paciente...</option>
                                {patients.map(p => (
                                    <option key={p.id} value={p.id}>{p.fullName}</option>
                                ))}
                            </select>
                            <div className="absolute right-4 top-4 pointer-events-none text-[var(--text-secondary)]">
                                <Search size={16} />
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-[var(--text-main)] mb-2">Modalidade</label>
                            <select 
                                value={newSessionData.type}
                                onChange={e => setNewSessionData({...newSessionData, type: e.target.value as any})}
                                className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-main)] rounded-[10px] p-[14px] focus:ring-2 focus:ring-[var(--primary)] outline-none"
                            >
                                <option value="ONLINE">Online</option>
                                <option value="PRESENCIAL">Presencial</option>
                            </select>
                        </div>
                         <div>
                            <label className="block text-sm font-bold text-[var(--text-main)] mb-2">Duração (minutos)</label>
                            <input
                                type="number"
                                required
                                min="10"
                                max="240"
                                value={newSessionData.duration}
                                onChange={e => setNewSessionData({...newSessionData, duration: Number(e.target.value)})}
                                className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-main)] rounded-[10px] p-[14px] focus:ring-2 focus:ring-[var(--primary)] outline-none"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-[var(--text-main)] mb-2">Observações (Opcional)</label>
                        <textarea 
                            value={newSessionData.notes}
                            onChange={e => setNewSessionData({...newSessionData, notes: e.target.value})}
                            className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-main)] rounded-[10px] p-[14px] focus:ring-2 focus:ring-[var(--primary)] outline-none h-20 resize-none"
                        />
                    </div>

                    <div className="pt-4 flex space-x-3">
                         <button 
                            type="button"
                            onClick={() => setShowCreateModal(false)}
                            className="flex-1 py-3 text-[var(--text-secondary)] hover:bg-[var(--nav-hover)] rounded-[10px] transition"
                        >
                            Cancelar
                        </button>
                        <button 
                            type="submit"
                            disabled={isSavingNew}
                            className="flex-1 py-3 bg-[var(--primary)] text-white rounded-[10px] hover:bg-[var(--primary-hover)] font-bold flex justify-center items-center transition shadow-md"
                        >
                            {isSavingNew ? <Loader2 className="animate-spin" /> : 'Confirmar'}
                        </button>
                    </div>
                </form>
            </div>
          </div>
      )}
    </div>
  );
};