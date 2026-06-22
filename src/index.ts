import fs from 'fs';
import { CONFIG } from './config';
import { fetchActiveNinjas, ActiveNinja } from './api/activeNinjas';
import { fetchPortfolio } from './api/portfolio';
import { filterActionsForTargetDate, MatchedAction } from './processing/actionFilter';
import { captureScreenshots } from './browser/screenshots';
import { generateExcelReport } from './report/excelReport';
import { generatePdfReport } from './report/pdfReport';
import { logInfo, logError, logWarn, logDivider } from './utils/logger';
import { delay } from './utils/helpers';

/**
 * Main entry point for the Solve Ninja Daily Report.
 */
async function main(): Promise<void> {
  const startTime = Date.now();

  logDivider('SOLVE NINJA DAILY ACTIVITY REPORT');
  logInfo(`Target date: ${CONFIG.TARGET_DATE}`);
  logInfo(`Report output: ${CONFIG.REPORT_FILE}`);
  logInfo(`Screenshots dir: ${CONFIG.SCREENSHOTS_DIR}`);
  console.log('');

  try {
    // ─────────────────────────────────────────────────
    // Step 1: Fetch active ninjas from the API
    // ─────────────────────────────────────────────────
    logDivider('STEP 1: Fetching Active Ninjas');
    const activeNinjas = await fetchActiveNinjas();

    if (activeNinjas.length === 0) {
      logWarn('No active ninjas found. Exiting.');
      return;
    }

    // ─────────────────────────────────────────────────
    // Step 2: Process each ninja's portfolio
    // ─────────────────────────────────────────────────
    logDivider('STEP 2: Processing Profiles & Filtering Actions');
    const allMatchedActions: MatchedAction[] = [];
    let processedCount = 0;
    let skippedCount = 0;

    for (const ninja of activeNinjas) {
      processedCount++;
      const progress = `[${processedCount}/${activeNinjas.length}]`;
      const ninjaName = ninja.full_name.trim() || ninja.username;
      const location = ninja.city || 'Unknown';

      logInfo(`${progress} Processing: "${ninjaName}" (${location})`);

      try {
        // Fetch full portfolio
        const portfolio = await fetchPortfolio(ninja.username);

        if (!portfolio) {
          logWarn(`${progress} Could not fetch portfolio for "${ninjaName}". Skipping.`);
          skippedCount++;
          continue;
        }

        if (portfolio.actions.length === 0) {
          logInfo(`${progress} No actions found for "${ninjaName}". Skipping.`);
          skippedCount++;
          continue;
        }

        // Filter actions for target date
        const matched = filterActionsForTargetDate(
          portfolio.actions,
          CONFIG.TARGET_DATE,
          ninjaName,
          location,
          ninja.username
        );

        if (matched.length === 0) {
          logInfo(`${progress} No matching actions for "${ninjaName}" on ${CONFIG.TARGET_DATE}.`);
        } else {
          allMatchedActions.push(...matched);
          logInfo(`${progress} ✓ ${matched.length} action(s) matched for "${ninjaName}".`);
        }

      } catch (error) {
        logError(`${progress} Error processing "${ninjaName}"`, error as Error);
        skippedCount++;
      }

      // Small delay between API calls
      await delay(CONFIG.API_DELAY);
    }

    logInfo(`Profile processing complete. ${allMatchedActions.length} total matching action(s) found.`);
    logInfo(`Processed: ${processedCount}, Skipped/Failed: ${skippedCount}`);

    if (allMatchedActions.length === 0) {
      logWarn(`No actions found for target date ${CONFIG.TARGET_DATE}. Generating empty report.`);
    }

    // ─────────────────────────────────────────────────
    // Step 3: Capture screenshots (browser only)
    // ─────────────────────────────────────────────────
    if (allMatchedActions.length > 0) {
      logDivider('STEP 3: Capturing Screenshots');
      await captureScreenshots(allMatchedActions);
    }

    // ─────────────────────────────────────────────────
    // Step 4: Generate Excel report
    // ─────────────────────────────────────────────────
    logDivider('STEP 4: Generating Excel Report');
    const reportPath = await generateExcelReport(allMatchedActions, CONFIG.TARGET_DATE);

    // ─────────────────────────────────────────────────
    // Step 5: Generate PDF report
    // ─────────────────────────────────────────────────
    logDivider('STEP 5: Generating PDF Report');
    const pdfPath = await generatePdfReport(allMatchedActions, CONFIG.TARGET_DATE);

    // ─────────────────────────────────────────────────
    // Step 6: Cleanup temporary screenshots folder
    // ─────────────────────────────────────────────────
    logDivider('STEP 6: Cleaning up temporary files');
    if (fs.existsSync(CONFIG.SCREENSHOTS_DIR)) {
      try {
        fs.rmSync(CONFIG.SCREENSHOTS_DIR, { recursive: true, force: true });
        logInfo('Temporary screenshots directory deleted successfully.');
      } catch (err) {
        logWarn(`Could not clean up temporary screenshots folder: ${(err as Error).message}`);
      }
    }

    // ─────────────────────────────────────────────────
    // Summary
    // ─────────────────────────────────────────────────
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    logDivider('REPORT COMPLETE');
    logInfo(`Target Date:        ${CONFIG.TARGET_DATE}`);
    logInfo(`Total Actions:      ${allMatchedActions.length}`);
    logInfo(`Unique Ninjas:      ${new Set(allMatchedActions.map(a => a.username)).size}`);
    logInfo(`Screenshots OK:     ${allMatchedActions.filter(a => a.screenshotPath && a.screenshotPath !== 'SCREENSHOT_FAILED').length}`);
    logInfo(`Screenshots Failed: ${allMatchedActions.filter(a => a.screenshotPath === 'SCREENSHOT_FAILED').length}`);
    logInfo(`Excel Report:       ${reportPath}`);
    logInfo(`PDF Report:         ${pdfPath}`);
    logInfo(`Time Elapsed:       ${elapsed}s`);
    logInfo(`Errors Log:         ${CONFIG.ERROR_LOG_FILE}`);

  } catch (error) {
    logError('Fatal error in main execution', error as Error);
    process.exit(1);
  }
}

// Run
main().catch((err) => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
