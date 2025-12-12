import React, { useState, useEffect } from 'react';
import { Save, Loader2, X } from 'lucide-react';
import { getSettings, saveSettings } from '../services/storageService';
import { UserSettings } from '../types';

export const Settings: React.FC = () => {
  const [settings, setSettings] = useState<UserSettings>({
    name: '',
    email: '',
    crp: '',
    phone: '',
    address: '',
    document: '',
    specializations: [],
    approach: ''
  });
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Tag Input State
  const [currentTag, setCurrentTag] = useState('');

  useEffect(() => {
    const load = async () => {
        const data = await getSettings();
        setSettings(data);
        setLoading(false);
    };
    load();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await saveSettings(settings);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
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

  if (loading) return <div className="flex justify-center p-10"><Loader2 className="animate-spin text-[var(--primary)]" /></div>;

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-[var(--text-main)]">Configurações</h2>
        <p className="text-[var(--text-secondary)]">Seus dados para emissão de documentos.</p>
      </div>

      <form onSubmit={handleSave} className="bg-[var(--bg-card)] p-6 rounded-xl shadow-sm border border-[var(--border-color)] space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Nome Profissional</label>
                <input 
                    type="text" 
                    value={settings.name}
                    onChange={e => setSettings({...settings, name: e.target.value})}
                    className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-main)] placeholder-[var(--text-placeholder)] rounded-[10px] p-[14px] focus:ring-2 focus:ring-[var(--primary)] outline-none"
                    placeholder="Ex: Dr. João Silva"
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">CRP</label>
                <input 
                    type="text" 
                    value={settings.crp}
                    onChange={e => setSettings({...settings, crp: e.target.value})}
                    className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-main)] placeholder-[var(--text-placeholder)] rounded-[10px] p-[14px] focus:ring-2 focus:ring-[var(--primary)] outline-none"
                    placeholder="00/00000"
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">CPF ou CNPJ (Para Documentos)</label>
                <input 
                    type="text" 
                    value={settings.document || ''}
                    onChange={e => setSettings({...settings, document: e.target.value})}
                    className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-main)] placeholder-[var(--text-placeholder)] rounded-[10px] p-[14px] focus:ring-2 focus:ring-[var(--primary)] outline-none"
                    placeholder="000.000.000-00"
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Telefone Profissional</label>
                <input 
                    type="text" 
                    value={settings.phone}
                    onChange={e => setSettings({...settings, phone: e.target.value})}
                    className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-main)] placeholder-[var(--text-placeholder)] rounded-[10px] p-[14px] focus:ring-2 focus:ring-[var(--primary)] outline-none"
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Email</label>
                <input 
                    type="email" 
                    value={settings.email}
                    onChange={e => setSettings({...settings, email: e.target.value})}
                    className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-main)] placeholder-[var(--text-placeholder)] rounded-[10px] p-[14px] focus:ring-2 focus:ring-[var(--primary)] outline-none"
                />
            </div>
            <div className="md:col-span-2">
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Abordagem de Atendimento</label>
                <input 
                    type="text" 
                    value={settings.approach || ''}
                    onChange={e => setSettings({...settings, approach: e.target.value})}
                    className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-main)] placeholder-[var(--text-placeholder)] rounded-[10px] p-[14px] focus:ring-2 focus:ring-[var(--primary)] outline-none"
                    placeholder="Ex: Psicanálise, TCC, Humanista..."
                />
            </div>
            <div className="md:col-span-2">
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Especializações</label>
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
                     placeholder={settings.specializations?.length ? "Adicionar outra..." : "Digite e pressione Enter..."}
                   />
                </div>
                <p className="text-xs text-[var(--text-secondary)] mt-1">Pressione Enter ou Vírgula para adicionar tags.</p>
            </div>
            <div className="md:col-span-2">
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Endereço do Consultório</label>
                <input 
                    type="text" 
                    value={settings.address}
                    onChange={e => setSettings({...settings, address: e.target.value})}
                    className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-main)] placeholder-[var(--text-placeholder)] rounded-[10px] p-[14px] focus:ring-2 focus:ring-[var(--primary)] outline-none"
                    placeholder="Rua Exemplo, 123, Sala 1"
                />
            </div>
        </div>

        <div className="pt-4 border-t border-[var(--border-color)] flex justify-between items-center">
            {saved && <span className="text-[#4CAF50] text-sm font-medium">Alterações salvas com sucesso!</span>}
            {!saved && <span></span>}
            <button 
                type="submit"
                disabled={saving}
                className="bg-[var(--primary)] text-white px-6 py-2 rounded-[10px] hover:bg-[var(--primary-hover)] transition flex items-center space-x-2 shadow-md font-medium"
            >
                {saving && <Loader2 className="animate-spin mr-2" size={16} />}
                <Save size={18} />
                <span>Salvar Dados</span>
            </button>
        </div>
      </form>
    </div>
  );
};