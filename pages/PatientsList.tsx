import React, { useState, useEffect } from 'react';
import { Search, Plus, User, Trash2, Loader2, AlertCircle } from 'lucide-react';
import { getPatients, savePatient, deletePatient } from '../services/storageService';
import { Patient } from '../types';

interface PatientsListProps {
  onSelectPatient: (id: string) => void;
}

export const PatientsList: React.FC<PatientsListProps> = ({ onSelectPatient }) => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New Patient Form State
  const [newPatient, setNewPatient] = useState<Partial<Patient>>({
    fullName: '',
    birthDate: '',
    cpf: '',
    phone: '',
    notes: '',
    preferredType: 'ONLINE'
  });

  const loadPatients = async () => {
    try {
        setError(null);
        setLoading(true);
        const data = await getPatients();
        setPatients(data);
    } catch (err: any) {
        console.error(err);
        setError(err.message || 'Falha ao carregar pacientes.');
    } finally {
        setLoading(false);
    }
  };

  useEffect(() => {
    loadPatients();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPatient.fullName) return;
    setSaving(true);
    setError(null);

    try {
        const patient: Patient = {
          id: crypto.randomUUID(),
          fullName: newPatient.fullName!,
          birthDate: newPatient.birthDate || '',
          cpf: newPatient.cpf || '',
          phone: newPatient.phone || '',
          email: newPatient.email || '',
          clinicalHistory: '',
          notes: newPatient.notes || '',
          diagnosis: '',
          preferredType: newPatient.preferredType || 'ONLINE',
          registrationDate: new Date().toISOString()
        };

        await savePatient(patient);
        await loadPatients();
        setIsModalOpen(false);
        setNewPatient({ preferredType: 'ONLINE', fullName: '', birthDate: '', cpf: '', phone: '', notes: '' });
    } catch (err: any) {
        setError(err.message || 'Erro ao salvar paciente.');
    } finally {
        setSaving(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation(); // Garante que não abra o detalhe do paciente
    
    if (confirm('Tem certeza que deseja excluir este paciente? Todos os dados (sessões, documentos) serão perdidos permanentemente.')) {
      try {
          await deletePatient(id);
          // Remove da lista localmente para feedback instantâneo ou recarrega
          setPatients(current => current.filter(p => p.id !== id));
      } catch (err: any) {
          console.error("Erro ao excluir:", err);
          alert(`Erro ao excluir paciente: ${err.message || 'Verifique se há registros dependentes.'}`);
      }
    }
  };

  const filteredPatients = patients.filter(p => 
    p.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.cpf.includes(searchTerm)
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[var(--text-main)]">Meus Pacientes</h2>
          <p className="text-[var(--text-secondary)]">Gerencie os cadastros e prontuários.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-[var(--primary)] text-white px-6 py-3 rounded-[10px] hover:bg-[var(--primary-hover)] transition flex items-center space-x-2 shadow-sm font-medium"
        >
          <Plus size={18} />
          <span>Novo Paciente</span>
        </button>
      </div>

      {error && (
        <div className="bg-red-900/10 border border-red-500/20 text-red-500 p-4 rounded-lg flex items-center">
            <AlertCircle size={20} className="mr-2" />
            {error}
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <input
          type="text"
          placeholder="Buscar por nome ou CPF..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-[var(--bg-card)] text-[var(--text-main)] pl-10 pr-4 py-[14px] border border-[var(--border-color)] rounded-[10px] focus:ring-2 focus:ring-[var(--primary)] outline-none placeholder-[var(--text-placeholder)]"
        />
        <Search className="absolute left-3 top-3.5 text-[var(--text-placeholder)]" size={20} />
      </div>

      {/* List */}
      <div className="bg-[var(--bg-card)] rounded-xl shadow-sm border border-[var(--border-color)] overflow-hidden">
        {loading ? (
             <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-[var(--primary)]" /></div>
        ) : filteredPatients.length === 0 ? (
          <div className="p-12 text-center text-[var(--text-secondary)]">
            <User size={48} className="mx-auto mb-4 text-[var(--border-color)]" />
            <p className="text-lg font-medium">Nenhum paciente encontrado</p>
            <p className="text-sm">Cadastre um novo paciente para começar.</p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--border-color)]">
            {filteredPatients.map(patient => (
              <div 
                key={patient.id} 
                onClick={() => onSelectPatient(patient.id)}
                className="p-4 hover:bg-[var(--nav-hover)] transition cursor-pointer flex justify-between items-center group relative"
              >
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 rounded-full bg-[var(--primary)] bg-opacity-20 text-[var(--primary)] flex items-center justify-center font-bold">
                    {patient.fullName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-medium text-[var(--text-main)]">{patient.fullName}</h3>
                    <p className="text-sm text-[var(--text-secondary)]">{patient.phone} • {patient.email}</p>
                    <span className="text-[10px] bg-[var(--bg-input)] text-[var(--text-secondary)] px-2 py-0.5 rounded uppercase mt-1 inline-block border border-[var(--border-color)]">
                        {patient.preferredType || 'ONLINE'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <span className="text-xs text-[var(--text-secondary)] hidden sm:block">
                    Cadastrado em {new Date(patient.registrationDate).toLocaleDateString('pt-BR')}
                  </span>
                  <button 
                    onClick={(e) => handleDelete(e, patient.id)}
                    className="p-2 text-[var(--text-secondary)] hover:text-[#FF4D4D] hover:bg-[#FF4D4D]/10 rounded-full transition z-10"
                    title="Excluir Paciente"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-[var(--modal-overlay)] flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-[var(--bg-card)] rounded-[20px] w-full max-w-lg shadow-2xl p-6 overflow-y-auto max-h-[90vh] border border-[var(--border-color)]">
            <h3 className="text-xl font-bold text-[var(--text-main)] mb-4">Novo Paciente</h3>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Nome Completo</label>
                <input 
                  required
                  type="text" 
                  value={newPatient.fullName}
                  onChange={e => setNewPatient({...newPatient, fullName: e.target.value})}
                  className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-main)] placeholder-[var(--text-placeholder)] rounded-[10px] p-[14px] focus:ring-2 focus:ring-[var(--primary)] outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Data de Nascimento</label>
                  <input 
                    type="date" 
                    value={newPatient.birthDate}
                    onChange={e => setNewPatient({...newPatient, birthDate: e.target.value})}
                    className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-main)] placeholder-[var(--text-placeholder)] rounded-[10px] p-[14px] focus:ring-2 focus:ring-[var(--primary)] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">CPF</label>
                  <input 
                    type="text" 
                    value={newPatient.cpf}
                    onChange={e => setNewPatient({...newPatient, cpf: e.target.value})}
                    placeholder="000.000.000-00"
                    className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-main)] placeholder-[var(--text-placeholder)] rounded-[10px] p-[14px] focus:ring-2 focus:ring-[var(--primary)] outline-none"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Telefone</label>
                  <input 
                    type="tel" 
                    value={newPatient.phone}
                    onChange={e => setNewPatient({...newPatient, phone: e.target.value})}
                    className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-main)] placeholder-[var(--text-placeholder)] rounded-[10px] p-[14px] focus:ring-2 focus:ring-[var(--primary)] outline-none"
                  />
                </div>
                 <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Email (Opcional)</label>
                  <input 
                    type="email" 
                    value={newPatient.email}
                    onChange={e => setNewPatient({...newPatient, email: e.target.value})}
                    className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-main)] placeholder-[var(--text-placeholder)] rounded-[10px] p-[14px] focus:ring-2 focus:ring-[var(--primary)] outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Tipo de Atendimento Preferencial</label>
                <select 
                    value={newPatient.preferredType}
                    onChange={e => setNewPatient({...newPatient, preferredType: e.target.value as any})}
                    className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-main)] rounded-[10px] p-[14px] focus:ring-2 focus:ring-[var(--primary)] outline-none"
                >
                    <option value="ONLINE">Online</option>
                    <option value="PRESENCIAL">Presencial</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Observações Iniciais</label>
                <textarea 
                  value={newPatient.notes}
                  onChange={e => setNewPatient({...newPatient, notes: e.target.value})}
                  className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-main)] placeholder-[var(--text-placeholder)] rounded-[10px] p-[14px] focus:ring-2 focus:ring-[var(--primary)] outline-none h-24 resize-none"
                />
              </div>
              
              {error && <p className="text-red-500 text-sm text-center">{error}</p>}
              
              <div className="flex justify-end space-x-3 pt-4 border-t border-[var(--border-color)]">
                <button 
                  type="button"
                  disabled={saving}
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-[var(--text-secondary)] hover:bg-[var(--nav-hover)] rounded-[10px]"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2 bg-[var(--primary)] text-white rounded-[10px] hover:bg-[var(--primary-hover)] font-medium flex items-center"
                >
                  {saving && <Loader2 className="animate-spin mr-2" size={16} />}
                  Salvar Paciente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};