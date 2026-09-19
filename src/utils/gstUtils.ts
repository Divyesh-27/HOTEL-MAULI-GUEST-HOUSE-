import { useStore } from '@/store/useStore';
import { InvoiceSettings } from '@/types';

export interface GSTCalculationResult {
  gstRate: number;
  cgstRate: number;
  sgstRate: number;
  baseRent: number;
  cgstAmount: number;
  sgstAmount: number;
  totalGST: number;
  grandTotal: number;
}

// Fallback constant for legacy imports
export const HOTEL_GSTIN = "27AAAAA0000A1Z5";

/**
 * Helper to get the currently configured HOTEL_GSTIN dynamically
 */
export const getHotelGSTIN = (): string => {
  try {
    const settings = useStore.getState().invoiceSettings;
    return settings?.gst_number || HOTEL_GSTIN;
  } catch {
    return HOTEL_GSTIN;
  }
};

/**
 * Calculates accommodation GST based on per-night room tariff using dynamic Invoice Settings.
 * DO NOT hardcode rates: reads dynamic configuration from store or custom parameter.
 */
export const calculateAccommodationGST = (
  dailyRent: number,
  days: number,
  discount: number = 0,
  roomCount: number = 1,
  customSettings?: InvoiceSettings
): GSTCalculationResult => {
  let settings = customSettings;
  if (!settings) {
    try {
      settings = useStore.getState().invoiceSettings;
    } catch {
      settings = undefined;
    }
  }

  const effectiveDays = Math.max(1, days);
  const effectiveRooms = Math.max(1, roomCount);
  const baseRent = Math.max(0, (dailyRent * days) - discount);
  
  // If GST is disabled in settings, return 0% and no breakup
  if (settings && !settings.gst_enabled) {
    return {
      gstRate: 0,
      cgstRate: 0,
      sgstRate: 0,
      baseRent,
      cgstAmount: 0,
      sgstAmount: 0,
      totalGST: 0,
      grandTotal: baseRent
    };
  }

  // Determine per-night tariff per room to decide applicable GST slab
  const perNightTariff = (baseRent / effectiveDays) / effectiveRooms;

  let gstRate = 0;
  let cgstRate = 0;
  let sgstRate = 0;

  if (settings) {
    if (perNightTariff <= settings.slab1_limit) {
      gstRate = Number(settings.slab1_gst);
      cgstRate = Number(settings.slab1_cgst);
      sgstRate = Number(settings.slab1_sgst);
    } else if (perNightTariff >= settings.slab2_from && perNightTariff <= settings.slab2_to) {
      gstRate = Number(settings.slab2_gst);
      cgstRate = Number(settings.slab2_cgst);
      sgstRate = Number(settings.slab2_sgst);
    } else if (perNightTariff >= settings.slab3_from) {
      gstRate = Number(settings.slab3_gst);
      cgstRate = Number(settings.slab3_cgst);
      sgstRate = Number(settings.slab3_sgst);
    } else {
      // Fallback if tariff falls in a gap between slab1 and slab2
      if (perNightTariff <= 7500) {
        gstRate = Number(settings.slab2_gst);
        cgstRate = Number(settings.slab2_cgst);
        sgstRate = Number(settings.slab2_sgst);
      } else {
        gstRate = Number(settings.slab3_gst);
        cgstRate = Number(settings.slab3_cgst);
        sgstRate = Number(settings.slab3_sgst);
      }
    }
  } else {
    // Default fallback rules if store not initialized
    if (perNightTariff <= 1000) {
      gstRate = 0;
      cgstRate = 0;
      sgstRate = 0;
    } else if (perNightTariff <= 7500) {
      gstRate = 5;
      cgstRate = 2.5;
      sgstRate = 2.5;
    } else {
      gstRate = 18;
      cgstRate = 9;
      sgstRate = 9;
    }
  }

  const round2 = (num: number): number => {
    return Math.round((num + Number.EPSILON) * 100) / 100;
  };

  const cgstAmount = round2((baseRent * cgstRate) / 100);
  const sgstAmount = round2((baseRent * sgstRate) / 100);
  const totalGST = round2(cgstAmount + sgstAmount);
  const grandTotal = round2(baseRent + totalGST);

  return {
    gstRate,
    cgstRate,
    sgstRate,
    baseRent,
    cgstAmount,
    sgstAmount,
    totalGST,
    grandTotal
  };
};

