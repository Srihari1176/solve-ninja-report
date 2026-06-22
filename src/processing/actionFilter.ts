import { CONFIG } from '../config';
import { NinjaAction } from '../api/portfolio';
import { extractDatePart } from '../utils/helpers';
import { logInfo } from '../utils/logger';

/** A matched action with all data needed for the report */
export interface MatchedAction {
  ninjaName: string;
  location: string;
  profileUrl: string;
  username: string;
  actionTitle: string;
  actionDate: string;         // Display format: "22-Jun-2026"
  actionDateRaw: string;      // Raw: "2026-06-22 19:44:38.715081"
  actionIndex: number;        // 1-based index for this ninja's matched actions
  screenshotPath: string;     // Will be filled in after screenshot capture
  actionUuid: string;
}

/**
 * Filter actions for a ninja based on the target date.
 * 
 * Business logic (actions are sorted newest-first):
 *   IF action_date > target_date → skip, continue
 *   IF action_date == target_date → CAPTURE
 *   IF action_date < target_date → STOP processing this ninja
 */
export function filterActionsForTargetDate(
  actions: NinjaAction[],
  targetDate: string,
  ninjaName: string,
  location: string,
  username: string
): MatchedAction[] {
  const matched: MatchedAction[] = [];
  const profileUrl = `${CONFIG.SITE_BASE_URL}/${username}`;

  // Sort actions by date_of_action descending (newest first)
  const sortedActions = [...actions].sort((a, b) => {
    return b.date_of_action.localeCompare(a.date_of_action);
  });

  let actionIndex = 0;

  for (const action of sortedActions) {
    const actionDate = extractDatePart(action.date_of_action);

    if (actionDate > targetDate) {
      // Newer than target date - skip, continue looking
      continue;
    }

    if (actionDate === targetDate) {
      // Match! Capture this action
      actionIndex++;
      matched.push({
        ninjaName,
        location,
        profileUrl,
        username,
        actionTitle: action.title,
        actionDate: formatActionDate(action.date_of_action),
        actionDateRaw: action.date_of_action,
        actionIndex,
        screenshotPath: '', // Filled in later
        actionUuid: action.uuid,
      });
      continue;
    }

    if (actionDate < targetDate) {
      // Older than target date - stop processing this ninja
      break;
    }
  }

  if (matched.length > 0) {
    logInfo(`Found ${matched.length} matching action(s) for "${ninjaName}" on ${targetDate}`);
  }

  return matched;
}

/**
 * Format a datetime string for display.
 * "2026-06-22 19:44:38.715081" → "22 Jun 2026"
 */
function formatActionDate(dateTimeStr: string): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const datePart = dateTimeStr.split(' ')[0]; // "2026-06-22"
  const [year, month, day] = datePart.split('-');
  const monthName = months[parseInt(month, 10) - 1] || month;
  return `${parseInt(day, 10)} ${monthName} ${year}`;
}
