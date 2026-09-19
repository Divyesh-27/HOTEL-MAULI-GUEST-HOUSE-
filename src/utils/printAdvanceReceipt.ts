import mauliLogo from '@/assets/mauli-logo.png';
import { AdvancePayment } from '@/types';
import { getHotelGSTIN } from '@/utils/gstUtils';
import { useStore } from '@/store/useStore';

interface PrintAdvanceProps {
  guestName: string;
  mobile: string;
  roomNos: string[];
  persons: string | number;
  checkIn: string;
  roomTotal: number; // Added back
  advancePayment: AdvancePayment;
  totalAdvancePaid: number; // Added back
}

export const printAdvanceReceipt = ({
  guestName,
  mobile,
  roomNos,
  persons,
  checkIn,
  roomTotal,
  advancePayment,
  totalAdvancePaid
}: PrintAdvanceProps) => {
  let settings;
  try {
    settings = useStore.getState().invoiceSettings;
  } catch {
    settings = undefined;
  }

  const gstEnabled = settings ? settings.gst_enabled : true;
  const showGstinAdvance = settings ? settings.show_gstin_advance : true;
  const gstinHTML = (showGstinAdvance && gstEnabled) 
    ? `<p style="font-size: 11pt; margin: 3px 0 0 0; font-weight: bold;">GSTIN: ${getHotelGSTIN()}</p>` 
    : '';
  
  // Calculate remaining balance for the receipt context
  const remaining = roomTotal - totalAdvancePaid;

  const content = `
    <div style="padding: 40px; border: 1px solid white; font-family: Arial, sans-serif;">
      
      <div style="text-align: center; border-bottom: 2px solid black; padding-bottom: 15px; margin-bottom: 30px;">
        <img src="${mauliLogo}" alt="Mauli Guest House" style="width: 100px; height: auto; margin: 0 auto 10px auto; display: block;" />
        <h1 style="font-size: 24pt; font-weight: bold; margin: 0; text-transform: uppercase;">Hotel Mauli Guest House</h1>
        <p style="font-size: 11pt; margin: 5px 0 0 0; font-weight: bold;">Prop. J.R. Jaiswal</p>
        <p style="font-size: 11pt; margin: 3px 0 0 0; font-weight: bold;">Mobile: 9405694695</p>
        <p style="font-size: 11pt; margin: 3px 0 0 0; font-weight: bold;">Website: https://hotelmaulimahur.com/</p>
        <p style="font-size: 10pt; margin: 3px 0 0 0; color: #555;">T Point, Renuka Devi Road, Mahurgad, Dist. Nanded – 431721</p>
        ${gstinHTML}
        <h2 style="font-size: 18pt; margin-top: 15px; text-decoration: underline;">ADVANCE PAYMENT RECEIPT</h2>
      </div>

      <div style="display: flex; justify-content: space-between; margin-bottom: 20px; font-size: 11pt; line-height: 1.6;">
        <div style="width: 55%;">
          <div><strong>Guest Name:</strong> ${guestName}</div>
          <div><strong>Mobile:</strong> ${mobile}</div>
          <div><strong>Room No(s):</strong> ${roomNos.join(', ')}</div>
          <div><strong>No. of Persons:</strong> ${persons}</div>
        </div>
        <div style="width: 40%; text-align: right;">
          <div><strong>Receipt No:</strong> ${advancePayment.receiptId}</div>
          <div><strong>Date:</strong> ${new Date().toLocaleDateString()}</div>
          <div><strong>Check-In:</strong> ${new Date(checkIn).toLocaleString()}</div>
        </div>
      </div>

      <div style="margin-bottom: 20px; border: 1px solid #000; padding: 15px;">
        <table style="width: 100%; font-size: 11pt;">
          <thead>
            <tr style="border-bottom: 1px solid #ccc;">
              <th style="text-align: left; padding: 5px 0;">Description</th>
              <th style="text-align: right; padding: 5px 0;">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="padding: 10px 0;">Advance Payment Received (${advancePayment.payMode})</td>
              <td style="text-align: right; font-weight: bold;">₹${advancePayment.amount.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div style="width: 50%; margin-left: auto; font-size: 11pt; line-height: 1.8;">
        <div style="display: flex; justify-content: space-between;">
          <span>Estimated Room Total:</span>
          <span>₹ ${roomTotal.toFixed(2)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-weight: bold;">
          <span>Total Advance Paid:</span>
          <span>(-) ₹ ${totalAdvancePaid.toFixed(2)}</span>
        </div>
        <div style="border-top: 1px solid black; margin-top: 5px; padding-top: 5px; display: flex; justify-content: space-between;">
          <span>Balance Due:</span>
          <span>₹ ${remaining.toFixed(2)}</span>
        </div>
      </div>

      <div style="width: 100%; font-size: 10pt; margin-top: 40px;">
        <div style="display: flex; justify-content: flex-end;">
          <div style="text-align: center;">
             <div style="height: 40px;"></div>
             <div style="border-top: 1px solid black; width: 150px; padding-top: 5px; font-weight: bold;">Manager Signature</div>
          </div>
        </div>
      </div>

      <div style="text-align: center; margin-top: 30px; font-size: 9pt; color: #555;">
        * This is an advance receipt. Final bill will include any extra charges or discounts.
      </div>
    </div>
  `;

  if ((window as any).electronAPI?.printPreview) {
    (window as any).electronAPI.printPreview(content);
  } else {
    let printArea = document.getElementById('printable-area');
    if (!printArea) {
      printArea = document.createElement('div');
      printArea.id = 'printable-area';
      printArea.style.display = 'none';
      document.body.appendChild(printArea);
    }
    printArea.innerHTML = content;
    window.print();
    if (printArea && printArea.parentNode) {
      printArea.parentNode.removeChild(printArea);
    }
  }
};