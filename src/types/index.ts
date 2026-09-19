// Room Types - EXACT as per original software
export interface Room {
  roomNo: string;
  category: 'AC' | 'Air Cooled' | 'Hall' | string;
  bedType: string;
  rent: number;
  roomName?: string;
  roomType?: string;
  floor?: string;
  description?: string;
  updated_at?: string;
  version?: number;
  source?: 'desktop' | 'mobile' | string;
}

export type RoomStatusType = 'available' | 'occupied' | 'reserved' | 'cleaning' | 'maintenance';

export interface ExtraCharge {
  desc: string;
  amt: number;
}

// Advance Payment Entry
export interface AdvancePayment {
  receiptId: string;
  date: string;
  amount: number;
  payMode: 'Cash' | 'UPI' | 'Card' | 'Other';
  note?: string;
}

// --- BOOKING INTERFACE (Fixed) ---
export interface Booking {
  id: string;
  billNo: number; // Day-wise bill number
  billDate: string; // Date for bill number reset
  guestName: string;
  mobile: string;
  address: string;
  persons: string;
  age: string;
  coming: string;
  going: string;
  checkIn: string;
  days: number;
  roomNos: string[];
  advance: number; // Total advance (sum of all advance payments)
  advancePayments: AdvancePayment[]; // Multiple advance entries
  payMode: string;
  extras: ExtraCharge[];
  discount: number;
  isReservation?: boolean;

  // --- NEW FIELDS ADDED ---
  carNo?: string;
  carModel?: string;
  occupation?: string;
  identityProofType?: string; // e.g. Aadhaar Card, Driving Licence, PAN Card, Election Card (Voter ID), Passport
  otherPersons?: string; // <--- This is the new field we added
  discountNote?: string; // Reason for the discount
  discountReason?: string; // Dropdown reason
  showDiscountOnInvoice?: boolean; // Toggle to show/hide discount line on invoice
  enableGstInvoice?: boolean; // Toggle for GST invoice
  customerGstin?: string; // <--- ADDED: Customer GSTIN
  invoiceHtml?: string; // Stored invoice HTML for History viewing
  
  // Images (Base64 Strings)
  identityProof?: string; 
  identityProofUrl?: string;
  digitalSignature?: string;
  digitalSignatureUrl?: string;

  // --- GST FIELDS ---
  gst_rate?: number;
  cgst_amount?: number;
  sgst_amount?: number;
  total_gst?: number;
  grand_total_with_gst?: number;

  // --- SYNC ENGINE FIELDS ---
  updated_at?: string;
  version?: number;
  source?: 'desktop' | 'mobile' | string;
}

export interface HistoryRecord extends Booking {
  checkoutDate: string;
  finalAmount: number;
  totalPaid: number;
}

export interface Staff {
  name: string;
  role: string;
  salary: number;
  updated_at?: string;
  version?: number;
  source?: 'desktop' | 'mobile' | string;
}

export interface StaffLog {
  date: string;
  staff: string;
  type: 'Advance' | 'Salary' | 'Bonus' | 'Deduction';
  amount: number;
  msg: string;
  updated_at?: string;
  version?: number;
  source?: 'desktop' | 'mobile' | 'cloud';
}

export interface RoomHold {
  id: string;
  room_no: string;
  device_id: string;
  expires_at: string;
  status: 'active' | 'released' | 'converted';
}

export type SectionType = 'dashboard' | 'registration' | 'billing' | 'calendar' | 'history' | 'revenue' | 'admin' | 'staff';

export interface InvoiceSettings {
  id?: string;
  gst_enabled: boolean;
  gst_number: string;
  
  // Slab 1: Below limit
  slab1_limit: number;
  slab1_gst: number;
  slab1_cgst: number;
  slab1_sgst: number;
  
  // Slab 2: From - To
  slab2_from: number;
  slab2_to: number;
  slab2_gst: number;
  slab2_cgst: number;
  slab2_sgst: number;
  
  // Slab 3: Above from
  slab3_from: number;
  slab3_gst: number;
  slab3_cgst: number;
  slab3_sgst: number;
  
  // Display toggles
  show_gstin_advance: boolean;
  show_gstin_final: boolean;
  show_breakup_advance: boolean;
  show_breakup_final: boolean;

  custom_bed_types?: string[];
  custom_categories?: string[];
  ac_to_non_ac_discount_rates?: AcToNonAcDiscountRate[];
  
  updated_at?: string;
}

export interface AcToNonAcDiscountRate {
  rent: number;
  discount: number;
}

export const DEFAULT_AC_TO_NON_AC_DISCOUNT_RATES: AcToNonAcDiscountRate[] = [
  { rent: 1600, discount: 400 },
  { rent: 2500, discount: 500 },
  { rent: 3500, discount: 1000 },
];

export const DEFAULT_INVOICE_SETTINGS: InvoiceSettings = {
  id: 'default-settings',
  gst_enabled: true,
  gst_number: "27AAAAA0000A1Z5",
  slab1_limit: 1000,
  slab1_gst: 0,
  slab1_cgst: 0,
  slab1_sgst: 0,
  slab2_from: 1001,
  slab2_to: 7500,
  slab2_gst: 5,
  slab2_cgst: 2.5,
  slab2_sgst: 2.5,
  slab3_from: 7501,
  slab3_gst: 18,
  slab3_cgst: 9,
  slab3_sgst: 9,
  show_gstin_advance: true,
  show_gstin_final: true,
  show_breakup_advance: false,
  show_breakup_final: true,
  custom_bed_types: ['Single Bed', 'Double Bed', 'Triple Bed', '4 Bed', '5 Bed', '6 Bed'],
  custom_categories: ['AC', 'Air Cooled', 'Hall', 'Suite', 'Deluxe', 'Dormitory', 'Family Room', 'VIP Room'],
  ac_to_non_ac_discount_rates: DEFAULT_AC_TO_NON_AC_DISCOUNT_RATES,
};

// --- APP USERS & ROLES ---
export interface AppRole {
  id: string;
  name: string;
  permissions: SectionType[];
  updated_at?: string;
  version?: number;
  source?: 'desktop' | 'mobile' | string;
}

export interface AppUser {
  id: string;
  fullName: string;
  username: string;
  passwordHash: string;
  roleId: string;
  status: 'active' | 'disabled';
  updated_at?: string;
  version?: number;
  source?: 'desktop' | 'mobile' | string;
}