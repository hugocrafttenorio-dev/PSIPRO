import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Calendar, FileText, User, Plus, Wand2, Loader2, AlertCircle, DollarSign, Repeat, CheckCircle, Pencil, Trash2, X, ClipboardList, Lock, Save, FilePlus, Printer, Download, UserCheck, Check, XCircle } from 'lucide-react';
import { getPatients, savePatient, getSessions, saveSession, saveMultipleSessions, checkSessionConflict, getDocuments, uploadAndSaveDocument, getSettings, deleteSession, getDocumentDownloadUrl } from '../services/storageService';
import { Patient, Session, ClinicalDocument, DocumentType, ClinicalNotes } from '../types';
import { enhanceClinicalNotes } from '../services/geminiService';

interface PatientDetailProps {
  patientId: string;
  onBack: () => void;
}

type Tab = 'INFO' | 'SESSIONS' | 'DOCS';

const INITIAL_CLINICAL_NOTES: ClinicalNotes = {
  keyPoints: '',
  summary: '',
  feelings: '',
  behaviors: '',
  quotes: '',
  names: '',
  interventions: '',
  evolution: '',
  insights: '',
  mood: '',
  technicalRegister: ''
};

// CSS Styles for generated documents
const DOC_STYLES = `
  body { font-family: 'Helvetica', 'Arial', sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; }
  .doc-container { max-width: 800px; margin: 0 auto; background: white; padding: 40px; }
  .header { text-align: center; margin-bottom: 40px; border-bottom: 2px solid #333; padding-bottom: 20px; }
  .header h1 { font-size: 24px; text-transform: uppercase; margin: 0; font-weight: bold; letter-spacing: 1px; }
  .header p { margin: 5px 0 0; font-size: 14px; color: #666; }
  .section-title { font-size: 16px; font-weight: bold; text-transform: uppercase; margin-top: 30px; margin-bottom: 15px; border-bottom: 1px solid #ddd; padding-bottom: 5px; color: #222; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 30px; background: #f9f9f9; padding: 20px; border-radius: 8px; border: 1px solid #eee; }
  .info-item { margin-bottom: 5px; }
  .label { font-weight: bold; color: #444; margin-right: 5px; }
  .content-text { text-align: justify; margin-bottom: 15px; }
  .field-block { margin-bottom: 20px; }
  .field-label { font-weight: bold; display: block; margin-bottom: 5px; color: #111; }
  .field-value { display: block; text-align: justify; background: #fff; }
  .signature-box { margin-top: 80px; text-align: center; }
  .signature-line { width: 300px; border-top: 1px solid #333; margin: 0 auto 10px; }
  .footer { margin-top: 50px; font-size: 10px; text-align: center; color: #999; border-top: 1px solid #eee; padding-top: 10px; }
`;

