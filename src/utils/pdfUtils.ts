import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import mauliLogo from '@/assets/mauli-logo.png';
import { getHotelGSTIN, calculateAccommodationGST } from '@/utils/gstUtils';
import { useStore } from '@/store/useStore';
import { formatDateDDMMYYYY, formatDateTimeDDMMYYYY } from '@/utils/dateUtils';

export const downloadInvoicePDF = async (elementOrId: string | HTMLElement, filename: string) => {
  const element = typeof elementOrId === 'string' ? document.getElementById(elementOrId) : elementOrId;
  if (!element) {
    alert('Preview element not found');
    return;
  }
  try {
    const canvas = await html2canvas(element, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });
    const imgProps = pdf.getImageProperties(imgData);
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    pdf.save(`${filename}.pdf`);
  } catch (error) {
    console.error('Error generating PDF:', error);
    alert('Failed to generate PDF');
  }
};

export const generateRecordInvoiceHTML = (record: any): string => {
  // Always regenerate fresh HTML from current record fields.
  // Never return cached record.invoiceHtml — edits must always reflect immediately.

  let settings;
  try {
    settings = useStore.getState().invoiceSettings;
  } catch {
    settings = undefined;
  }

  const gstEnabled = record.enableGstInvoice ?? (settings ? settings.gst_enabled : true);
  const showGstinFinal = settings ? settings.show_gstin_final : true;
  const showBreakupFinal = settings ? settings.show_breakup_final : true;

  const gstinHTML = (showGstinFinal && gstEnabled)
    ? `<p style="font-size: 11pt; margin: 3px 0 0 0; font-weight: bold;">GSTIN: ${getHotelGSTIN()}</p>`
    : '';

  const invoiceTitle = gstEnabled ? "TAX INVOICE / FINAL BILL" : "FINAL BILL";

  let totalAdvancePaid = 0;
  if (record.advancePayments && record.advancePayments.length > 0) {
    totalAdvancePaid = record.advancePayments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
  } else if (record.advance > 0) {
    totalAdvancePaid = record.advance;
  }

  const extras = record.extras || [];
  const extrasTotal = extras.reduce((acc: number, curr: any) => acc + (curr.amt || 0), 0);
  const extrasLabel = extras.length > 0 ? extras.map((e: any) => e.desc).join(', ') : 'Extra Charges';

  const totalAmount = record.finalAmount || record.totalPaid || 0;
  const remaining = Math.max(0, totalAmount - totalAdvancePaid);

  let roomsList: any[] = [];
  try {
    roomsList = useStore.getState().rooms || [];
  } catch {
    roomsList = [];
  }

  const dailyRoomRate = (record.roomNos || []).reduce((sum: number, rNo: string) => {
    const roomObj = roomsList.find((r: any) => r.roomNo === rNo);
    return sum + (roomObj?.rent || 0);
  }, 0);

  const days = record.days || 1;
  const originalRoomTotal = dailyRoomRate * days;
  const netRoomTotal = Math.max(0, originalRoomTotal - (record.discount || 0));

  const gstInfo = calculateAccommodationGST(dailyRoomRate, days, record.discount || 0, (record.roomNos || []).length);

  const discountHtml = ((record.discount > 0) && (record.showDiscountOnInvoice ?? true)) ? `
    <div style="display: flex; justify-content: space-between; color: #d9534f; font-weight: bold;">
      <span>Discount (${record.discountReason || 'Normal Discount'}):</span>
      <span>(-) ₹ ${Number(record.discount).toFixed(2)}</span>
    </div>
  ` : '';

  const gstRowsHtml = (gstEnabled && showBreakupFinal) ? `
    <div style="display: flex; justify-content: space-between;">
      <span>CGST (${gstInfo.cgstRate}%):</span>
      <span>₹ ${record.cgst_amount ?? gstInfo.cgstAmount.toFixed(2)}</span>
    </div>
    <div style="display: flex; justify-content: space-between;">
      <span>SGST (${gstInfo.sgstRate}%):</span>
      <span>₹ ${record.sgst_amount ?? gstInfo.sgstAmount.toFixed(2)}</span>
    </div>
  ` : '';

  const otherGuestsHtml = (record.otherPersons) ? `
    <div style="margin-top: 10px; padding: 8px; border: 1px dashed #666; font-size: 10pt;">
      <strong>Other Accompanying Guests:</strong> ${record.otherPersons}
    </div>
  ` : '';

  return `
    <div style="padding: 40px; border: 1px solid white; font-family: Arial, sans-serif; color: #000; background: #fff;">
      <div style="text-align: center; border-bottom: 2px solid black; padding-bottom: 15px; margin-bottom: 30px;">
        <img src="${mauliLogo}" alt="Mauli Guest House" style="width: 100px; height: auto; margin: 0 auto 10px auto; display: block;" />
        <h1 style="font-size: 24pt; font-weight: bold; margin: 0; text-transform: uppercase;">Hotel Mauli Guest House</h1>
        <p style="font-size: 11pt; margin: 5px 0 0 0; font-weight: bold;">Prop. J.R. Jaiswal</p>
        <p style="font-size: 11pt; margin: 3px 0 0 0; font-weight: bold;">Mobile: 9405694695</p>
        <p style="font-size: 11pt; margin: 3px 0 0 0; font-weight: bold;">Website: https://hotelmaulimahur.com/</p>
        <p style="font-size: 10pt; margin: 3px 0 0 0; color: #555;">T Point, Renuka Devi Road, Mahurgad, Dist. Nanded – 431721</p>
        ${gstinHTML}
        <h2 style="font-size: 18pt; margin-top: 15px; text-decoration: underline;">${invoiceTitle}</h2>
      </div>

      <div style="display: flex; justify-content: space-between; margin-bottom: 20px; font-size: 11pt; line-height: 1.6;">
        <div style="width: 55%;">
          <div><strong>Guest Name:</strong> ${record.guestName || '-'}</div>
          ${record.customerGstin && record.customerGstin.trim() ? `<div><strong>GSTIN:</strong> ${record.customerGstin.trim().toUpperCase()}</div>` : ''}
          <div><strong>Mobile:</strong> ${record.mobile || '-'}</div>
          <div><strong>Address:</strong> ${record.address || '-'}</div>
          ${record.occupation ? `<div><strong>Occupation:</strong> ${record.occupation}</div>` : ''}
          ${record.identityProofType ? `<div><strong>ID Proof Type:</strong> ${record.identityProofType}</div>` : ''}
          <div><strong>Room No(s):</strong> ${(record.roomNos || []).join(', ')}</div>
          <div><strong>No. of Persons:</strong> ${record.persons || 1}</div>
        </div>
        <div style="width: 40%; text-align: right;">
          <div><strong>Bill No:</strong> ${record.billNo || record.id?.slice(-6) || '-'}</div>
          <div><strong>Date:</strong> ${formatDateDDMMYYYY(record.checkoutDate || new Date())}</div>
          <div><strong>Check-In:</strong> ${record.checkIn ? formatDateTimeDDMMYYYY(record.checkIn) : '-'}</div>
          <div><strong>Check-Out:</strong> ${formatDateTimeDDMMYYYY(record.checkoutDate || new Date())}</div>
        </div>
      </div>

      ${otherGuestsHtml}

      <div style="margin: 20px 0; border: 1px solid #000; padding: 15px;">
        <table style="width: 100%; font-size: 11pt; border-collapse: collapse;">
          <thead>
            <tr style="border-bottom: 1px solid #000;">
              <th style="text-align: left; padding: 8px 0;">Description</th>
              <th style="text-align: center; padding: 8px 0;">Days</th>
              <th style="text-align: right; padding: 8px 0;">Rate</th>
              <th style="text-align: right; padding: 8px 0;">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="padding: 10px 0;">Room Accommodation (${(record.roomNos || []).join(', ')})</td>
              <td style="text-align: center;">${days}</td>
              <td style="text-align: right;">₹${dailyRoomRate.toFixed(2)}</td>
              <td style="text-align: right; font-weight: bold;">₹${originalRoomTotal.toFixed(2)}</td>
            </tr>
            ${extras.map((e: any) => `
              <tr>
                <td style="padding: 5px 0;">${e.desc}</td>
                <td style="text-align: center;">-</td>
                <td style="text-align: right;">-</td>
                <td style="text-align: right; font-weight: bold;">₹${Number(e.amt || 0).toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <div style="width: 50%; margin-left: auto; font-size: 11pt; line-height: 1.8;">
        <div style="display: flex; justify-content: space-between;">
          <span>Room Charges:</span>
          <span>₹ ${originalRoomTotal.toFixed(2)}</span>
        </div>
        ${discountHtml}
        ${extrasTotal > 0 ? `
          <div style="display: flex; justify-content: space-between;">
            <span>${extrasLabel}:</span>
            <span>+ ₹ ${extrasTotal.toFixed(2)}</span>
          </div>
        ` : ''}
        ${gstRowsHtml}
        <div style="border-top: 2px solid black; margin-top: 5px; padding-top: 5px; display: flex; justify-content: space-between; font-weight: bold; font-size: 13pt;">
          <span>Grand Total:</span>
          <span>₹ ${Number(totalAmount).toFixed(2)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; color: #2e7d32;">
          <span>Less: Advance Paid:</span>
          <span>(-) ₹ ${Number(totalAdvancePaid).toFixed(2)}</span>
        </div>
        <div style="border-top: 1px solid black; margin-top: 5px; padding-top: 5px; display: flex; justify-content: space-between; font-weight: bold;">
          <span>Remaining Paid Now:</span>
          <span>₹ ${Number(remaining).toFixed(2)}</span>
        </div>
      </div>

      <div style="margin-top: 60px; display: flex; justify-content: flex-end; font-size: 10pt; font-weight: bold;">
        <div style="text-align: center; border-top: 1px solid black; width: 150px; padding-top: 5px;">Manager Signature</div>
      </div>
      <div style="text-align: center; margin-top: 40px; font-size: 9pt;">
        THANK YOU FOR STAYING WITH US!
      </div>
    </div>
  `;
};

export const viewInvoicePDF = async (record: any): Promise<boolean> => {
  const filename = `Invoice_${record.billNo || record.id?.slice(-6) || 'Bill'}.pdf`;
  if ((window as any).electronAPI) {
    try {
      const exists = await (window as any).electronAPI.pdfExists(filename);
      if (exists) {
        await (window as any).electronAPI.pdfOpen(filename);
        return true;
      }
      
      // If it doesn't exist, generate it automatically
      const htmlContent = generateRecordInvoiceHTML(record);
      
      if ((window as any).electronAPI.pdfGenerate) {
        await (window as any).electronAPI.pdfGenerate(filename, htmlContent);
      } else {
        alert('PDF generation not supported in this environment.');
        return false;
      }
      
      await (window as any).electronAPI.pdfOpen(filename);
      return true;
    } catch (err) {
      console.error('Error in viewInvoicePDF:', err);
      return false;
    }
  }
  return false;
};

export const saveInvoicePDFSilent = async (record: any, asGstBill: boolean = false): Promise<boolean> => {
  let recordToPrint = { ...record };
  if (asGstBill) {
    recordToPrint.enableGstInvoice = true;
  }
  
  const safeHotel = "Hotel_Mauli";
  const safeRoom = (record.roomNos || []).join('-') || "Room";
  const safeGuest = (record.guestName || "Guest").replace(/[^a-zA-Z0-9]/g, '_');
  const safeDate = new Date().toISOString().split('T')[0];
  const filename = `${safeHotel}_${safeRoom}_${safeGuest}_Invoice_${safeDate}.pdf`;
  
  if ((window as any).electronAPI) {
    try {
      const htmlContent = generateRecordInvoiceHTML(recordToPrint);
      if ((window as any).electronAPI.pdfGenerate) {
        await (window as any).electronAPI.pdfGenerate(filename, htmlContent);
        return true;
      } else {
        alert('PDF generation not supported in this environment.');
        return false;
      }
    } catch (err) {
      console.error('Error in saveInvoicePDFSilent:', err);
      return false;
    }
  } else {
    // Fallback for non-electron env
    const tempDiv = document.createElement('div');
    tempDiv.id = `temp-pdf-silent-${record.id}`;
    tempDiv.style.position = 'absolute';
    tempDiv.style.left = '-9999px';
    tempDiv.style.top = '0';
    tempDiv.style.width = '210mm';
    tempDiv.style.background = '#ffffff';
    tempDiv.innerHTML = generateRecordInvoiceHTML(recordToPrint);
    document.body.appendChild(tempDiv);
    await downloadInvoicePDF(tempDiv, filename.replace('.pdf', ''));
    document.body.removeChild(tempDiv);
    return true;
  }
};
