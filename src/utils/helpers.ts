/**
 * Sanitize a string for use as a filename.
 * Removes/replaces characters that are invalid in Windows/Linux filenames.
 */
export function sanitizeFilename(name: string): string {
  return name
    .trim()
    .replace(/[<>:"/\\|?*]/g, '') // Remove invalid filename chars
    .replace(/\s+/g, '_')          // Replace spaces with underscores
    .replace(/_{2,}/g, '_')        // Collapse multiple underscores
    .replace(/^_|_$/g, '')         // Remove leading/trailing underscores
    || 'unknown';                  // Fallback
}

/**
 * Extract the date portion (YYYY-MM-DD) from a datetime string.
 * Input format: "2026-06-22 19:44:38.715081"
 */
export function extractDatePart(dateTimeStr: string): string {
  console.log("extractDatePart received:", dateTimeStr);
  return dateTimeStr.split(" ")[0];
}

/**
 * Format a date string for display in the report.
 * Input: "2026-06-22" → Output: "22-Jun-2026"
 */
export function formatDateForDisplay(dateStr: string): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const [year, month, day] = dateStr.split('-');
  const monthName = months[parseInt(month, 10) - 1] || month;
  return `${parseInt(day, 10)}-${monthName}-${year}`;
}

/**
 * Delay execution for a given number of milliseconds.
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
