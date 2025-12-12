import React, { useState, useEffect, useRef } from 'react';
import { FileText, Download, Printer, Search, File, Trash2, Loader2, X } from 'lucide-react';
import { getDocuments, getPatients, deleteDocument, getDocumentDownloadUrl } from '../services/storageService';
import { ClinicalDocument, Patient, DocumentType } from '../types';

export const Documents: React.FC = () => {
  const [documents, setDocuments] = useState<ClinicalDocument[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('ALL');
  const [docToDelete, setDocToDelete] = useState<string | null>(null);
  
  // Preview Modal
  const [previewDoc, setPreviewDoc] = useState<ClinicalDocument | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [docs, pts] = await Promise.all([getDocuments(), getPatients()]);
    setDocuments(docs);
    setPatients(pts);
    setLoading(false);
  };

  const getPatientName = (id: string) => patients.find(p => p.id === id)?.fullName || 'Desconhecido';

  const filteredDocs = documents.filter(doc => {
    const matchesSearch = doc.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          getPatientName(doc.patientId).toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'ALL' || doc.type === filterType;
    return matchesSearch && matchesType;
  });

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

  const downloadWord = async (doc: ClinicalDocument) => {
      const header = "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Documento</title></head><body>";
      const footer = "</body></html>";
      
      const isHtml = doc.content.trim().startsWith('<html') || doc.content.trim().startsWith('<!DOCTYPE');
      
      // If it is already HTML, use it directly. If it is old plain text, replace newlines.
      const htmlContent = isHtml 
        ? doc.content 
        : doc.content.replace(/\n/g, '<br/>');

      const sourceHTML = header + htmlContent + footer;
      
      const source = 'data:application/vnd.ms-word;charset=utf-8,' + encodeURIComponent(sourceHTML);
      const fileDownload = document.createElement("a");
      document.body.appendChild(fileDownload);
      fileDownload.href = source;
      fileDownload.download = `${doc.title.replace(/\s+/g, '_')}.doc`;
      fileDownload.click();
      document.body.removeChild(fileDownload);
  };

  const handleConfirmDelete = async () => {
      if (docToDelete) {
          await deleteDocument(docToDelete);
          await loadData();
          setDocToDelete(null);
          alert("Documento removido com sucesso.");
      }
  };

  if (loading) return <div className="flex justify-center p-10"><Loader2 className="animate-spin text-[var(--primary)]" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-[var(--text-main)]">Central de Documentos</h2>
        <p className="text-[var(--text-secondary)]">Histórico de laudos, declarações e prontuários emitidos.</p>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
            <input
                type="text"
                placeholder="Buscar documento ou paciente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-[var(--bg-card)] text-[var(--text-main)] pl-10 pr-4 py-[14px] border border-[var(--border-color)] rounded-[10px] focus:ring-2 focus:ring-[var(--primary)] outline-none placeholder-[var(--text-placeholder)]"
            />
            <Search className="absolute left-3 top-4 text-[var(--text-placeholder)]" size={18} />
        </div>
        <select 
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="border border-[var(--border-color)] rounded-[10px] px-4 py-[14px] outline-none focus:ring-2 focus:ring-[var(--primary)] bg-[var(--bg-card)] text-[var(--text-main)]"
        >
            <option value="ALL">Todos os Tipos</option>
            <option value="DECLARATION">Declarações</option>
            <option value="REPORT">Laudos</option>
            <option value="SESSION_RECORD">Prontuários</option>
        </select>
      </div>

      <div className="bg-[var(--bg-card)] rounded-xl shadow-sm border border-[var(--border-color)] overflow-hidden">
        {filteredDocs.length === 0 ? (
            <div className="p-12 text-center text-[var(--text-secondary)]">
                <FileText size={48} className="mx-auto mb-4 text-[var(--border-color)]" />
                <p>Nenhum documento encontrado.</p>
            </div>
        ) : (
            <table className="w-full text-left">
                <thead className="bg-[var(--bg-input)] text-[var(--text-secondary)] text-xs uppercase font-semibold">
                    <tr>
                        <th className="px-6 py-4">Documento</th>
                        <th className="px-6 py-4">Paciente</th>
                        <th className="px-6 py-4">Data Emissão</th>
                        <th className="px-6 py-4 text-right">Ações</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-color)]">
                    {filteredDocs.map(doc => (
                        <tr key={doc.id} className="hover:bg-[var(--nav-hover)] transition">
                            <td className="px-6 py-4">
                                <div className="flex items-center space-x-3">
                                    <div className={`p-2 rounded-lg bg-opacity-20 ${doc.type === DocumentType.SESSION_RECORD ? 'bg-purple-500 text-purple-600' : 'bg-[var(--primary)] text-[var(--primary)]'}`}>
                                        <FileText size={18} />
                                    </div>
                                    <div>
                                        <span className="font-medium text-[var(--text-main)] block">{doc.title}</span>
                                        <span className="text-[10px] uppercase text-[var(--text-secondary)]">
                                            {doc.type === DocumentType.SESSION_RECORD ? 'Prontuário' : doc.type === DocumentType.DECLARATION ? 'Declaração' : 'Laudo'}
                                        </span>
                                    </div>
                                </div>
                            </td>
                            <td className="px-6 py-4 text-[var(--text-secondary)]">
                                {getPatientName(doc.patientId)}
                            </td>
                            <td className="px-6 py-4 text-[var(--text-secondary)] text-sm">
                                {new Date(doc.createdAt).toLocaleDateString('pt-BR')}
                            </td>
                            <td className="px-6 py-4 text-right">
                                <div className="flex justify-end space-x-2">
                                    {doc.type === DocumentType.SESSION_RECORD && (
                                        <button 
                                            onClick={() => downloadWord(doc)}
                                            className="text-[var(--text-secondary)] hover:text-blue-600 transition p-2"
                                            title="Baixar Word (.doc)"
                                        >
                                            <FileText size={18} />
                                        </button>
                                    )}
                                    <button 
                                        onClick={() => handlePreview(doc)}
                                        className="text-[var(--text-secondary)] hover:text-[var(--primary)] transition p-2"
                                        title={doc.type === DocumentType.SESSION_RECORD ? "Baixar PDF / Imprimir" : "Imprimir"}
                                    >
                                        {doc.type === DocumentType.SESSION_RECORD ? <File size={18} /> : <Printer size={18} />}
                                    </button>
                                    <button 
                                        onClick={() => setDocToDelete(doc.id)}
                                        className="text-[var(--text-secondary)] hover:text-[#FF4D4D] transition p-2"
                                        title="Excluir Documento"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {docToDelete && (
         <div className="fixed inset-0 bg-[var(--modal-overlay)] flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-[var(--bg-card)] rounded-[20px] w-full max-w-sm shadow-2xl p-6 border border-[var(--border-color)] text-center">
                <div className="w-12 h-12 bg-[#FF4D4D]/20 text-[#FF4D4D] rounded-full flex items-center justify-center mx-auto mb-4">
                    <Trash2 size={24} />
                </div>
                <h3 className="text-lg font-bold text-[var(--text-main)] mb-2">Excluir Documento?</h3>
                <p className="text-[var(--text-secondary)] text-sm mb-6">
                    Tem certeza que deseja excluir permanentemente este documento? Esta ação não pode ser desfeita.
                </p>
                <div className="flex space-x-3 justify-center">
                    <button 
                        onClick={() => setDocToDelete(null)}
                        className="px-4 py-2 text-[var(--text-secondary)] hover:bg-[var(--nav-hover)] rounded-[10px]"
                    >
                        Cancelar
                    </button>
                    <button 
                        onClick={handleConfirmDelete}
                        className="px-4 py-2 bg-[#FF4D4D] text-white rounded-[10px] hover:bg-red-600 font-medium"
                    >
                        Excluir Documento
                    </button>
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