import React, { ReactNode } from 'react';
import { LayoutDashboard, Users, Calendar, FileText, Settings, LogOut, Brain, Sun, Moon, DollarSign } from 'lucide-react';
import { ViewState } from '../types';

interface LayoutProps {
  children: ReactNode;
  currentView: ViewState;
  onNavigate: (view: ViewState) => void;
  onLogout: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

const NavItem = ({ 
  icon: Icon, 
  label, 
  isActive, 
  onClick 
}: { 
  icon: any, 
  label: string, 
  isActive: boolean, 
  onClick: () => void 
}) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-[10px] transition-colors mb-1
      ${isActive 
        ? 'bg-[var(--primary)] text-white shadow-md' 
        : 'text-[var(--text-secondary)] hover:bg-[var(--nav-hover)] hover:text-[var(--text-main)]'
      }`}
  >
    <Icon size={20} />
    <span className="font-medium">{label}</span>
  </button>
);

export const Layout: React.FC<LayoutProps> = ({ children, currentView, onNavigate, onLogout, theme, onToggleTheme }) => {
  const handleLogout = () => {
    onLogout();
  };

  return (
    <div className="flex min-h-screen bg-[var(--bg-main)] text-[var(--text-main)] font-sans transition-colors duration-300">
      {/* Sidebar */}
      <aside className="w-64 bg-[var(--bg-card)] border-r border-[var(--border-color)] hidden md:flex flex-col fixed h-full z-10 no-print transition-colors duration-300">
        <div className="p-6 border-b border-[var(--border-color)] flex items-center space-x-2">
          <div className="w-8 h-8 bg-[var(--primary)] rounded-[10px] flex items-center justify-center text-white">
            <Brain size={20} />
          </div>
          <h1 className="text-xl font-bold text-[var(--text-main)]">PsiPro</h1>
        </div>

        <nav className="flex-1 p-4 overflow-y-auto">
          <NavItem 
            icon={LayoutDashboard} 
            label="Painel" 
            isActive={currentView === 'DASHBOARD'} 
            onClick={() => onNavigate('DASHBOARD')} 
          />
          <NavItem 
            icon={Users} 
            label="Pacientes" 
            isActive={currentView === 'PATIENTS' || currentView === 'PATIENT_DETAIL'} 
            onClick={() => onNavigate('PATIENTS')} 
          />
          <NavItem 
            icon={Calendar} 
            label="Agenda" 
            isActive={currentView === 'AGENDA'} 
            onClick={() => onNavigate('AGENDA')} 
          />
          <NavItem 
            icon={DollarSign} 
            label="Financeiro" 
            isActive={currentView === 'FINANCE'} 
            onClick={() => onNavigate('FINANCE')} 
          />
          <NavItem 
            icon={FileText} 
            label="Documentos" 
            isActive={currentView === 'DOCUMENTS'} 
            onClick={() => onNavigate('DOCUMENTS')} 
          />
          <NavItem 
            icon={Settings} 
            label="Configurações" 
            isActive={currentView === 'SETTINGS'} 
            onClick={() => onNavigate('SETTINGS')} 
          />
        </nav>

        <div className="p-4 border-t border-[var(--border-color)] space-y-2">
          <button 
            onClick={onToggleTheme}
            className="w-full flex items-center space-x-3 px-4 py-3 text-[var(--text-secondary)] hover:bg-[var(--nav-hover)] hover:text-[var(--text-main)] rounded-[10px] transition-colors"
          >
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            <span className="font-medium">Tema {theme === 'dark' ? 'Claro' : 'Escuro'}</span>
          </button>
          
          <button 
            onClick={handleLogout}
            className="w-full flex items-center space-x-3 px-4 py-3 text-[#FF4D4D] hover:bg-[var(--nav-hover)] rounded-[10px] transition-colors"
          >
            <LogOut size={20} />
            <span className="font-medium">Sair</span>
          </button>
        </div>
      </aside>

      {/* Mobile Header (Visible only on small screens) */}
      <div className="md:hidden fixed top-0 w-full bg-[var(--bg-card)] border-b border-[var(--border-color)] z-20 p-4 flex justify-between items-center no-print transition-colors duration-300">
        <div className="flex items-center space-x-2">
          <Brain className="text-[var(--primary)]" />
          <span className="font-bold text-lg text-[var(--text-main)]">PsiPro</span>
        </div>
        <div className="flex items-center space-x-4">
             <button onClick={onToggleTheme} className="text-[var(--text-secondary)]">
                {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <button className="text-[var(--text-secondary)]" onClick={() => onNavigate('DASHBOARD')}>Menu</button>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 md:ml-64 p-4 md:p-8 mt-14 md:mt-0 overflow-y-auto print:ml-0 print:p-0 print:mt-0 bg-[var(--bg-main)] transition-colors duration-300">
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
};