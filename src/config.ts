import minimist from 'minimist';
import path from 'path';

const args = minimist(process.argv.slice(2));

/**
 * Get the target date. Defaults to yesterday.
 * Override via CLI: --date=2026-06-20
 */
function getTargetDate(): string {
  if (args.date) {
    // Validate format YYYY-MM-DD
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(args.date)) {
      throw new Error(`Invalid date format: "${args.date}". Use YYYY-MM-DD (e.g., 2026-06-20)`);
    }
    return args.date;
  }

  // Default to yesterday in local time (avoiding UTC timezone shift issues)
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  
  const year = yesterday.getFullYear();
  const month = String(yesterday.getMonth() + 1).padStart(2, '0');
  const day = String(yesterday.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export const CONFIG = {
  /** Target date in YYYY-MM-DD format */
  TARGET_DATE: getTargetDate(),

  /** API endpoints */
  ACTIVE_NINJAS_API: 'https://solveninja.org/api/method/solve_ninja.api.v1.ninjas.get_ninja_listing',
  PORTFOLIO_API_BASE: 'https://cmp-api.solveninja.org/portfolio',

  /** Website base URL for profile pages */
  SITE_BASE_URL: 'https://solveninja.org/#/user-profile',

  /** Pagination settings for the Active Ninjas API */
  API_PAGE_LENGTH: 100,

  /** Days parameter for the Active Ninjas API (how far back to look for "active" ninjas) */
  API_DAYS_WINDOW: 90,

  /** Output paths */
  PROJECT_ROOT: path.resolve(__dirname, '..'),
  SCREENSHOTS_DIR: path.resolve(__dirname, '..', 'screenshots'),
  REPORT_FILE: path.resolve(__dirname, '..', 'daily_ninja_report.xlsx'),
  PDF_REPORT_FILE: path.resolve(__dirname, '..', `daily_ninja_report_${getTargetDate()}.pdf`),
  ERROR_LOG_FILE: path.resolve(__dirname, '..', 'errors.log'),

  /** Playwright settings */
  BROWSER_TIMEOUT: 30_000,
  NAVIGATION_TIMEOUT: 30_000,
  MODAL_WAIT_TIMEOUT: 5_000,

  /** Delay between API calls to avoid rate limiting (ms) */
  API_DELAY: 300,

  /** Delay between browser screenshot operations (ms) */
  SCREENSHOT_DELAY: 1_000,
};
