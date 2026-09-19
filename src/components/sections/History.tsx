import { useState } from 'react';
import { useStore } from '@/store/useStore';
import { HistoryRecord } from '@/types';
import { Search, Trash2, Eye, Printer, FileText, Edit2, Download } from 'lucide-react';
import GuestDetailsModal from '@/components/modals/GuestDetailsModal';
import BillingModal from './BillingModal'; // Reuse BillingModal for re-printing
import InvoicePreviewModal from '@/components/modals/InvoicePreviewModal';
import ConfirmModal from '@/components/modals/ConfirmModal';
import { deleteBookingFromCloud } from '@/lib/syncActions';
import { downloadInvoicePDF, generateRecordInvoiceHTML, viewInvoicePDF } from '@/utils/pdfUtils';

import { useShallow } from 'zustand/react/shallow';

const History = () => {
  const { history, removeHistory, updateHistory } = useStore(useShallow(state => ({
    history: state.history,
    removeHistory: state.removeHistory,
    updateHistory: state.updateHistory
  })));
  const [searchTerm, setSearchTerm] = useState('');
  const [viewDetails, setViewDetails] = useState<HistoryRecord | null>(null);
  const [editDetails, setEditDetails] = useState<HistoryRecord | null>(null);
  const [reprintBooking, setReprintBooking] = useState<HistoryRecord | null>(null);
  const [previewInvoice, setPreviewInvoice] = useState<HistoryRecord | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const filteredHistory = history.filter(record => {
    const term = searchTerm.toLowerCase();
    return (
      record.guestName.toLowerCase().includes(term) ||
      record.mobile.includes(term) ||
      record.roomNos.some(r => r.toLowerCase().includes(term))
    );
  });

  const handleDelete = (id: string) => {
    setConfirmDeleteId(id);
  };

  // --- HANDLE UPDATE FROM MODAL ---
  const handleUpdate = (updatedData: any) => {
    if (updateHistory) {
      updateHistory(updatedData);
      if (viewDetails) setViewDetails(updatedData); // Refresh local view
      if (editDetails) setEditDetails(updatedData);
    }
  };

  const handleDownloadDirectPDF = async (record: HistoryRecord) => {
    const tempDiv = document.createElement('div');
    tempDiv.id = `temp-pdf-${record.id}`;
    tempDiv.style.position = 'absolute';
    tempDiv.style.left = '-9999px';
    tempDiv.style.top = '0';
    tempDiv.style.width = '210mm';
    tempDiv.style.background = '#ffffff';
    tempDiv.innerHTML = generateRecordInvoiceHTML(record);
    document.body.appendChild(tempDiv);
    await downloadInvoicePDF(tempDiv, `Invoice_${record.billNo || record.id?.slice(-6) || 'Bill'}`);
    document.body.removeChild(tempDiv);
  };

  return (
    <div className="animate-fade-in space-y-6">
      
      {/* Search Bar */}
      <div className="flex items-center space-x-2 bg-card p-4 rounded-xl shadow-sm border border-border">
        <Search className="text-muted-foreground w-5 h-5" />
        <input
          type="text"
          placeholder="Search History by Name, Mobile, or Room..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 bg-transparent border-none focus:outline-none text-foreground placeholder:text-muted-foreground"
        />
      </div>

      {/* History Table */}
      <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
        <div className="p-6 border-b border-border bg-secondary/50 flex justify-between items-center">
          <h3 className="font-bold text-lg text-foreground">Stay History</h3>
          <span className="text-xs font-bold text-muted-foreground bg-background px-3 py-1 rounded-full border">
            Total Records: {history.length}
          </span>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-secondary text-muted-foreground text-xs uppercase font-bold border-b border-border">
              <tr>
                <th className="px-6 py-4">Checkout Date</th>
                <th className="px-6 py-4">Guest Name</th>
                <th className="px-6 py-4">Room(s)</th>
                <th className="px-6 py-4">Total Paid</th>
                <th className="px-6 py-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-sm font-medium">
              {filteredHistory.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">
                    {searchTerm ? 'No records found.' : 'No history available.'}
                  </td>
                </tr>
              ) : (
                filteredHistory.map((record) => (
                  <tr key={record.id} className="hover:bg-secondary/30 transition-colors">
                    <td className="px-6 py-4 text-xs">
                      {new Date(record.checkoutDate).toLocaleDateString()}
                      <br/>
                      <span className="text-muted-foreground">{new Date(record.checkoutDate).toLocaleTimeString()}</span>
                    </td>
                    <td className="px-6 py-4">
                      {record.guestName?.trim() || (record as any).guest?.trim() || (
                        <span className="text-destructive font-bold italic" title="Guest name missing — click Edit to restore">
                          [Blank Guest Name — Needs Restoration]
                        </span>
                      )}
                      <br/>
                      <span className="text-xs text-muted-foreground">{record.mobile}</span>
                    </td>
                    <td className="px-6 py-4">{record.roomNos.join(', ')}</td>
                    <td className="px-6 py-4 font-mono text-status-available">₹{record.totalPaid}</td>
                    <td className="px-6 py-4">
                      <div className="flex justify-center items-center gap-1.5 flex-wrap">
                        <button 
                          onClick={() => setViewDetails(record)}
                          className="p-1.5 hover:bg-blue-100 text-blue-600 rounded transition-colors"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        
                        <button 
                          onClick={() => setEditDetails(record)}
                          className="p-1.5 hover:bg-amber-100 text-amber-600 rounded transition-colors"
                          title="Edit Record"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        
                        <button 
                          onClick={() => setReprintBooking(record)}
                          className="p-1.5 hover:bg-green-100 text-green-600 rounded transition-colors"
                          title="Reprint Bill"
                        >
                          <Printer className="w-4 h-4" />
                        </button>

                        <button 
                          onClick={() => setPreviewInvoice(record)}
                          className="p-1.5 hover:bg-purple-100 text-purple-600 rounded transition-colors"
                          title="View PDF / Invoice Preview"
                        >
                          <FileText className="w-4 h-4" />
                        </button>

                        <button 
                          onClick={() => viewInvoicePDF(record)}
                          className="px-2 py-1 bg-secondary text-secondary-foreground border border-border rounded text-xs font-bold hover:bg-secondary/80 transition-colors"
                          title="Open PDF"
                        >
                          PDF
                        </button>

                        <button 
                          onClick={() => handleDelete(record.id)}
                          className="p-1.5 hover:bg-red-100 text-red-500 rounded transition-colors"
                          title="Delete Record"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Details Modal (View Mode) */}
      {viewDetails && (
        <GuestDetailsModal 
          key={`view-${viewDetails.id}`}
          data={viewDetails} 
          onClose={() => setViewDetails(null)} 
          onUpdate={handleUpdate}
          initialEditMode={false}
        />
      )}

      {/* Details Modal (Edit Mode) */}
      {editDetails && (
        <GuestDetailsModal 
          key={`edit-${editDetails.id}`}
          data={editDetails} 
          onClose={() => setEditDetails(null)} 
          onUpdate={handleUpdate}
          initialEditMode={true}
        />
      )}

      {/* Reuse Billing Modal for Re-Printing */}
      {reprintBooking && (
        <BillingModal 
          booking={reprintBooking} 
          mode="reprint"
          onClose={() => setReprintBooking(null)} 
        />
      )}

      {/* Invoice Preview Modal */}
      {previewInvoice && (
        <InvoicePreviewModal 
          record={previewInvoice} 
          onClose={() => setPreviewInvoice(null)} 
        />
      )}

      {/* Confirm Delete Modal */}
      <ConfirmModal
        isOpen={confirmDeleteId !== null}
        title="Delete History Record"
        message="Are you sure you want to delete this stay record? This cannot be undone and will remove it from cloud sync."
        variant="danger"
        confirmText="Delete Record"
        onConfirm={() => {
          if (confirmDeleteId !== null) {
            removeHistory(confirmDeleteId);
            deleteBookingFromCloud(confirmDeleteId);
            setConfirmDeleteId(null);
          }
        }}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  );
};

export default History;