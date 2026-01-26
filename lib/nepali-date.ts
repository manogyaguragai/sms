import NepaliDate from 'nepali-date-converter';

// Nepali month names
export const NEPALI_MONTHS = [
  'Baisakh', 'Jeth', 'Ashadh', 'Shrawan', 'Bhadra', 'Ashwin',
  'Kartik', 'Mangsir', 'Poush', 'Magh', 'Falgun', 'Chaitra'
] as const;

export const NEPALI_MONTHS_SHORT = [
  'Bai', 'Jet', 'Ash', 'Shr', 'Bhd', 'Asw',
  'Kar', 'Man', 'Pou', 'Mag', 'Fal', 'Cha'
] as const;

/**
 * Convert a JavaScript Date or ISO string to a formatted Nepali date string
 */
export function formatNepaliDate(
  date: Date | string,
  format: 'short' | 'long' | 'full' = 'short'
): string {
  try {
    const jsDate = typeof date === 'string' ? new Date(date) : date;
    const nepaliDate = new NepaliDate(jsDate);
    
    const year = nepaliDate.getYear();
    const month = nepaliDate.getMonth(); // 0-indexed
    const day = nepaliDate.getDate();
    
    switch (format) {
      case 'short':
        return `${NEPALI_MONTHS_SHORT[month]} ${day}, ${year}`;
      case 'long':
        return `${NEPALI_MONTHS[month]} ${day}, ${year}`;
      case 'full':
        return `${NEPALI_MONTHS[month]} ${day}, ${year} B.S.`;
      default:
        return `${NEPALI_MONTHS[month]} ${day}, ${year}`;
    }
  } catch (error) {
    console.error('Error formatting Nepali date:', error);
    return 'Invalid Date';
  }
}

/**
 * Convert a JavaScript Date to Nepali date string in YYYY-MM-DD format
 * Useful for form inputs
 */
export function toNepaliDateString(date: Date | string): string {
  try {
    const jsDate = typeof date === 'string' ? new Date(date) : date;
    const nepaliDate = new NepaliDate(jsDate);
    
    const year = nepaliDate.getYear();
    const month = String(nepaliDate.getMonth() + 1).padStart(2, '0'); // Convert to 1-indexed
    const day = String(nepaliDate.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  } catch (error) {
    console.error('Error converting to Nepali date string:', error);
    return '';
  }
}

/**
 * Convert a Nepali date string (YYYY-MM-DD) to JavaScript Date
 */
export function fromNepaliDateString(bsDateString: string): Date {
  try {
    const [year, month, day] = bsDateString.split('-').map(Number);
    const nepaliDate = new NepaliDate(year, month - 1, day); // month is 0-indexed
    return nepaliDate.toJsDate();
  } catch (error) {
    console.error('Error parsing Nepali date string:', error);
    return new Date();
  }
}

/**
 * Get the current date in Nepali calendar
 */
export function getCurrentNepaliDate(): { year: number; month: number; day: number } {
  const nepaliDate = new NepaliDate(new Date());
  return {
    year: nepaliDate.getYear(),
    month: nepaliDate.getMonth(),
    day: nepaliDate.getDate()
  };
}

/**
 * Format date with time in Nepali calendar
 */
export function formatNepaliDateTime(date: Date | string): string {
  try {
    const jsDate = typeof date === 'string' ? new Date(date) : date;
    const nepaliDate = new NepaliDate(jsDate);
    
    const year = nepaliDate.getYear();
    const month = nepaliDate.getMonth();
    const day = nepaliDate.getDate();
    
    // Format time from original date
    const hours = jsDate.getHours();
    const minutes = String(jsDate.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const hour12 = hours % 12 || 12;
    
    return `${NEPALI_MONTHS_SHORT[month]} ${day}, ${year} ${hour12}:${minutes} ${ampm}`;
  } catch (error) {
    console.error('Error formatting Nepali datetime:', error);
    return 'Invalid Date';
  }
}
