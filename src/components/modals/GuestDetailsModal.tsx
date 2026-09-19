import { useState, useRef, useEffect } from 'react';
import { X, Edit2, Save, Maximize2, Trash2, Camera, AlertCircle, UserPlus } from 'lucide-react';
import { Booking, HistoryRecord } from '@/types';
import ImageCapture from '../ui/ImageCapture';
import { cn } from '@/lib/utils';
import { useStore } from '@/store/useStore';

interface GuestDetailsModalProps {
  data: Booking | HistoryRecord;
  onClose: () => void;
  onUpdate?: (updatedData: any) => void;
  initialEditMode?: boolean;
}

import { toLocalDateTimeString } from '@/utils/dateUtils';
export { toLocalDateTimeString };

const getNormalizedFormData = (data: Booking | HistoryRecord) => {
  const raw = (data || {}) as any;
  return {
    ...raw,
    guestName: (raw.guestName || raw.guest_name || raw.name || raw.guest || '').trim(),
    mobile: (raw.mobile || raw.phone || '').trim(),
    customerGstin: raw.customerGstin || raw.customer_gstin || '',
    occupation: raw.occupation || '',
    address: raw.address || '',
    otherPersons: raw.otherPersons || raw.other_persons || '',
    persons: raw.persons !== undefined && raw.persons !== null ? String(raw.persons) : '1',
    age: raw.age !== undefined && raw.age !== null ? String(raw.age) : '',
    identityProofType: raw.identityProofType || raw.id_proof_type || raw.identity_proof_type || '',
    carNo: raw.carNo || raw.car_no || '',
    carModel: raw.carModel || raw.car_model || '',
    coming: raw.coming || '',
    going: raw.going || '',
    checkIn: raw.checkIn || '',
    checkoutDate: raw.checkoutDate || raw.checkout_date || undefined,
    days: raw.days !== undefined && raw.days !== null ? Number(raw.days) : 1,
    roomNos: Array.isArray(raw.roomNos) ? raw.roomNos : (raw.roomNo ? [raw.roomNo] : []),
    identityProof: raw.identityProof || '',
    digitalSignature: raw.digitalSignature || ''
  };
};

const PREDEFINED_OCCUPATIONS = [
  'Business',
  'Job / Service',
  'Agriculture',
  'Freelancer',
  'Self Employed',
  'Student',
  'Homemaker',
  'Retired',
  'Unemployed',
  'Other'
];

const PREDEFINED_ID_PROOFS = [
  'Aadhaar Card',
  'Driving Licence',
  'PAN Card',
  'Election Card (Voter ID)',
  'Passport'
];

