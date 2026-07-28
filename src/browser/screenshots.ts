import { chromium, Browser, Page } from 'playwright';
import fs from 'fs';
import path from 'path';
import { CONFIG } from '../config';
import { MatchedAction } from '../processing/actionFilter';
import { logInfo, logError, logWarn } from '../utils/logger';
import { sanitizeFilename, delay } from '../utils/helpers';

/**
 * Capture screenshots for all matched actions.
 * Groups actions by ninja to minimize navigation.
 */
export async function captureScreenshots(matchedActions: MatchedAction[]): Promise<void> {
  if (matchedActions.length === 0) {
    logInfo('No actions to screenshot.');
    return;
  }

  // Ensure screenshots directory exists
  if (!fs.existsSync(CONFIG.SCREENSHOTS_DIR)) {
    fs.mkdirSync(CONFIG.SCREENSHOTS_DIR, { recursive: true });
  }

  logInfo(`Launching browser for ${matchedActions.length} screenshot(s)...`);

  let browser: Browser | null = null;

  try {
    browser = await chromium.launch({
      headless: true,
    });

    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
    });

    const page = await context.newPage();
    page.setDefaultTimeout(CONFIG.BROWSER_TIMEOUT);
    page.setDefaultNavigationTimeout(CONFIG.NAVIGATION_TIMEOUT);

    // Group actions by username to minimize navigations
    const actionsByNinja = groupByNinja(matchedActions);

    for (const [username, actions] of Object.entries(actionsByNinja)) {
      const ninjaName = actions[0].ninjaName;
      logInfo(`Taking screenshots for "${ninjaName}" (${actions.length} action(s))...`);

      try {
        await captureNinjaScreenshots(page, username, actions);
      } catch (error) {
        logError(`Failed to process screenshots for "${ninjaName}"`, error as Error);
        // Mark all actions for this ninja as failed
        for (const action of actions) {
          if (!action.screenshotPath) {
            action.screenshotPath = 'SCREENSHOT_FAILED';
          }
        }
      }

      await delay(CONFIG.SCREENSHOT_DELAY);
    }

    await context.close();

  } catch (error) {
    logError('Browser launch/setup failed', error as Error);
    // Mark all remaining actions as failed
    for (const action of matchedActions) {
      if (!action.screenshotPath) {
        action.screenshotPath = 'SCREENSHOT_FAILED';
      }
    }
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Capture screenshots for all matching actions of a single ninja.
 */
async function captureNinjaScreenshots(
  page: Page,
  username: string,
  actions: MatchedAction[]
): Promise<void> {
  const profileUrl = `https://solveninja.org/#/user-profile/${username}`;

  // Navigate to the profile page
  logInfo(`Navigating to ${profileUrl}`);
  await page.goto(profileUrl, { waitUntil: 'networkidle' });
  await delay(3000);

  // Click on "Actions" tab using the correct selector
  // The tab is a <button> containing <span>Actions</span>
  try {
    const clicked = await page.evaluate(() => {
      const xpath = "//button[contains(., 'Actions')]";
      const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
      const element = result.singleNodeValue as HTMLElement | null;
      if (element) {
        element.click();
        return true;
      }
      return false;
    });

    if (clicked) {
      logInfo('Clicked Actions tab');
    } else {
      logWarn(`Could not find Actions tab for ${username}`);
    }

    await delay(2000);

  } catch (error) {
    logError(`Failed to click Actions tab for ${username}`, error as Error);
  }

  // Now capture each action by finding the correct card
  for (const action of actions) {
    try {
      await captureActionScreenshot(page, action);
    } catch (error) {
      logError(
        `Failed screenshot for "${action.ninjaName}" action "${action.actionTitle}"`,
        error as Error
      );
      action.screenshotPath = 'SCREENSHOT_FAILED';
    }
  }
}

/**
 * Capture a screenshot of a single action's detail modal.
 * Uses JavaScript to find the correct card by BOTH title AND date text.
 */
async function captureActionScreenshot(
  page: Page,
  action: MatchedAction
): Promise<void> {
  const sanitizedName = sanitizeFilename(action.ninjaName);
  const screenshotFileName = `${sanitizedName}_${action.actionIndex}.png`;
  const screenshotPath = path.join(CONFIG.SCREENSHOTS_DIR, screenshotFileName);

  // The action date displayed on the card is in format "22 Jun 2026"
  // action.actionDate is already in that format from our filter
  const displayDate = action.actionDate;
  const actionTitle = action.actionTitle;

  logInfo(`Looking for action card: "${actionTitle}" dated "${displayDate}"`);

  // Find and click the correct action card by matching BOTH title and date
  const clicked = await page.evaluate(
    ({ title, date }: { title: string; date: string }) => {
      const cards = document.querySelectorAll('.cmp-action-card');
      for (const card of Array.from(cards)) {
        const h3 = card.querySelector('h3');
        const cardTitle = h3?.innerText?.trim() || '';

        // Check if this card matches the title
        if (cardTitle !== title) continue;

        // Check if this card contains the target date in any span
        const spans = card.querySelectorAll('span');
        let dateMatch = false;
        for (const span of Array.from(spans)) {
          if (span.innerText?.trim() === date) {
            dateMatch = true;
            break;
          }
        }

        if (dateMatch) {
          // Found the correct card! Click it.
          (card as HTMLElement).click();
          return true;
        }
      }

      // Fallback: try matching just by title (in case date format differs)
      for (const card of Array.from(cards)) {
        const h3 = card.querySelector('h3');
        const cardTitle = h3?.innerText?.trim() || '';
        if (cardTitle === title) {
          (card as HTMLElement).click();
          return true;
        }
      }

      return false;
    },
    { title: actionTitle, date: displayDate }
  );

  if (!clicked) {
    logWarn(`Could not find action card "${actionTitle}" on "${displayDate}". Taking page screenshot.`);
    await page.screenshot({ path: screenshotPath, fullPage: false });
    action.screenshotPath = screenshotPath;
    return;
  }

  logInfo('Clicked action card, waiting for modal...');

  // Wait for modal to appear
  try {
    await page.waitForSelector('.cmp-action-modal-panel', { timeout: CONFIG.MODAL_WAIT_TIMEOUT });
  } catch {
    logWarn('Modal selector timeout. Waiting additional time...');
    await delay(3000);
  }

  logInfo('Waiting for modal contents to finish loading...');
  try {
    // Wait for network to be idle to ensure API data and image requests finish
    await page.waitForLoadState('networkidle', { timeout: 10000 });
  } catch {
    logWarn('Network idle timeout. Proceeding...');
  }

  try {
    // Explicitly wait for all images within the modal to fully load
    await page.waitForFunction(() => {
      const modal = document.querySelector('.cmp-action-modal-panel');
      if (!modal) return true;
      const images = Array.from(modal.querySelectorAll('img'));
      return images.every(img => img.complete && img.naturalHeight !== 0);
    }, { timeout: 10000 });
  } catch {
    logWarn('Image load timeout. Proceeding...');
  }

  await delay(1000);

  // Screenshot the modal panel
  try {
    const modalPanel = page.locator('.cmp-action-modal-panel').first();
    if (await modalPanel.isVisible({ timeout: 3000 })) {
      await modalPanel.screenshot({ path: screenshotPath });
      logInfo(`Modal screenshot saved: ${screenshotFileName}`);
    } else {
      // Fallback: full page screenshot
      await page.screenshot({ path: screenshotPath, fullPage: false });
      logInfo(`Fallback screenshot saved: ${screenshotFileName}`);
    }
  } catch {
    await page.screenshot({ path: screenshotPath, fullPage: false });
    logInfo(`Viewport screenshot saved: ${screenshotFileName}`);
  }

  action.screenshotPath = screenshotPath;

  // Close the modal using the correct close button
  await closeModal(page);
  await delay(500);
}

/**
 * Close the action detail modal.
 */
async function closeModal(page: Page): Promise<void> {
  try {
    const closed = await page.evaluate(() => {
      const closeBtn = document.querySelector('.cmp-action-modal-close') as HTMLElement | null;
      if (closeBtn) {
        closeBtn.click();
        return true;
      }
      return false;
    });

    if (closed) {
      await delay(500);
      return;
    }
  } catch {
    // ignore
  }

  // Fallback: press Escape
  try {
    await page.keyboard.press('Escape');
    await delay(500);
  } catch {
    // ignore
  }
}

/**
 * Group matched actions by ninja username.
 */
function groupByNinja(actions: MatchedAction[]): Record<string, MatchedAction[]> {
  const grouped: Record<string, MatchedAction[]> = {};
  for (const action of actions) {
    if (!grouped[action.username]) {
      grouped[action.username] = [];
    }
    grouped[action.username].push(action);
  }
  return grouped;
}
