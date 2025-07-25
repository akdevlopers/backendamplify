import { parsePhoneNumberFromString, CountryCode } from 'libphonenumber-js';

/**
 * Formats a phone number into E.164 format using libphonenumber-js
 * @param phone - raw phone number string
 * @param country - ISO country code (e.g., 'IN', 'US', 'AE')
 * @returns formatted E.164 number or null if invalid
 */
export function formatMobileNumber(phone: string, country: string): string | null {
  try {
    const parsed = parsePhoneNumberFromString(phone, country.toUpperCase() as CountryCode);
    if (parsed && parsed.isValid()) {
      return parsed.number; // returns +E.164 format
    }
    return null;
  } catch {
    return null;
  }
}