export const PatientDetail: React.FC<PatientDetailProps> = ({ patientId, onBack }) => {
  const [patient, setPatient] = useState<Patient | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('INFO');
  const [sessions, setSessions] = useState<Session[]>([]);
  const [documents, setDocuments] = useState<ClinicalDocument[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Forms states
  const [isEditing, setIsEditing] = useState(false);
  const [editedPatient, setEditedPatient] = useState<Patient | null>(null);
  const [isSavingPatient, setIsSavingPatient] = useState(false);
  
  // Session Modal State
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [conflictError, setConflictError] = useState<string | null>(null);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [isSavingSession, setIsSavingSession] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);

  // Attendance Modal State
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [attendanceSession, setAttendanceSession] = useState<Session | null>(null);
  const [attendanceJustification, setAttendanceJustification] = useState('');
  const [showJustificationInput, setShowJustificationInput] = useState(false);

  // Clinical Notes Modal State
  const [showClinicalModal, setShowClinicalModal] = useState(false);
  const [currentClinicalSession, setCurrentClinicalSession] = useState<Session | null>(null);
  const [clinicalFormData, setClinicalFormData] = useState<ClinicalNotes>(INITIAL_CLINICAL_NOTES);
  const [enhancingField, setEnhancingField] = useState<keyof ClinicalNotes | null>(null);
  const [isSavingNotes, setIsSavingNotes] = useState(false);

  // Document Preview Modal State
  const [previewDoc, setPreviewDoc] = useState<ClinicalDocument | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Delete Confirmation State
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);

  // Expanded Session State
  const [newSession, setNewSession] = useState<{
    date: string;
    startTime: string;
    endTime: string;
    notes: string;
    status: 'scheduled' | 'completed' | 'canceled' | 'absent';
    type: 'ONLINE' | 'PRESENCIAL';
    value: number;
    isPaid: boolean;
    isRecurring: boolean;
  }>({
    date: new Date().toISOString().split('T')[0],
    startTime: '09:00',
    endTime: '10:00',
    notes: '',
    status: 'scheduled',
    type: 'ONLINE',
    value: 150, // Default value example
    isPaid: false,
    isRecurring: false
  });

  useEffect(() => {
    loadData();
  }, [patientId]);

  const loadData = async () => {
    setLoading(true);
    const [allPatients, allSessions, allDocs] = await Promise.all([
        getPatients(),
        getSessions(),
        getDocuments()
    ]);

    const found = allPatients.find(p => p.id === patientId);
    if (found) {
      setPatient(found);
      setEditedPatient(found);
      setNewSession(prev => ({...prev, type: found.preferredType || 'ONLINE'}));
    }
    
    setSessions(allSessions.filter(s => s.patientId === patientId).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    setDocuments(allDocs.filter(d => d.patientId === patientId).sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    setLoading(false);
  };

  const handleUpdatePatient = async () => {
    if (editedPatient) {
      setIsSavingPatient(true);
      await savePatient(editedPatient);
      setPatient(editedPatient);
      setIsEditing(false);
      setIsSavingPatient(false);
    }
  };

  const openNewSessionModal = () => {
    setEditingSessionId(null);
    setNewSession({
        date: new Date().toISOString().split('T')[0],
        startTime: '09:00',
        endTime: '10:00',
        notes: '',
        status: 'scheduled',
        type: patient?.preferredType || 'ONLINE',
        value: 150,
        isPaid: false,
        isRecurring: false
    });
    setConflictError(null);
    setShowSessionModal(true);
  };

  const openEditSessionModal = (session: Session) => {
    setEditingSessionId(session.id);
    setNewSession({
        date: session.date,
        startTime: session.startTime,
        endTime: session.endTime,
        notes: session.notes,
        status: session.status,
        type: session.type,
        value: session.value,
        isPaid: session.isPaid,
        isRecurring: false // Default to false when editing to avoid accidental duplication
    });
    setConflictError(null);
    setShowSessionModal(true);
  };

  const openAttendanceModal = (session: Session) => {
    setAttendanceSession(session);
    // Try to extract existing justification if absent
    if (session.status === 'absent' && session.notes.startsWith('JUSTIFICATIVA DE FALTA:')) {
        const just = session.notes.split('\n\n')[0].replace('JUSTIFICATIVA DE FALTA: ', '');
        setAttendanceJustification(just);
        setShowJustificationInput(true);
    } else {
        setAttendanceJustification('');
        setShowJustificationInput(false);
    }
    setShowAttendanceModal(true);
  };

  const confirmAttendance = async (status: 'completed' | 'absent') => {
      if (!attendanceSession) return;

      if (status === 'absent' && !showJustificationInput) {
          setShowJustificationInput(true);
          return;
      }

      if (status === 'absent' && !attendanceJustification.trim()) {
          alert("A justificativa é obrigatória para registrar falta.");
          return;
      }

      let updatedNotes = attendanceSession.notes;
      
      // Clean previous justification if exists to avoid duplication
      if (updatedNotes.startsWith('JUSTIFICATIVA DE FALTA:')) {
         const parts = updatedNotes.split('\n\n');
         parts.shift(); // remove justification
         updatedNotes = parts.join('\n\n');
      }

      if (status === 'absent') {
          updatedNotes = `JUSTIFICATIVA DE FALTA: ${attendanceJustification}\n\n${updatedNotes}`;
      }

      const updatedSession: Session = {
          ...attendanceSession,
          status: status,
          notes: updatedNotes.trim()
      };

      await saveSession(updatedSession);
      await loadData();
      setShowAttendanceModal(false);
      
      // Feedback UI
      alert(status === 'completed' ? 'Presença confirmada com sucesso!' : 'Falta registrada com justificativa.');
  };

  const openClinicalNotesModal = (session: Session) => {
    setCurrentClinicalSession(session);
    if (session.clinicalRecord) {
      setClinicalFormData(session.clinicalRecord);
    } else {
      setClinicalFormData(INITIAL_CLINICAL_NOTES);
    }
    setShowClinicalModal(true);
  };

  const createFormattedDocumentContent = async (session: Session, notes: ClinicalNotes) => {
      const settings = await getSettings();
      const dateStr = new Date(session.date).toLocaleDateString('pt-BR');
      
      return `
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
            <meta charset="UTF-8">
            <style>${DOC_STYLES}</style>
        </head>
        <body>
            <div class="doc-container">
                <div class="header">
                    <h1>Prontuário de Sessão</h1>
                    <p>Registro Clínico Individual</p>
                </div>

                <div class="info-grid">
                    <div class="info-item"><span class="label">PACIENTE:</span> ${patient?.fullName}</div>
                    <div class="info-item"><span class="label">DATA:</span> ${dateStr}</div>
                    <div class="info-item"><span class="label">HORÁRIO:</span> ${session.startTime} às ${session.endTime}</div>
                    <div class="info-item"><span class="label">MODALIDADE:</span> ${session.type}</div>
                </div>

                <div class="content-body">
                    <div class="section-title">1. Registro Técnico</div>
                    <div class="content-text">${notes.technicalRegister ? notes.technicalRegister.replace(/\n/g, '<br>') : 'Não registrado.'}</div>

                    <div class="section-title">2. Detalhamento da Sessão</div>
                    
                    ${notes.summary ? `<div class="field-block"><span class="field-label">Resumo do Conteúdo:</span><span class="field-value">${notes.summary}</span></div>` : ''}
                    ${notes.keyPoints ? `<div class="field-block"><span class="field-label">Pontos-Chave:</span><span class="field-value">${notes.keyPoints}</span></div>` : ''}
                    ${notes.feelings ? `<div class="field-block"><span class="field-label">Sentimentos Expressos:</span><span class="field-value">${notes.feelings}</span></div>` : ''}
                    ${notes.behaviors ? `<div class="field-block"><span class="field-label">Comportamentos Observados:</span><span class="field-value">${notes.behaviors}</span></div>` : ''}
                    ${notes.interventions ? `<div class="field-block"><span class="field-label">Intervenções Terapêuticas:</span><span class="field-value">${notes.interventions}</span></div>` : ''}
                    ${notes.evolution ? `<div class="field-block"><span class="field-label">Evolução Percebida:</span><span class="field-value">${notes.evolution}</span></div>` : ''}
                    ${notes.insights ? `<div class="field-block"><span class="field-label">Insights:</span><span class="field-value">${notes.insights}</span></div>` : ''}
                </div>

                <div class="signature-box">
                    <div class="signature-line"></div>
                    <p><strong>${settings.name}</strong></p>
                    <p>Psicólogo(a) - CRP ${settings.crp}</p>
                </div>

                <div class="footer">
                    Documento gerado automaticamente pelo sistema PsiPro em ${new Date().toLocaleString('pt-BR')}
                </div>
            </div>
        </body>
        </html>
      `;
  };

  const handleSaveClinicalNotes = async (e?: React.FormEvent) => {
    if(e) e.preventDefault();
    if (!currentClinicalSession || !patient) return;
    setIsSavingNotes(true);

    try {
        const updatedSession: Session = {
            ...currentClinicalSession,
            clinicalRecord: clinicalFormData
        };
        await saveSession(updatedSession);

        const contentText = await createFormattedDocumentContent(updatedSession, clinicalFormData);
        const fileBlob = new Blob([contentText], { type: 'text/html;charset=utf-8' });
        
        const doc: ClinicalDocument = {
            id: crypto.randomUUID(),
            patientId: patient.id,
            type: DocumentType.SESSION_RECORD,
            title: `Prontuário - ${new Date(updatedSession.date).toLocaleDateString('pt-BR')}`,
            content: contentText, 
            createdAt: new Date().toISOString()
        };
        
        await uploadAndSaveDocument(doc, fileBlob);
        await loadData();
        
        if (e) {
            setShowClinicalModal(false);
            alert("Anotações salvas e documento gerado na Central de Documentos.");
        }
    } catch (err) {
        console.error(err);
        alert("Erro ao salvar anotações.");
    } finally {
        setIsSavingNotes(false);
    }
  };

  const handleManualDocumentGeneration = async () => {
      if (currentClinicalSession && patient) {
          setIsSavingNotes(true);
          try {
            const updatedSession = {
                ...currentClinicalSession,
                clinicalRecord: clinicalFormData
            };
            await saveSession(updatedSession);
            
            const contentText = await createFormattedDocumentContent(updatedSession, clinicalFormData);
            const fileBlob = new Blob([contentText], { type: 'text/html;charset=utf-8' });
            
            const doc: ClinicalDocument = {
                id: crypto.randomUUID(),
                patientId: patient.id,
                type: DocumentType.SESSION_RECORD,
                title: `Prontuário - ${new Date(updatedSession.date).toLocaleDateString('pt-BR')}`,
                content: contentText,
                createdAt: new Date().toISOString()
            };
            await uploadAndSaveDocument(doc, fileBlob);
            await loadData();
            alert("Documento salvo com sucesso na Central de Documentos.");
          } catch(err) {
              console.error(err);
              alert("Erro ao gerar documento.");
          } finally {
              setIsSavingNotes(false);
          }
      }
  };

  const handleEnhanceField = async (field: keyof ClinicalNotes) => {
    const text = clinicalFormData[field];
    if (!text) return;
    
    setEnhancingField(field);
    const enhanced = await enhanceClinicalNotes(text);
    setClinicalFormData(prev => ({...prev, [field]: enhanced}));
    setEnhancingField(null);
  };

  const handleAddOrUpdateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patient) return;
    setIsSavingSession(true);

    const hasConflict = await checkSessionConflict(newSession.date, newSession.startTime, newSession.endTime, editingSessionId || undefined);
    if (hasConflict) {
      setConflictError("Já existe uma sessão agendada neste horário!");
      setIsSavingSession(false);
      return;
    }

    const recurrenceId = newSession.isRecurring && !editingSessionId ? crypto.randomUUID() : undefined;
    const sessionsToSave: Session[] = [];

    const existingSession = editingSessionId ? sessions.find(s => s.id === editingSessionId) : null;
    
    const baseSession: Session = {
      id: editingSessionId || crypto.randomUUID(),
      patientId: patient.id,
      date: newSession.date,
      startTime: newSession.startTime,
      endTime: newSession.endTime,
      notes: newSession.notes,
      status: newSession.status,
      type: newSession.type,
      value: Number(newSession.value),
      isPaid: newSession.isPaid,
      recurrenceId: existingSession?.recurrenceId || recurrenceId,
      clinicalRecord: existingSession?.clinicalRecord
    };

    sessionsToSave.push(baseSession);

    if (newSession.isRecurring && !editingSessionId) {
        let currentDate = new Date(newSession.date + 'T00:00:00');
        
        for (let i = 1; i < 12; i++) {
            currentDate.setDate(currentDate.getDate() + 7);
            const nextDateStr = currentDate.toISOString().split('T')[0];

            if (!await checkSessionConflict(nextDateStr, newSession.startTime, newSession.endTime)) {
                sessionsToSave.push({
                    ...baseSession,
                    id: crypto.randomUUID(),
                    date: nextDateStr,
                    notes: '', 
                    status: 'scheduled', 
                    isPaid: false, 
                    clinicalRecord: undefined 
                });
            }
        }
    }

    if (sessionsToSave.length === 1) {
        await saveSession(sessionsToSave[0]);
    } else {
        await saveMultipleSessions(sessionsToSave);
    }

    await loadData();
    setIsSavingSession(false);
    setShowSessionModal(false);
    setConflictError(null);
  };

  const confirmDeleteSession = async () => {
    if (sessionToDelete) {
      await deleteSession(sessionToDelete);
      await loadData();
      setSessionToDelete(null);
    }
  };

  const handleEnhanceNotes = async () => {
    if (!newSession.notes) return;
    setIsEnhancing(true);
    const enhanced = await enhanceClinicalNotes(newSession.notes);
    setNewSession(prev => ({...prev, notes: enhanced}));
    setIsEnhancing(false);
  };

  const togglePayment = async (session: Session) => {
    const updated = { ...session, isPaid: !session.isPaid };
    await saveSession(updated);
    await loadData();
  };

  const getWhatsAppLink = (session: Session, p: Patient) => {
    const message = `Olá ${p.fullName}, lembrete da sua sessão de terapia (${session.type}) agendada para ${new Date(session.date).toLocaleDateString('pt-BR')} às ${session.startTime}.`;
    const phone = p.phone.replace(/\D/g, '');
    return `https://wa.me/55${phone}?text=${encodeURIComponent(message)}`;
  };

  const generateDocument = async (type: DocumentType) => {
    if (!patient) return;
    const settings = await getSettings();
    const today = new Date().toLocaleDateString('pt-BR');
    
    let title = '';
    let contentHtml = '';

    if (type === DocumentType.DECLARATION) {
      title = 'Declaração de Comparecimento';
      contentHtml = `
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
            <meta charset="UTF-8">
            <style>${DOC_STYLES}</style>
        </head>
        <body>
            <div class="doc-container">
                <div class="header">
                    <h1>Declaração</h1>
                </div>

                <div class="content-text" style="margin-top: 60px; line-height: 2; font-size: 16px;">
                    <p>
                        Declaro para os devidos fins que o(a) Sr(a). <strong>${patient.fullName}</strong>, 
                        inscrito(a) no CPF sob nº <strong>${patient.cpf || '___________'}</strong>, 
                        esteve em atendimento psicológico sob meus cuidados nesta data.
                    </p>
                </div>

                <div class="signature-box" style="margin-top: 100px;">
                    <div class="signature-line"></div>
                    <p><strong>${settings.name}</strong></p>
                    <p>Psicólogo(a) - CRP ${settings.crp}</p>
                    <p style="margin-top: 20px; font-size: 14px;">${today}</p>
                </div>
            </div>
        </body>
        </html>
      `;
    } else {
      title = 'Laudo Psicológico Simples';
      contentHtml = `
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
            <meta charset="UTF-8">
            <style>${DOC_STYLES}</style>
        </head>
        <body>
            <div class="doc-container">
                <div class="header">
                    <h1>Laudo Psicológico</h1>
                </div>

                <div class="info-grid">
                    <div class="info-item"><span class="label">PACIENTE:</span> ${patient.fullName}</div>
                    <div class="info-item"><span class="label">DATA NASCIMENTO:</span> ${new Date(patient.birthDate).toLocaleDateString('pt-BR')}</div>
                    <div class="info-item"><span class="label">CPF:</span> ${patient.cpf || '-'}</div>
                    <div class="info-item"><span class="label">DATA EMISSÃO:</span> ${today}</div>
                </div>

                <div class="content-body">
                    <div class="section-title">1. Histórico Clínico Resumido</div>
                    <div class="content-text">${patient.clinicalHistory ? patient.clinicalHistory.replace(/\n/g, '<br>') : 'Não informado.'}</div>

                    <div class="section-title">2. Diagnóstico</div>
                    <div class="content-text">${patient.diagnosis || 'Em avaliação.'}</div>

                    <div class="section-title">3. Observações</div>
                    <div class="content-text">
                        Paciente encontra-se em acompanhamento psicológico regular sob meus cuidados profissionais.
                        ${patient.notes ? `<br><br>${patient.notes.replace(/\n/g, '<br>')}` : ''}
                    </div>
                </div>

                <div class="signature-box">
                    <div class="signature-line"></div>
                    <p><strong>${settings.name}</strong></p>
                    <p>Psicólogo(a) - CRP ${settings.crp}</p>
                </div>
            </div>
        </body>
        </html>
      `;
    }

    const fileBlob = new Blob([contentHtml], { type: 'text/html;charset=utf-8' });

    const doc: ClinicalDocument = {
      id: crypto.randomUUID(),
      patientId: patient.id,
      type,
      title,
      content: contentHtml,
      createdAt: new Date().toISOString()
    };
    
    await uploadAndSaveDocument(doc, fileBlob);
    await loadData();
    // Instead of active tab change, show preview immediately
    setPreviewDoc(doc);
  };

  const handlePreview = (doc: ClinicalDocument) => {
    setPreviewDoc(doc);
  };

  const handlePrintFrame = () => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
        const iframeWindow = iframeRef.current.contentWindow;
        iframeWindow.focus();
        // Small timeout to ensure focus is applied before printing
        // This fixes issues where print dialog doesn't appear in sandboxed iframes
        setTimeout(() => {
            iframeWindow.print();
        }, 100);
    }
  };

  const preparePreviewContent = (content: string) => {
      // Ensure it has UTF-8 charset meta tag to display accents correctly
      if (!content) return '';
      let html = content;
      if (!html.toLowerCase().includes('<meta charset')) {
          if (html.toLowerCase().includes('<head>')) {
              html = html.replace('<head>', '<head><meta charset="UTF-8">');
          } else {
              // Legacy/Plain text fallback wrapper
               html = `<!DOCTYPE html>
               <html lang="pt-BR">
               <head>
                 <meta charset="UTF-8">
                 <title>Documento</title>
                 <style>body { font-family: sans-serif; padding: 2rem; white-space: pre-wrap; }</style>
               </head>
               <body>${html}</body>
               </html>`;
          }
      }
      return html;
  };

  // --- Monthly Attendance Logic ---
  const now = new Date();
  const currentMonthStats = sessions.reduce((acc, session) => {
      const sDate = new Date(session.date + 'T00:00:00');
      if (sDate.getMonth() === now.getMonth() && sDate.getFullYear() === now.getFullYear()) {
          if (session.status === 'completed') acc.attended++;
          if (session.status === 'absent') acc.missed++;
      }
      return acc;
  }, { attended: 0, missed: 0 });
  const currentMonthName = now.toLocaleDateString('pt-BR', { month: 'long' });

  if (loading || !patient || !editedPatient) return <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-[var(--primary)]" /></div>;

  return (
    <div className="space-y-6">
      <button onClick={onBack} className="flex items-center text-[var(--text-secondary)] hover:text-[var(--primary)] transition">
        <ArrowLeft size={18} className="mr-2" />
        Voltar para lista
      </button>

      {/* Header */}
      <div className="bg-[var(--bg-card)] p-6 rounded-xl shadow-sm border border-[var(--border-color)] flex justify-between items-start">
        <div className="flex items-center space-x-4">
          <div className="w-16 h-16 bg-[var(--primary)] bg-opacity-20 text-[var(--primary)] rounded-full flex items-center justify-center text-2xl font-bold">
            {patient.fullName.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-main)]">{patient.fullName}</h1>
            <p className="text-[var(--text-secondary)]">{patient.email} • {patient.phone}</p>
            <div className="flex mt-1 space-x-2 mb-2">
                <span className={`text-xs px-2 py-0.5 rounded border ${patient.preferredType === 'PRESENCIAL' ? 'bg-orange-900/30 text-orange-400 border-orange-900/50' : 'bg-blue-900/30 text-blue-400 border-blue-900/50'}`}>
                    {patient.preferredType || 'ONLINE'}
                </span>
            </div>
            {/* Monthly Attendance Marker */}
            <div className="flex items-center space-x-3 text-sm mt-3">
                <div className="flex items-center space-x-1 text-[var(--text-secondary)] bg-[var(--bg-input)] px-2 py-1 rounded-md">
                    <Calendar size={12} />
                    <span className="capitalize text-xs font-bold">{currentMonthName}</span>
                </div>
                <div className="flex items-center text-green-600 bg-green-500/10 px-2 py-1 rounded-md border border-green-500/20" title="Presenças neste mês">
                    <CheckCircle size={14} className="mr-1.5" />
                    <span className="font-bold">{currentMonthStats.attended}</span>
                </div>
                 <div className="flex items-center text-orange-600 bg-orange-500/10 px-2 py-1 rounded-md border border-orange-500/20" title="Faltas neste mês">
                    <XCircle size={14} className="mr-1.5" />
                    <span className="font-bold">{currentMonthStats.missed}</span>
                </div>
            </div>
          </div>
        </div>
        <div className="space-x-3">
            <button 
                onClick={() => generateDocument(DocumentType.DECLARATION)}
                className="px-3 py-2 text-sm border border-[var(--border-color)] rounded-[10px] hover:bg-[var(--nav-hover)] text-[var(--text-main)]"
            >
                Gerar Declaração
            </button>
            <button 
                onClick={() => generateDocument(DocumentType.REPORT)}
                className="px-3 py-2 text-sm border border-[var(--border-color)] rounded-[10px] hover:bg-[var(--nav-hover)] text-[var(--text-main)]"
            >
                Gerar Laudo
            </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-[var(--border-color)] flex space-x-6">
        <button 
          onClick={() => setActiveTab('INFO')}
          className={`pb-3 font-medium text-sm transition ${activeTab === 'INFO' ? 'text-[var(--primary)] border-b-2 border-[var(--primary)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-main)]'}`}
        >
          Dados Pessoais
        </button>
        <button 
          onClick={() => setActiveTab('SESSIONS')}
          className={`pb-3 font-medium text-sm transition ${activeTab === 'SESSIONS' ? 'text-[var(--primary)] border-b-2 border-[var(--primary)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-main)]'}`}
        >
          Sessões & Financeiro
        </button>
        <button 
          onClick={() => setActiveTab('DOCS')}
          className={`pb-3 font-medium text-sm transition ${activeTab === 'DOCS' ? 'text-[var(--primary)] border-b-2 border-[var(--primary)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-main)]'}`}
        >
          Documentos Gerados
        </button>
      </div>

      {/* Content */}
      <div className="bg-[var(--bg-card)] p-6 rounded-xl shadow-sm border border-[var(--border-color)]">
        
        {/* INFO TAB */}
        {activeTab === 'INFO' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg text-[var(--text-main)]">Ficha Cadastral</h3>
              <button 
                onClick={() => isEditing ? handleUpdatePatient() : setIsEditing(true)}
                className="text-[var(--primary)] text-sm font-medium hover:underline hover:text-[var(--primary-hover)] flex items-center"
              >
                {isSavingPatient && <Loader2 className="animate-spin mr-2" size={14} />}
                {isEditing ? 'Salvar Alterações' : 'Editar Dados'}
              </button>
            </div>
            {/* Patient Fields (No changes needed here) */}
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2">Nome Completo</label>
                {isEditing ? (
                  <input 
                    className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-main)] rounded-[10px] p-[14px] focus:ring-2 focus:ring-[var(--primary)] outline-none" 
                    value={editedPatient.fullName} 
                    onChange={e => setEditedPatient({...editedPatient, fullName: e.target.value})} 
                  />
                ) : (
                  <p className="text-[var(--text-main)]">{patient.fullName}</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2">CPF</label>
                {isEditing ? (
                  <input 
                    className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-main)] rounded-[10px] p-[14px] focus:ring-2 focus:ring-[var(--primary)] outline-none" 
                    value={editedPatient.cpf} 
                    onChange={e => setEditedPatient({...editedPatient, cpf: e.target.value})} 
                  />
                ) : (
                  <p className="text-[var(--text-main)]">{patient.cpf || '-'}</p>
                )}
              </div>
               <div>
                <label className="block text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2">Preferência de Atendimento</label>
                {isEditing ? (
                  <select 
                    className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-main)] rounded-[10px] p-[14px] focus:ring-2 focus:ring-[var(--primary)] outline-none" 
                    value={editedPatient.preferredType || 'ONLINE'} 
                    onChange={e => setEditedPatient({...editedPatient, preferredType: e.target.value as any})} 
                  >
                    <option value="ONLINE">Online</option>
                    <option value="PRESENCIAL">Presencial</option>
                  </select>
                ) : (
                  <p className="text-[var(--text-main)]">{patient.preferredType || 'ONLINE'}</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2">Telefone</label>
                {isEditing ? (
                  <input 
                    className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-main)] rounded-[10px] p-[14px] focus:ring-2 focus:ring-[var(--primary)] outline-none" 
                    value={editedPatient.phone} 
                    onChange={e => setEditedPatient({...editedPatient, phone: e.target.value})} 
                  />
                ) : (
                  <p className="text-[var(--text-main)]">{patient.phone}</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2">Data de Nascimento</label>
                {isEditing ? (
                  <input 
                    type="date"
                    className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-main)] rounded-[10px] p-[14px] focus:ring-2 focus:ring-[var(--primary)] outline-none" 
                    value={editedPatient.birthDate} 
                    onChange={e => setEditedPatient({...editedPatient, birthDate: e.target.value})} 
                  />
                ) : (
                  <p className="text-[var(--text-main)]">{patient.birthDate ? new Date(patient.birthDate).toLocaleDateString('pt-BR') : '-'}</p>
                )}
              </div>
             
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2">Diagnóstico (CID)</label>
                {isEditing ? (
                  <input 
                    className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-main)] rounded-[10px] p-[14px] focus:ring-2 focus:ring-[var(--primary)] outline-none" 
                    value={editedPatient.diagnosis || ''} 
                    onChange={e => setEditedPatient({...editedPatient, diagnosis: e.target.value})} 
                    placeholder="Ex: F41.1"
                  />
                ) : (
                  <p className="text-[var(--text-main)]">{patient.diagnosis || 'Não informado'}</p>
                )}
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2">Histórico Clínico</label>
                {isEditing ? (
                  <textarea 
                    className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-main)] rounded-[10px] p-[14px] focus:ring-2 focus:ring-[var(--primary)] outline-none h-32" 
                    value={editedPatient.clinicalHistory || ''} 
                    onChange={e => setEditedPatient({...editedPatient, clinicalHistory: e.target.value})} 
                  />
                ) : (
                  <p className="text-[var(--text-main)] whitespace-pre-wrap">{patient.clinicalHistory || 'Nenhum histórico registrado.'}</p>
                )}
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2">Observações Gerais</label>
                {isEditing ? (
                  <textarea 
                    className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-main)] rounded-[10px] p-[14px] focus:ring-2 focus:ring-[var(--primary)] outline-none h-24" 
                    value={editedPatient.notes || ''} 
                    onChange={e => setEditedPatient({...editedPatient, notes: e.target.value})} 
                  />
                ) : (
                  <p className="text-[var(--text-main)] whitespace-pre-wrap">{patient.notes || 'Sem observações.'}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* SESSIONS TAB */}
        {activeTab === 'SESSIONS' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-lg text-[var(--text-main)]">Sessões e Financeiro</h3>
              <button 
                onClick={openNewSessionModal}
                className="bg-[var(--primary)] text-white px-3 py-2 rounded-[10px] hover:bg-[var(--primary-hover)] transition flex items-center space-x-2 text-sm"
              >
                <Plus size={16} />
                <span>Nova Sessão</span>
              </button>
            </div>
            
            {sessions.length === 0 ? (
               <div className="text-center py-10 text-[var(--text-secondary)]">
                   <Calendar size={32} className="mx-auto mb-2" />
                   <p>Nenhuma sessão registrada.</p>
               </div>
            ) : (
                <div className="space-y-4">
                    {sessions.map(session => (
                        <div key={session.id} className="border border-[var(--border-color)] rounded-lg p-4 hover:border-[var(--primary)] transition group relative bg-[var(--bg-card)]">
                            {session.recurrenceId && (
                                <div className="absolute top-2 right-2 text-[var(--text-secondary)]" title="Sessão Recorrente">
                                    <Repeat size={14} />
                                </div>
                            )}

                            <div className="flex justify-between items-start mb-2">
                                <div className="flex flex-wrap items-center gap-2">
                                    {/* Date Badge - Standardized */}
                                    <div className="bg-[var(--primary)] bg-opacity-10 text-[var(--text-main)] px-2.5 py-1 rounded-full text-xs font-bold border border-[var(--primary)]/20 flex items-center">
                                        <Calendar size={12} className="mr-1.5"/>
                                        {new Date(session.date).toLocaleDateString('pt-BR')}
                                    </div>
                                    
                                    {/* Time Badge - Standardized */}
                                    <span className="bg-[var(--bg-input)] text-[var(--text-secondary)] px-2.5 py-1 rounded-full text-xs font-bold border border-[var(--border-color)] font-mono">
                                        {session.startTime} - {session.endTime}
                                    </span>
                                    
                                    {/* Status Badges - Standardized */}
                                    {session.status === 'completed' && <span className="text-xs bg-green-500/10 text-green-600 px-2.5 py-1 rounded-full font-bold border border-green-500/20">Realizada</span>}
                                    {session.status === 'scheduled' && <span className="text-xs bg-yellow-500/10 text-yellow-600 px-2.5 py-1 rounded-full font-bold border border-yellow-500/20">Agendada</span>}
                                    {session.status === 'canceled' && <span className="text-xs bg-red-500/10 text-red-600 px-2.5 py-1 rounded-full font-bold border border-red-500/20">Cancelada</span>}
                                    {session.status === 'absent' && <span className="text-xs bg-orange-500/10 text-orange-600 px-2.5 py-1 rounded-full font-bold border border-orange-500/20">Faltou</span>}
                                    
                                    {/* Type Badge - Standardized */}
                                    <span className="text-xs border border-[var(--border-color)] text-[var(--text-secondary)] px-2.5 py-1 rounded-full font-bold bg-[var(--bg-card)]">
                                        {session.type || 'ONLINE'}
                                    </span>
                                </div>

                                <div className="flex items-center space-x-1 pl-2">
                                    <button 
                                        onClick={() => openAttendanceModal(session)}
                                        className={`p-2 rounded-full transition ${session.status === 'completed' ? 'text-green-500 hover:bg-green-100' : session.status === 'absent' ? 'text-orange-500 hover:bg-orange-100' : 'text-[var(--text-secondary)] hover:text-[var(--primary)] hover:bg-[var(--nav-hover)]'}`}
                                        title="Confirmar Presença / Falta"
                                    >
                                        <UserCheck size={16} />
                                    </button>
                                    <button 
                                        onClick={() => openClinicalNotesModal(session)}
                                        className={`p-2 rounded-full transition ${session.clinicalRecord ? 'text-[var(--primary)] hover:bg-[var(--primary)]/10' : 'text-[var(--text-secondary)] hover:text-[var(--primary)] hover:bg-[var(--nav-hover)]'}`}
                                        title="Anotações Clínicas (Prontuário)"
                                    >
                                        <ClipboardList size={16} />
                                    </button>
                                    <button 
                                        onClick={() => openEditSessionModal(session)}
                                        className="p-2 text-[var(--text-secondary)] hover:text-[var(--primary)] hover:bg-[var(--nav-hover)] rounded-full transition"
                                        title="Editar Sessão"
                                    >
                                        <Pencil size={16} />
                                    </button>
                                    <button 
                                        onClick={() => setSessionToDelete(session.id)}
                                        className="p-2 text-[var(--text-secondary)] hover:text-[#FF4D4D] hover:bg-[#FF4D4D]/10 rounded-full transition"
                                        title="Apagar Sessão"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>

                            <div className="flex justify-between items-end mt-3 pt-3 border-t border-[var(--border-color)]">
                                <div>
                                    <p className="text-[var(--text-main)] whitespace-pre-wrap text-sm mb-1">{session.notes || 'Sem anotações simples.'}</p>
                                    <div className="flex space-x-3 items-center">
                                      <a 
                                          href={getWhatsAppLink(session, patient)} 
                                          target="_blank" 
                                          rel="noopener noreferrer"
                                          className="text-xs text-[#4CAF50] hover:text-[#81C784] flex items-center font-medium"
                                      >
                                          Enviar lembrete no WhatsApp
                                      </a>
                                    </div>
                                </div>
                                <div className="flex flex-col items-end">
                                    <div className="text-sm font-bold text-[var(--text-main)]">R$ {session.value?.toFixed(2) || '0.00'}</div>
                                    <button 
                                        onClick={() => togglePayment(session)}
                                        className={`text-xs flex items-center space-x-1 mt-1 px-2 py-1 rounded transition ${session.isPaid ? 'bg-green-900/30 text-green-400' : 'bg-[var(--bg-input)] text-[var(--text-secondary)] hover:bg-[var(--nav-hover)]'}`}
                                    >
                                        {session.isPaid ? <CheckCircle size={12}/> : <DollarSign size={12}/>}
                                        <span>{session.isPaid ? 'Pago' : 'Pendente'}</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
          </div>
        )}

        {/* DOCS TAB */}
        {activeTab === 'DOCS' && (
             <div>
             <div className="flex justify-between items-center mb-6">
               <h3 className="font-bold text-lg text-[var(--text-main)]">Documentos Emitidos</h3>
             </div>
             {documents.length === 0 ? (
                <div className="text-center py-10 text-[var(--text-secondary)]">
                    <FileText size={32} className="mx-auto mb-2" />
                    <p>Nenhum documento gerado.</p>
                </div>
             ) : (
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     {documents.map(doc => (
                         <div key={doc.id} className="border border-[var(--border-color)] rounded-lg p-4 flex justify-between items-center hover:shadow-md transition">
                             <div className="flex items-center space-x-3">
                                <div className="p-2 bg-[var(--bg-input)] rounded-lg text-[var(--text-secondary)]">
                                    <FileText size={20} />
                                </div>
                                <div>
                                    <p className="font-medium text-[var(--text-main)]">{doc.title}</p>
                                    <p className="text-xs text-[var(--text-secondary)]">{new Date(doc.createdAt).toLocaleDateString('pt-BR')}</p>
                                </div>
                             </div>
                             <div className="flex flex-col items-end">
                                <span className="text-[10px] uppercase bg-[var(--bg-input)] px-2 py-1 rounded mb-1 text-[var(--text-secondary)]">
                                    {doc.type === DocumentType.SESSION_RECORD ? 'Prontuário' : doc.type === DocumentType.DECLARATION ? 'Declaração' : 'Laudo'}
                                </span>
                                <button 
                                    onClick={() => handlePreview(doc)}
                                    className="text-[var(--primary)] text-sm hover:underline hover:text-[var(--primary-hover)]"
                                >
                                    Abrir / Baixar
                                </button>
                             </div>
                         </div>
                     ))}
                 </div>
             )}
           </div>
        )}
      </div>

      {/* Attendance Modal */}
      {showAttendanceModal && attendanceSession && (
        <div className="fixed inset-0 bg-[var(--modal-overlay)] flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-[var(--bg-card)] rounded-[20px] w-full max-w-sm shadow-2xl p-6 border border-[var(--border-color)]">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h3 className="text-xl font-bold text-[var(--text-main)]">Confirmar Presença</h3>
                        <p className="text-sm text-[var(--text-secondary)]">
                            {patient?.fullName} • {new Date(attendanceSession.date).toLocaleDateString('pt-BR')} • {attendanceSession.startTime}
                        </p>
                    </div>
                    <button onClick={() => setShowAttendanceModal(false)} className="text-[var(--text-secondary)] hover:text-[var(--text-main)]">
                        <X size={20} />
                    </button>
                </div>

                {!showJustificationInput ? (
                    <div className="grid grid-cols-2 gap-4 mt-6">
                        <button 
                            onClick={() => confirmAttendance('completed')}
                            className="bg-green-600 hover:bg-green-700 text-white p-4 rounded-xl flex flex-col items-center justify-center space-y-2 transition"
                        >
                            <CheckCircle size={32} />
                            <span className="font-medium">Compareceu</span>
                        </button>
                        <button 
                            onClick={() => {
                                setShowJustificationInput(true);
                            }}
                            className="bg-red-500 hover:bg-red-600 text-white p-4 rounded-xl flex flex-col items-center justify-center space-y-2 transition"
                        >
                            <XCircle size={32} />
                            <span className="font-medium">Faltou</span>
                        </button>
                    </div>
                ) : (
                    <div className="mt-4 space-y-4 animate-fade-in">
                        <div>
                            <label className="block text-sm font-bold text-[var(--text-main)] mb-2">Justificativa da Falta <span className="text-red-500">*</span></label>
                            <textarea 
                                value={attendanceJustification}
                                onChange={(e) => setAttendanceJustification(e.target.value)}
                                placeholder="Descreva o motivo da falta..."
                                className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-main)] rounded-[10px] p-[14px] focus:ring-2 focus:ring-[var(--primary)] outline-none h-24 resize-none"
                            />
                        </div>
                        <div className="flex space-x-3">
                            <button 
                                onClick={() => setShowJustificationInput(false)}
                                className="flex-1 py-2 text-[var(--text-secondary)] hover:bg-[var(--nav-hover)] rounded-[10px]"
                            >
                                Voltar
                            </button>
                            <button 
                                onClick={() => confirmAttendance('absent')}
                                className="flex-1 py-2 bg-red-500 text-white rounded-[10px] hover:bg-red-600 font-medium"
                            >
                                Confirmar Falta
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
      )}

      {/* Clinical Notes Modal */}
      {showClinicalModal && (
        <div className="fixed inset-0 bg-[var(--modal-overlay)] flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-[var(--bg-card)] rounded-[20px] w-full max-w-4xl shadow-2xl p-6 overflow-y-auto max-h-[90vh] border border-[var(--border-color)]">
             <div className="flex justify-between items-center mb-4">
               <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-[var(--primary)] bg-opacity-20 text-[var(--primary)] rounded-full flex items-center justify-center">
                    <ClipboardList size={20} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-[var(--text-main)]">Anotações Clínicas</h3>
                    <p className="text-sm text-[var(--text-secondary)]">Sessão de {currentClinicalSession?.date ? new Date(currentClinicalSession.date).toLocaleDateString('pt-BR') : ''}</p>
                  </div>
               </div>
               <button onClick={() => setShowClinicalModal(false)} className="text-[var(--text-secondary)] hover:text-[var(--text-main)]">
                 <X size={24} />
               </button>
             </div>

             <form onSubmit={handleSaveClinicalNotes} className="space-y-6">
                
                {/* Free Text */}
                <div>
                   <div className="flex justify-between items-center mb-2">
                        <label className="block text-sm font-bold text-[var(--text-main)]">Registro Técnico Completo</label>
                        <button 
                            type="button" 
                            onClick={() => handleEnhanceField('technicalRegister')}
                            disabled={enhancingField === 'technicalRegister' || !clinicalFormData.technicalRegister}
                            className="text-xs flex items-center text-[var(--primary)] hover:text-[var(--primary-hover)] disabled:opacity-50"
                        >
                            {enhancingField === 'technicalRegister' ? <Loader2 className="animate-spin mr-1" size={12}/> : <Wand2 size={12} className="mr-1" />}
                            Melhorar com IA
                        </button>
                   </div>
                   <textarea 
                     value={clinicalFormData.technicalRegister}
                     onChange={e => setClinicalFormData({...clinicalFormData, technicalRegister: e.target.value})}
                     className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-main)] placeholder-[var(--text-placeholder)] rounded-[10px] p-[14px] focus:ring-2 focus:ring-[var(--primary)] outline-none min-h-[150px]"
                     placeholder="Escreva livremente sobre a sessão aqui..."
                   />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   {/* Fields (Reused existing layout, logic is updated) */}
                   {['keyPoints', 'summary', 'feelings', 'behaviors', 'quotes', 'names', 'interventions', 'evolution', 'insights', 'mood'].map((field) => (
                       <div key={field}>
                          <div className="flex justify-between items-center mb-2">
                            <label className="block text-sm font-medium text-[var(--text-secondary)] capitalize">
                                {field === 'keyPoints' ? 'Pontos-chave' : 
                                 field === 'summary' ? 'Resumo' : 
                                 field === 'feelings' ? 'Sentimentos' : 
                                 field === 'behaviors' ? 'Comportamentos' :
                                 field === 'quotes' ? 'Frases Importantes' :
                                 field === 'names' ? 'Nomes Citados' :
                                 field === 'interventions' ? 'Intervenções' :
                                 field === 'evolution' ? 'Evolução' :
                                 field === 'insights' ? 'Insights' : 'Humor'}
                            </label>
                            <button 
                                type="button" 
                                onClick={() => handleEnhanceField(field as keyof ClinicalNotes)}
                                disabled={enhancingField === field || !clinicalFormData[field as keyof ClinicalNotes]}
                                className="text-xs flex items-center text-[var(--primary)] hover:text-[var(--primary-hover)] disabled:opacity-50"
                            >
                                {enhancingField === field ? <Loader2 className="animate-spin mr-1" size={12}/> : <Wand2 size={12} className="mr-1" />}
                                Melhorar com IA
                            </button>
                          </div>
                          <textarea 
                            value={clinicalFormData[field as keyof ClinicalNotes]}
                            onChange={e => setClinicalFormData({...clinicalFormData, [field]: e.target.value})}
                            className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-main)] rounded-[10px] p-[14px] focus:ring-2 focus:ring-[var(--primary)] outline-none h-24 resize-none"
                          />
                       </div>
                   ))}
                </div>

                <div className="flex justify-between pt-4 border-t border-[var(--border-color)] items-center">
                   <button 
                     type="button"
                     onClick={handleManualDocumentGeneration}
                     disabled={isSavingNotes}
                     className="px-4 py-2 text-[var(--text-secondary)] hover:bg-[var(--nav-hover)] hover:text-[var(--primary)] rounded-[10px] flex items-center space-x-2 text-sm"
                   >
                     <FilePlus size={16} />
                     <span>Gerar Documento (Manual)</span>
                   </button>
                   
                   <div className="flex space-x-3">
                       <button 
                         type="button" 
                         disabled={isSavingNotes}
                         onClick={() => setShowClinicalModal(false)}
                         className="px-4 py-2 text-[var(--text-secondary)] hover:bg-[var(--nav-hover)] rounded-[10px]"
                       >
                         Fechar
                       </button>
                       <button 
                         type="submit"
                         disabled={isSavingNotes}
                         className="px-6 py-2 bg-[var(--primary)] text-white rounded-[10px] hover:bg-[var(--primary-hover)] font-medium flex items-center space-x-2"
                       >
                         {isSavingNotes && <Loader2 className="animate-spin mr-2" size={16} />}
                         <Save size={18} />
                         <span>Salvar Anotações</span>
                       </button>
                   </div>
                </div>
             </form>
          </div>
        </div>
      )}

      {/* Session Modal */}
      {showSessionModal && (
        <div className="fixed inset-0 bg-[var(--modal-overlay)] flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-[var(--bg-card)] rounded-[20px] w-full max-w-lg shadow-2xl p-6 overflow-y-auto max-h-[90vh] border border-[var(--border-color)]">
                <h3 className="text-xl font-bold text-[var(--text-main)] mb-4">{editingSessionId ? 'Editar Sessão' : 'Registrar Sessão'}</h3>
                
                {conflictError && (
                    <div className="mb-4 bg-[#FF4D4D]/10 text-[#FF4D4D] p-3 rounded-lg flex items-center text-sm border border-[#FF4D4D]/20">
                        <AlertCircle size={16} className="mr-2" />
                        {conflictError}
                    </div>
                )}

                <form onSubmit={handleAddOrUpdateSession} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Data</label>
                            <input type="date" required value={newSession.date} onChange={e => setNewSession({...newSession, date: e.target.value})} className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-main)] rounded-[10px] p-[14px]" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Status</label>
                            <select value={newSession.status} onChange={e => setNewSession({...newSession, status: e.target.value as any})} className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-main)] rounded-[10px] p-[14px]">
                                <option value="scheduled">Agendada</option>
                                <option value="completed">Realizada</option>
                                <option value="canceled">Cancelada</option>
                                <option value="absent">Faltou</option>
                            </select>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Início</label>
                            <input type="time" required value={newSession.startTime} onChange={e => setNewSession({...newSession, startTime: e.target.value})} className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-main)] rounded-[10px] p-[14px]" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Fim</label>
                            <input type="time" required value={newSession.endTime} onChange={e => setNewSession({...newSession, endTime: e.target.value})} className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-main)] rounded-[10px] p-[14px]" />
                        </div>
                    </div>
                     <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Tipo</label>
                            <select value={newSession.type} onChange={e => setNewSession({...newSession, type: e.target.value as any})} className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-main)] rounded-[10px] p-[14px]">
                                <option value="ONLINE">Online</option>
                                <option value="PRESENCIAL">Presencial</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Valor (R$)</label>
                            <input type="number" required value={newSession.value} onChange={e => setNewSession({...newSession, value: Number(e.target.value)})} className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-main)] rounded-[10px] p-[14px]" />
                        </div>
                    </div>

                    <div className="flex items-center space-x-4 py-2">
                        <label className="flex items-center space-x-2 cursor-pointer">
                            <input type="checkbox" checked={newSession.isPaid} onChange={e => setNewSession({...newSession, isPaid: e.target.checked})} className="w-4 h-4" />
                            <span className="text-sm text-[var(--text-main)]">Pago antecipadamente</span>
                        </label>
                        {!editingSessionId && (
                            <label className="flex items-center space-x-2 cursor-pointer">
                                <input type="checkbox" checked={newSession.isRecurring} onChange={e => setNewSession({...newSession, isRecurring: e.target.checked})} className="w-4 h-4" />
                                <span className="text-sm text-[var(--text-secondary)] font-medium text-purple-400">Repetir Semanalmente</span>
                            </label>
                        )}
                    </div>

                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <label className="block text-sm font-medium text-[var(--text-secondary)]">Anotações / Observações</label>
                            <button type="button" onClick={handleEnhanceNotes} disabled={isEnhancing || !newSession.notes} className="text-xs flex items-center text-[var(--primary)] hover:text-[var(--primary-hover)] disabled:opacity-50">
                                {isEnhancing ? <Loader2 className="animate-spin mr-1" size={12}/> : <Wand2 size={12} className="mr-1" />}
                                Melhorar com IA
                            </button>
                        </div>
                        <textarea value={newSession.notes} onChange={e => setNewSession({...newSession, notes: e.target.value})} className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-main)] rounded-[10px] p-[14px] h-24 resize-none" />
                    </div>

                    <div className="flex justify-end space-x-3 pt-4 border-t border-[var(--border-color)]">
                        <button type="button" onClick={() => setShowSessionModal(false)} className="px-4 py-2 text-[var(--text-secondary)] hover:bg-[var(--nav-hover)] rounded-[10px]">Cancelar</button>
                        <button type="submit" disabled={isSavingSession} className="px-6 py-2 bg-[var(--primary)] text-white rounded-[10px] hover:bg-[var(--primary-hover)] font-medium flex items-center">
                            {isSavingSession && <Loader2 className="animate-spin mr-2" size={16} />}
                            {editingSessionId ? 'Atualizar Sessão' : 'Salvar Sessão'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}

      {/* Delete Modal */}
      {sessionToDelete && (
         <div className="fixed inset-0 bg-[var(--modal-overlay)] flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-[var(--bg-card)] rounded-[20px] w-full max-w-sm shadow-2xl p-6 border border-[var(--border-color)] text-center">
                <div className="w-12 h-12 bg-[#FF4D4D]/20 text-[#FF4D4D] rounded-full flex items-center justify-center mx-auto mb-4">
                    <Trash2 size={24} />
                </div>
                <h3 className="text-lg font-bold text-[var(--text-main)] mb-2">Apagar Sessão?</h3>
                <div className="flex space-x-3 justify-center">
                    <button onClick={() => setSessionToDelete(null)} className="px-4 py-2 text-[var(--text-secondary)]">Cancelar</button>
                    <button onClick={confirmDeleteSession} className="px-4 py-2 bg-[#FF4D4D] text-white rounded-[10px]">Confirmar</button>
                </div>
            </div>
         </div>
      )}

      {/* Document Preview Modal */}
      {previewDoc && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4 backdrop-blur-sm">
            <div className="bg-white rounded-[10px] w-full max-w-4xl shadow-2xl flex flex-col h-[90vh] overflow-hidden">
                <div className="bg-[#f0f0f0] p-4 flex justify-between items-center border-b border-gray-300">
                    <h3 className="font-bold text-gray-800 flex items-center">
                        <FileText size={18} className="mr-2 text-gray-600"/>
                        {previewDoc.title}
                    </h3>
                    <div className="flex items-center space-x-2">
                        <button 
                            onClick={handlePrintFrame}
                            className="bg-white hover:bg-gray-100 text-gray-700 px-3 py-1.5 rounded border border-gray-300 text-sm flex items-center transition"
                        >
                            <Printer size={16} className="mr-2"/>
                            Imprimir
                        </button>
                        <button 
                            onClick={() => setPreviewDoc(null)}
                            className="bg-red-50 hover:bg-red-100 text-red-600 px-3 py-1.5 rounded border border-red-200 text-sm flex items-center transition"
                        >
                            <X size={16} className="mr-1"/>
                            Fechar
                        </button>
                    </div>
                </div>
                <div className="flex-1 bg-gray-500 p-8 overflow-auto flex justify-center">
                    <iframe 
                        ref={iframeRef}
                        srcDoc={preparePreviewContent(previewDoc.content)}
                        className="w-full max-w-[210mm] h-full bg-white shadow-lg"
                        title="Document Preview"
                        sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-modals"
                    />
                </div>
            </div>
        </div>
      )}
    </div>
  );
};