const GuestDetailsModal = ({ data, onClose, onUpdate, initialEditMode = false }: GuestDetailsModalProps) => {
  const [isEditing, setIsEditing] = useState(initialEditMode);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState(() => getNormalizedFormData(data));

  const setSection = useStore(state => state.setSection);
  const setPrefilledRegistration = useStore(state => state.setPrefilledRegistration);

  const handleNewBookingForGuest = () => {
    const prefillData: Partial<Booking> = {
      guestName: (formData.guestName || '').trim(),
      mobile: (formData.mobile || '').trim(),
      occupation: formData.occupation || '',
      address: formData.address || '',
      customerGstin: (formData.customerGstin || '').trim().toUpperCase(),
      identityProofType: formData.identityProofType || '',
      carNo: formData.carNo || '',
      carModel: formData.carModel || '',
      coming: formData.coming || '',
    };
    setPrefilledRegistration(prefillData);
    onClose();
    setSection('registration');
  };

  // Sync state whenever data prop or initialEditMode changes
  useEffect(() => {
    setFormData(getNormalizedFormData(data));
    setIsEditing(initialEditMode);
    setValidationError(null);
  }, [data, initialEditMode]);

  // Handle Escape key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (previewImage) {
          setPreviewImage(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, previewImage]);

  // Searchable dropdown states
  const [occSearch, setOccSearch] = useState('');
  const [occDropdownOpen, setOccDropdownOpen] = useState(false);
  const [idProofSearch, setIdProofSearch] = useState('');
  const [idProofDropdownOpen, setIdProofDropdownOpen] = useState(false);

  const handleChange = (name: string, value: string | number) => {
    setFormData(prev => ({ ...prev, [name]: value }));
    if (validationError) setValidationError(null);
  };

  const handleSave = () => {
    setValidationError(null);

    // Safety Net 1: Guest Name cannot be empty
    const trimmedName = (formData.guestName || '').trim();
    if (!trimmedName) {
      setValidationError('Guest Name is required and cannot be empty. Please enter a valid guest name.');
      return;
    }

    // Safety Net 2: Prevent erasing mobile if previously present
    const originalMobile = (((data as any).mobile || (data as any).phone || '') as string).trim();
    const newMobile = (formData.mobile || '').trim();
    if (originalMobile && !newMobile) {
      setValidationError('Mobile number cannot be blank when previously recorded.');
      return;
    }

    if (onUpdate) {
      onUpdate({
        ...formData,
        guestName: trimmedName,
        mobile: newMobile,
        customerGstin: (formData.customerGstin || '').trim().toUpperCase(),
        invoiceHtml: undefined // Invalidate stale cached HTML so updated GSTIN and details render dynamically
      });
      setIsEditing(false);
      onClose();
    }
  };

  const handleDeleteImage = (field: 'identityProof' | 'digitalSignature') => {
    if (confirm('Are you sure you want to delete this image?')) {
      setFormData(prev => ({ ...prev, [field]: '' }));
    }
  };

  const renderField = (label: string, name: Extract<keyof typeof formData, string>, type = "text", fullWidth = false) => {
    const value = formData[name];
    return (
      <div className={fullWidth ? "col-span-1 md:col-span-2 space-y-2" : "space-y-2"}>
        <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider">
          {label}
        </label>
        {isEditing ? (
          <input
            type={type}
            name={name}
            value={value as string || ''}
            onChange={(e) => handleChange(name, e.target.value)}
            className="w-full text-sm font-medium p-3 bg-background border border-primary/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
          />
        ) : (
          <div className={`text-sm font-medium p-3 bg-secondary/30 rounded-lg border border-border ${type === 'number' ? 'font-mono' : ''} ${fullWidth ? 'min-h-[50px]' : ''}`}>
            {value || <span className="text-muted-foreground italic">-</span>}
          </div>
        )}
      </div>
    );
  };

  // Reusable searchable dropdown renderer
  const renderSearchableDropdown = (
    label: string,
    fieldName: string,
    options: string[],
    search: string,
    setSearch: (v: string) => void,
    isOpen: boolean,
    setIsOpen: (v: boolean) => void,
    fallbackValue?: string
  ) => {
    const value = (formData as any)[fieldName] || '';
    const filtered = options.filter(o => o.toLowerCase().includes(search.toLowerCase()));

    return (
      <div className="space-y-2">
        <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider">
          {label}
        </label>
        {isEditing ? (
          <div className="relative">
            <input
              type="text"
              placeholder={`Select ${label.toLowerCase()}...`}
              value={isOpen ? search : value}
              onFocus={() => {
                setSearch('');
                setIsOpen(true);
              }}
              onBlur={() => {
                setTimeout(() => {
                  setIsOpen(false);
                  if (search.trim()) {
                    const match = options.find(o => o.toLowerCase() === search.trim().toLowerCase());
                    handleChange(fieldName, match || fallbackValue || search.trim());
                  }
                }, 200);
              }}
              onChange={(e) => {
                setSearch(e.target.value);
                // Auto-select exact match while typing
                const exact = options.find(o => o.toLowerCase() === e.target.value.toLowerCase());
                if (exact) {
                  handleChange(fieldName, exact);
                }
              }}
              className="w-full text-sm font-medium p-3 bg-background border border-primary/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
              autoComplete="off"
            />
            {isOpen && (
              <div className="absolute z-50 left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-card border border-border rounded-lg shadow-xl py-1">
                {filtered.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-muted-foreground italic">
                    {fallbackValue ? `Will use "${fallbackValue}"` : 'No matches found'}
                  </div>
                ) : (
                  filtered.map((opt) => (
                    <div
                      key={opt}
                      onMouseDown={() => {
                        handleChange(fieldName, opt);
                        setIsOpen(false);
                      }}
                      className={cn(
                        "px-3 py-2 text-sm cursor-pointer hover:bg-primary/10 transition-colors font-medium flex items-center justify-between",
                        value === opt && "bg-primary/15 text-primary font-bold"
                      )}
                    >
                      <span>{opt}</span>
                      {value === opt && <span className="text-xs">✓</span>}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="text-sm font-medium p-3 bg-secondary/30 rounded-lg border border-border">
            {value || <span className="text-muted-foreground italic">-</span>}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <div 
        className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 animate-fade-in"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div className="bg-card rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-scale-in">
          
          {/* Header */}
          <div className="bg-secondary p-4 flex justify-between items-center border-b border-border">
            <div>
              <h3 className="font-bold text-lg text-foreground">Guest Details</h3>
              <p className="text-xs text-muted-foreground">
                {isEditing ? 'Editing Guest Information' : 'View-only record'}
              </p>
            </div>
            <div className="flex gap-2">
              <button 
                type="button"
                onClick={handleNewBookingForGuest} 
                className="flex items-center gap-1.5 px-3 py-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded transition-colors text-xs font-bold shadow-sm"
                title="Create a new booking pre-filled with this guest's personal details"
              >
                <UserPlus className="w-4 h-4" /> + New Booking (Same Guest)
              </button>
              {!isEditing && onUpdate && (
                <button onClick={() => setIsEditing(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-xs font-bold shadow-sm">
                  <Edit2 className="w-4 h-4" /> Edit Details
                </button>
              )}
              {isEditing && (
                 <button onClick={handleSave} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors text-xs font-bold shadow-sm">
                  <Save className="w-4 h-4" /> Save Changes
                </button>
              )}
              <button onClick={onClose} className="p-2 hover:bg-black/10 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Scrollable Content */}
          <div className="p-6 overflow-y-auto">
            {validationError && (
              <div className="mb-6 p-4 bg-destructive/10 border-2 border-destructive text-destructive rounded-lg font-semibold flex items-center justify-between animate-fade-in shadow-sm">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <span>{validationError}</span>
                </div>
                <button 
                  type="button"
                  onClick={() => setValidationError(null)} 
                  className="text-xs px-2.5 py-1 bg-destructive text-destructive-foreground rounded hover:opacity-90 font-bold transition-opacity"
                >
                  Dismiss
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              
              {/* Column 1: Personal Info */}
              <div className="space-y-6">
                <h4 className="font-bold text-sm text-primary uppercase border-b border-primary/20 pb-2">Personal Information</h4>
                
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    {renderField("Guest Name", "guestName")}
                    {renderField("Customer GSTIN", "customerGstin")}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    {renderField("Mobile", "mobile")}
                    {renderSearchableDropdown(
                      "Occupation",
                      "occupation",
                      PREDEFINED_OCCUPATIONS,
                      occSearch,
                      setOccSearch,
                      occDropdownOpen,
                      setOccDropdownOpen,
                      "Other"
                    )}
                  </div>

                  {renderField("Address", "address", "text", true)}
                  {renderField("Other Persons (Names)", "otherPersons", "text", true)}

                  <div className="grid grid-cols-3 gap-4">
                    {renderField("Persons Count", "persons", "number")}
                    {renderField("Age", "age", "number")}
                    {renderSearchableDropdown(
                      "ID Proof Type",
                      "identityProofType",
                      PREDEFINED_ID_PROOFS,
                      idProofSearch,
                      setIdProofSearch,
                      idProofDropdownOpen,
                      setIdProofDropdownOpen
                    )}
                  </div>
                </div>

                <h4 className="font-bold text-sm text-primary uppercase border-b border-primary/20 pb-2 mt-6">Vehicle Details</h4>
                <div className="grid grid-cols-2 gap-4">
                  {renderField("Car Number", "carNo")}
                  {renderField("Car Model", "carModel")}
                </div>
              </div>

              {/* Column 2: Stay & Documents */}
              <div className="space-y-6">
                <h4 className="font-bold text-sm text-primary uppercase border-b border-primary/20 pb-2">Stay Details</h4>
                
                <div className="grid grid-cols-2 gap-4">
                  {renderField("Coming From", "coming")}
                  {renderField("Going To", "going")}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-muted-foreground uppercase mb-2 block">Check-In Date</label>
                    {isEditing ? (
                      <input 
                        type="datetime-local" 
                        value={toLocalDateTimeString(formData.checkIn)} 
                        onChange={(e) => {
                          const newIn = e.target.value;
                          if ((formData as any).checkoutDate) {
                            const inTime = new Date(newIn).getTime();
                            const outTime = new Date((formData as any).checkoutDate).getTime();
                            if (!isNaN(inTime) && !isNaN(outTime) && outTime > inTime) {
                              const diffHours = (outTime - inTime) / (1000 * 60 * 60);
                              const calcDays = Math.max(1, Math.ceil(diffHours / 24));
                              setFormData(prev => ({ ...prev, checkIn: newIn, days: calcDays }));
                              return;
                            }
                          }
                          setFormData(prev => ({ ...prev, checkIn: newIn }));
                        }}
                        className="w-full text-sm font-medium p-3 bg-background border border-primary/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
                      />
                    ) : (
                      <div className="text-sm font-medium p-3 bg-secondary/30 rounded-lg border border-border">
                        {formData.checkIn ? new Date(formData.checkIn).toLocaleString() : '-'}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="text-xs font-bold text-muted-foreground uppercase mb-2 block">Stay Duration (Days)</label>
                    {isEditing ? (
                      <input 
                        type="number" 
                        min="1"
                        value={formData.days || 1} 
                        onChange={(e) => {
                          const val = Math.max(1, parseInt(e.target.value) || 1);
                          const inTime = new Date(formData.checkIn).getTime();
                          const newOut = new Date(inTime + val * 24 * 60 * 60 * 1000).toISOString();
                          setFormData(prev => ({ ...prev, days: val, checkoutDate: (prev as any).checkoutDate ? newOut : undefined }));
                        }}
                        className="w-full text-sm font-mono font-medium p-3 bg-background border border-primary/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
                      />
                    ) : (
                      <div className="text-sm font-mono font-medium p-3 bg-secondary/30 rounded-lg border border-border">
                        {formData.days} Days
                      </div>
                    )}
                  </div>
                </div>

                {(formData as any).checkoutDate && (
                  <div className="mt-4">
                    <label className="text-xs font-bold text-muted-foreground uppercase mb-2 block">Check-Out Date</label>
                    {isEditing ? (
                      <input 
                        type="datetime-local" 
                        value={toLocalDateTimeString((formData as any).checkoutDate)} 
                        onChange={(e) => {
                          const newOut = e.target.value;
                          const outTime = new Date(newOut).getTime();
                          const inTime = new Date(formData.checkIn).getTime();
                          const diffHours = (outTime - inTime) / (1000 * 60 * 60);
                          const calcDays = Math.max(1, Math.ceil(diffHours / 24));
                          setFormData(prev => ({ ...prev, checkoutDate: newOut, days: calcDays }));
                        }}
                        className="w-full text-sm font-medium p-3 bg-background border border-primary/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
                      />
                    ) : (
                      <div className="text-sm font-medium p-3 bg-secondary/30 rounded-lg border border-border">
                        {new Date((formData as any).checkoutDate).toLocaleString()}
                      </div>
                    )}
                  </div>
                )}

                <div className="mt-4">
                  <label className="text-xs font-bold text-muted-foreground uppercase mb-2 block">Room(s)</label>
                  <div className="text-sm font-bold text-primary p-3 bg-primary/10 rounded-lg border border-primary/20">
                    {formData.roomNos?.join(', ') || '-'}
                  </div>
                </div>

                {/* Identity Proof Image Logic */}
                <div className="mt-6">
                  <label className="text-xs font-bold text-muted-foreground uppercase mb-2 block">
                    Identity Proof
                  </label>
                  
                  {formData.identityProof ? (
                    <div className="border-2 border-dashed border-border rounded-lg bg-secondary/10 p-2 flex items-center justify-center min-h-[150px] relative group">
                      <img 
                        src={formData.identityProof} 
                        alt="ID Proof" 
                        className="max-h-[200px] max-w-full rounded shadow-sm object-contain cursor-zoom-in" 
                        onClick={() => setPreviewImage(formData.identityProof || null)}
                      />
                      
                      <button 
                        onClick={() => setPreviewImage(formData.identityProof || null)}
                        className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/20 transition-all opacity-0 group-hover:opacity-100 pointer-events-none"
                      >
                        <Maximize2 className="text-white w-8 h-8 drop-shadow-lg" />
                      </button>

                      {isEditing && (
                        <button 
                          onClick={() => handleDeleteImage('identityProof')}
                          className="absolute top-2 right-2 p-2 bg-red-600 text-white rounded-full hover:bg-red-700 shadow-lg z-10 pointer-events-auto"
                          title="Delete Image"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ) : (
                    isEditing ? (
                      <div className="border p-2 rounded">
                        <ImageCapture 
                          label="Upload ID Proof"
                          imageSrc="" 
                          onCapture={(src) => setFormData(prev => ({ ...prev, identityProof: src }))} 
                        />
                      </div>
                    ) : (
                      <div className="border-2 border-dashed border-border rounded-lg bg-secondary/10 p-4 text-center">
                        <span className="text-muted-foreground text-sm italic">No ID Proof Uploaded</span>
                      </div>
                    )
                  )}
                </div>

                {/* Digital Signature Logic */}
                <div className="mt-4">
                  <label className="text-xs font-bold text-muted-foreground uppercase mb-2 block">
                    Digital Signature
                  </label>
                  {formData.digitalSignature ? (
                    <div className="border border-border rounded-lg bg-white p-2 h-24 flex items-center justify-center relative group">
                      <img 
                        src={formData.digitalSignature} 
                        alt="Signature" 
                        className="max-h-full max-w-full object-contain cursor-zoom-in" 
                        onClick={() => setPreviewImage(formData.digitalSignature || null)}
                      />
                      {isEditing && (
                        <button 
                          onClick={() => handleDeleteImage('digitalSignature')}
                          className="absolute top-2 right-2 p-1 bg-red-600 text-white rounded-full hover:bg-red-700 shadow-lg z-10"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  ) : (
                     <div className="border border-border rounded-lg bg-white p-4 text-center h-24 flex items-center justify-center">
                        <span className="text-muted-foreground text-xs italic">No Signature</span>
                     </div>
                  )}
                </div>

              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 bg-secondary/50 border-t flex justify-end">
            <button onClick={onClose} className="px-6 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 font-bold shadow-sm">
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Full Screen Preview */}
      {previewImage && (
        <div 
          className="fixed inset-0 z-[60] bg-black/95 flex items-center justify-center p-4 cursor-zoom-out animate-fade-in"
          onClick={() => setPreviewImage(null)}
        >
          <button className="absolute top-4 right-4 text-white hover:text-red-400 transition-colors p-2 bg-white/10 rounded-full">
            <X className="w-8 h-8" />
          </button>
          <img src={previewImage} alt="Full Screen Preview" className="max-w-[95vw] max-h-[95vh] object-contain rounded-lg shadow-2xl animate-scale-in" />
        </div>
      )}
    </>
  );
};

export default GuestDetailsModal;