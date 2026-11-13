/**
 * New Registration draft: the form's in-progress state, kept in memory only
 * (never persisted) so switching tabs doesn't lose anything.
 */
import { toLocalDateTimeString } from '@/utils/dateUtils';

export const createEmptyRegistrationForm = () => ({
  guestName: '',
  customerGstin: '',
  mobile: '',
  address: '',
  persons: '',
  otherPersons: '',
  age: '',
  coming: '',
  going: '',
  checkIn: toLocalDateTimeString(new Date()),
  days: 1,
  advance: 0,
  discount: 0,
  discountNote: '',
  discountReason: 'Normal Discount',
  showDiscountOnInvoice: true,
  extraNote: '',
  extraAmt: 0,
  payMode: 'Cash',
  advancePayMode: 'Cash' as 'Cash' | 'UPI' | 'Card' | 'Other',
  advanceNote: '',
  isReservation: false,
  occupation: '',
  identityProofType: '',
  carNo: '',
  carModel: '',
  identityProof: '',
  digitalSignature: '',
});

export type RegistrationFormData = ReturnType<typeof createEmptyRegistrationForm>;

export interface RegistrationDraft {
  formData: RegistrationFormData;
  selectedRooms: string[];
  occSearch: string;
  idProofSearch: string;
  extraChargeType: 'Extra Bed' | 'Custom';
}

/**
 * True if anything differs from an empty form. The check-in time is ignored:
 * it defaults to "now" and changes by itself.
 */
export function hasDraftContent(draft: RegistrationDraft | null | undefined): boolean {
  if (!draft) return false;
  const empty = createEmptyRegistrationForm();
  const form = draft.formData as Record<string, unknown>;
  const changedField = (Object.keys(empty) as (keyof RegistrationFormData)[]).some(
    key => key !== 'checkIn' && form[key] !== empty[key]
  );
  return (
    changedField ||
    draft.selectedRooms.length > 0 ||
    draft.occSearch.trim() !== '' ||
    draft.idProofSearch.trim() !== '' ||
    draft.extraChargeType !== 'Extra Bed'
  );
}

export const createEmptyDraft = (): RegistrationDraft => ({
  formData: createEmptyRegistrationForm(),
  selectedRooms: [],
  occSearch: '',
  idProofSearch: '',
  extraChargeType: 'Extra Bed',
});
