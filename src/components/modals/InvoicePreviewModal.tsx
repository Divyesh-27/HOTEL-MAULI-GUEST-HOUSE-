import React, { useEffect } from 'react';
import { X, Download, Printer } from 'lucide-react';
import { viewInvoicePDF, generateRecordInvoiceHTML } from '@/utils/pdfUtils';

interface InvoicePreviewModalProps {
  record: any;
  onClose: () => void;
}

const InvoicePreviewModal: React.FC<InvoicePreviewModalProps> = ({ record, onClose }) => {
  const htmlContent = generateRecordInvoiceHTML(record);

  // Handle Escape key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleDownloadPDF = async () => {
    await viewInvoicePDF(record);
  };

  const handlePrint = () => {
    if ((window as any).electronAPI?.printPreview) {
      (window as any).electronAPI.printPreview(htmlContent);
    } else {
      const printArea = document.getElementById('printable-area');
      if (printArea) {
        printArea.innerHTML = htmlContent;
      } else {
        const newDiv = document.createElement('div');
        newDiv.id = 'printable-area';
        newDiv.style.display = 'none';
        newDiv.innerHTML = htmlContent;
        document.body.appendChild(newDiv);
      }
      window.print();
      const area = document.getElementById('printable-area');
      if (area && area.parentNode) {
        area.parentNode.removeChild(area);
      }
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 animate-fade-in"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-card rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col animate-scale-in" style={{ maxHeight: '85vh' }}>
        
        {/* Sticky Toolbar */}
        <div className="bg-primary text-primary-foreground p-4 flex justify-between items-center sticky top-0 z-10 shrink-0">
          <div>
            <h3 className="font-bold text-lg">Invoice Preview</h3>
            <p className="text-xs opacity-80">Bill No: {record.billNo || record.id?.slice(-6) || '-'}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded text-xs font-bold flex items-center gap-1.5 transition-colors"
            >
              <Printer className="w-4 h-4" /> Print
            </button>
            <button
              onClick={handleDownloadPDF}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <Download className="w-4 h-4" /> Download PDF
            </button>
            <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-full transition-colors ml-2">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Content Preview — full A4 invoice visible with visible scrollbar */}
        <div
          className="p-6 bg-gray-100 flex justify-center flex-1"
          style={{
            overflowY: 'auto',
            minHeight: 0,
          }}
        >
          <div
            id="invoice-pdf-preview-content"
            className="bg-white shadow-lg rounded w-full"
            style={{
              maxWidth: '210mm',
              padding: '10mm',
            }}
            dangerouslySetInnerHTML={{ __html: htmlContent }}
          />
        </div>

        {/* Footer */}
        <div className="p-4 bg-secondary/50 border-t flex justify-end gap-3 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-card border border-border rounded hover:bg-secondary font-medium text-sm"
          >
            Close
          </button>
          <button
            onClick={handleDownloadPDF}
            className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold text-sm shadow-md flex items-center gap-2"
          >
            <Download className="w-4 h-4" /> Download PDF
          </button>
        </div>
      </div>
    </div>
  );
};

export default InvoicePreviewModal;
