import { CONFIG } from '../config';
import { logInfo, logError } from '../utils/logger';

/** Shape of an action from the Portfolio API */
export interface NinjaAction {
  uuid: string;
  title: string;
  hours_invested: number;
  description: string;
  status: string | null;
  is_verified: boolean;
  is_pinned: boolean;
  category: string;
  type: string;
  created_at: string;          // e.g., "2026-06-22 19:44:38.932364"
  date_of_action: string;      // e.g., "2026-06-22 19:44:38.715081"
  attachment1: string | null;
  attachment2: string | null;
  skills: Array<{
    id: number;
    name: string;
    label: string;
    relevance: string | null;
    microskill: {
      title: string;
      level: string;
      description: string;
    } | null;
  }>;
  chat_history: unknown;
}

/** Shape of the Portfolio API response */
export interface PortfolioResponse {
  first_name: string;
  last_name: string;
  username: string;
  email: string;
  bio: string | null;
  image: string;
  location_state: string;
  location_city: string | null;
  location_country: string | null;
  highlight: string;
  communities: unknown[];
  actions: NinjaAction[];
  skills: unknown[];
  expert_reviews: unknown[];
  partner: unknown;
}

/**
 * Fetch a ninja's full portfolio (including all actions) from the Portfolio API.
 */
export async function fetchPortfolio(username: string): Promise<PortfolioResponse | null> {
  const url = `${CONFIG.PORTFOLIO_API_BASE}/${username}`;

  let retries = 3;
  while (retries > 0) {
    try {
      // Add a 5-second timeout to prevent long hangs if the API is unreachable
      const response = await fetch(url, { signal: AbortSignal.timeout(5000) });

      if (!response.ok) {
        throw new Error(`Portfolio API returned ${response.status} for ${username}`);
      }

      const data = (await response.json()) as PortfolioResponse;
      logInfo(`Fetched portfolio for "${data.first_name} ${data.last_name}" - ${data.actions.length} actions`);
      return data;

    } catch (error) {
      retries--;
      if (retries === 0) {
        logError(`Failed to fetch portfolio for ${username} after 3 attempts`, error as Error);
        return null;
      }
      logInfo(`Network issue for ${username}, retrying... (${retries} attempts left)`);
      // Wait 2 seconds before retrying
      await new Promise(res => setTimeout(res, 2000));
    }
  }
  return null;
}
