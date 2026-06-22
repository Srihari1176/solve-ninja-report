import { CONFIG } from '../config';
import { logInfo, logWarn, logError } from '../utils/logger';
import { extractDatePart, delay } from '../utils/helpers';

/** Shape of a ninja from the Active Ninjas API */
export interface ActiveNinja {
  username: string;
  full_name: string;
  city: string | null;
  last_action_date: string; // e.g., "2026-06-22 19:44:38.715081"
  user_image: string | null;
  headline: string | null;
  summary: string | null;
  rank: number;
  hours_invested: number;
  contribution_count: number;
  recent_rank: number;
}

interface LeaderboardResponse {
  status: string;
  message: string;
  data: {
    result: ActiveNinja[];
    pagination: {
      total_count: number;
      page_length: number;
      start: number;
      has_next: boolean;
      has_prev: boolean;
    };
  };
}

/**
 * Fetch all active ninjas from the API, paginating through results.
 * Implements early termination: stops when a ninja's last_action_date is
 * before the target date (since results are sorted newest-first).
 */
export async function fetchActiveNinjas(): Promise<ActiveNinja[]> {
  const allNinjas: ActiveNinja[] = [];
  let start = 0;
  let hasMore = true;
  let pageNum = 1;
  let earlyTermination = false;

  while (hasMore) {
    logInfo(`Fetching active ninjas page ${pageNum} (start=${start})...`);

    try {
      const url = new URL(CONFIG.ACTIVE_NINJAS_API);
      url.searchParams.set('days', String(CONFIG.API_DAYS_WINDOW));
      url.searchParams.set('page_length', String(CONFIG.API_PAGE_LENGTH));
      url.searchParams.set('start', String(start));

      const response = await fetch(url.toString());

      if (!response.ok) {
        throw new Error(`API returned status ${response.status}: ${response.statusText}`);
      }

      const data = (await response.json()) as LeaderboardResponse;

      if (!data.data?.result || data.data.result.length === 0) {
        logInfo('No more ninjas found. Stopping pagination.');
        break;
      }

      const ninjas = data.data.result;
      logInfo(`Received ${ninjas.length} ninjas on page ${pageNum}`);

      // Process each ninja - check for early termination
      for (const ninja of ninjas) {
        const ninjaLastDate = extractDatePart(ninja.last_action_date);

        if (ninjaLastDate < CONFIG.TARGET_DATE) {
          // This ninja's last action is before target date.
          // Since results are sorted newest-first, all subsequent ninjas
          // will also be before the target date. STOP.
          logInfo(
            `Early termination: "${ninja.full_name}" last action on ${ninjaLastDate} ` +
            `is before target date ${CONFIG.TARGET_DATE}. Stopping.`
          );
          earlyTermination = true;
          break;
        }

        allNinjas.push(ninja);
      }

      if (earlyTermination) {
        break;
      }

      // Check pagination
      hasMore = data.data.pagination.has_next;
      start += CONFIG.API_PAGE_LENGTH;
      pageNum++;

      // Small delay to avoid rate limiting
      if (hasMore) {
        await delay(CONFIG.API_DELAY);
      }

    } catch (error) {
      logError(`Failed to fetch active ninjas page ${pageNum}`, error as Error);
      // If we already have some ninjas, continue with what we have
      if (allNinjas.length > 0) {
        logWarn(`Continuing with ${allNinjas.length} ninjas fetched so far.`);
        break;
      }
      throw error; // Fatal if we have no data at all
    }
  }

  logInfo(`Total active ninjas fetched: ${allNinjas.length}`);
  return allNinjas;
}
