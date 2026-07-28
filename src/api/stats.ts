import { CONFIG } from '../config';
import { logInfo, logError } from '../utils/logger';

export interface CityStat {
  city: string;
  active_ninjas: number;
  action_count: number;
}

interface CityStatsResponse {
  message: string;
  status: string;
  data: {
    result: CityStat[];
    pagination: {
      total_count: number;
      page_length: number;
      start: number;
    };
    meta: {
      days_analyzed: number;
      active_since: string;
    };
  };
}

/**
 * Fetches all city-wise statistics from the API.
 */
export async function fetchCityStats(): Promise<CityStat[]> {
  const allStats: CityStat[] = [];
  let start = 0;
  let hasMore = true;
  let pageNum = 1;

  while (hasMore) {
    logInfo(`Fetching city stats page ${pageNum} (start=${start})...`);

    try {
      const url = new URL('https://solveninja.org/api/method/solve_ninja.api.v1.marketplace.get_city_wise_ninja_stats');
      url.searchParams.set('start', String(start));

      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`API returned status ${response.status}: ${response.statusText}`);
      }

      const data = (await response.json()) as CityStatsResponse;
      
      if (!data.data?.result || data.data.result.length === 0) {
        break;
      }

      allStats.push(...data.data.result);
      
      const pag = data.data.pagination;
      if (start + pag.page_length >= pag.total_count) {
        hasMore = false;
      } else {
        start += pag.page_length;
        pageNum++;
      }
    } catch (error) {
      logError(`Failed to fetch city stats page ${pageNum}`, error as Error);
      break;
    }
  }

  logInfo(`Fetched ${allStats.length} city stats records.`);
  return allStats;
}
