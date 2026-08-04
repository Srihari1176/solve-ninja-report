import * as path from 'path';
import fs from 'fs';
import ExcelJS from 'exceljs';
import minimist from 'minimist';
import { CONFIG } from './config';
import { fetchActiveNinjas } from './api/activeNinjas';
import { fetchPortfolio } from './api/portfolio';
import { fetchCityStats } from './api/stats';
import { logDivider, logInfo, logError } from './utils/logger';
import { extractDatePart } from './utils/helpers';

const args = minimist(process.argv.slice(2));

async function main() {
  // Dynamic defaults: previous day 5 PM to current day 5 PM
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  const formatDate = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const startDate = args.startDate || formatDate(yesterday);
  const endDate = args.endDate || formatDate(now);
  
  const startDateTime = args.startTime ? `${startDate} ${args.startTime}` : `${startDate} 17:00:00`;
  const endDateTime = args.endTime ? `${endDate} ${args.endTime}` : `${endDate} 17:00:00`;
  
  // OVERRIDE config so fetchActiveNinjas fetches all days back to our oldest limit
  CONFIG.TARGET_DATE = startDate; // Keep just the YYYY-MM-DD for early termination logic
  
  logDivider(`TREND ANALYSIS DATA EXTRACTION`);
  logInfo(`Date window: ${startDateTime} to ${endDateTime}`);
  
  // 1. Fetch Active Ninjas
  logDivider(`STEP 1: Fetching Active Ninjas`);
  const activeNinjas = await fetchActiveNinjas();
  logInfo(`Found ${activeNinjas.length} active ninjas in this period.`);
  
  // 2. Fetch Portfolios and extract rich actions
  logDivider(`STEP 2: Fetching Portfolios & Rich Actions`);
  const allRichActions: any[] = [];
  let processed = 0;
  
  // Verification trackers
  let totalActionsFetched = 0;
  let actionsIncluded = 0;
  let actionsTooEarly = 0;
  let actionsTooLate = 0;
  const missedActions: any[] = [];
  
  for (const ninja of activeNinjas) {
    processed++;
    const portfolio = await fetchPortfolio(ninja.username);
    if (!portfolio) continue;
    
    // Filter actions
    let matchedInPortfolio = 0;
    let totalInPortfolio = portfolio.actions.length;
    totalActionsFetched += totalInPortfolio;

    for (const action of portfolio.actions) {
      if (action.date_of_action >= startDateTime && action.date_of_action <= endDateTime) {
        matchedInPortfolio++;
        actionsIncluded++;
        // Extract rich data
        const primarySkill = action.skills && action.skills.length > 0 ? action.skills[0] : null;
        
        allRichActions.push({
          username: ninja.username,
          ninjaName: ninja.full_name,
          city: portfolio.location_city || ninja.city || 'Unknown',
          state: portfolio.location_state || 'Unknown',
          country: portfolio.location_country || 'Unknown',
          actionTitle: action.title,
          actionSummary: action.description || 'None',
          actionDate: action.date_of_action,
          hoursInvested: action.hours_invested || 0,
          ninjaTotalHours: ninja.hours_invested || 0,
          category: action.category || 'Unknown',
          type: action.type || 'Unknown',
          isVerified: action.is_verified ? 'Yes' : 'No',
          isPinned: action.is_pinned ? 'Yes' : 'No',
          skillName: primarySkill ? primarySkill.name : 'None',
          skillLabel: primarySkill ? primarySkill.label : 'None',
          microskillTitle: primarySkill && primarySkill.microskill ? primarySkill.microskill.title : 'None',
          microskillLevel: primarySkill && primarySkill.microskill ? primarySkill.microskill.level : 'None'
        });
      } else {
        if (action.date_of_action < startDateTime) actionsTooEarly++;
        if (action.date_of_action > endDateTime) actionsTooLate++;
        
        // Track misses that are on the same day as the start or end date just for transparency
        if (action.date_of_action.startsWith(startDate) || action.date_of_action.startsWith(endDate)) {
          missedActions.push({ ninjaName: ninja.full_name, title: action.title, date: action.date_of_action });
        }
      }
    }
    logInfo(`Analyzed portfolio for "${ninja.full_name}" - ${totalInPortfolio} total actions (${matchedInPortfolio} matched, ${totalInPortfolio - matchedInPortfolio} skipped)`);
    
    if (processed % 10 === 0) {
      logInfo(`[${processed}/${activeNinjas.length}] Processed portfolios...`);
    }
  }
  
  // 3. Fetch City Stats
  logDivider(`STEP 3: Fetching Geographic Stats`);
  const cityStats = await fetchCityStats();
  
  // 4. Export to Excel & CSV
  logDivider(`STEP 4: Exporting to Excel & CSV`);
  const workbook = new ExcelJS.Workbook();
  
  // Sheet 1: Rich Actions
  const actionsSheet = workbook.addWorksheet('Rich Actions Data');
  actionsSheet.columns = [
    { header: 'Username', key: 'username', width: 15 },
    { header: 'Ninja Name', key: 'ninjaName', width: 25 },
    { header: 'City', key: 'city', width: 20 },
    { header: 'State', key: 'state', width: 20 },
    { header: 'Country', key: 'country', width: 15 },
    { header: 'Action Title', key: 'actionTitle', width: 40 },
    { header: 'Action Summary', key: 'actionSummary', width: 50 },
    { header: 'Date', key: 'actionDate', width: 25 },
    { header: 'Action Hours', key: 'hoursInvested', width: 15 },
    { header: 'Ninja Total Hours', key: 'ninjaTotalHours', width: 15 },
    { header: 'Category', key: 'category', width: 20 },
    { header: 'Type', key: 'type', width: 20 },
    { header: 'Verified', key: 'isVerified', width: 10 },
    { header: 'Pinned', key: 'isPinned', width: 10 },
    { header: 'Skill Name', key: 'skillName', width: 20 },
    { header: 'Skill Label', key: 'skillLabel', width: 20 },
    { header: 'Microskill', key: 'microskillTitle', width: 30 },
    { header: 'Level', key: 'microskillLevel', width: 15 },
  ];
  
  // Style headers
  actionsSheet.getRow(1).font = { bold: true };
  actionsSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD3D3D3' } };
  
  actionsSheet.addRows(allRichActions);
  
  // Sheet 2: City Stats
  const statsSheet = workbook.addWorksheet('City Wise Stats');
  statsSheet.columns = [
    { header: 'City', key: 'city', width: 25 },
    { header: 'Active Ninjas', key: 'active_ninjas', width: 15 },
    { header: 'Action Count', key: 'action_count', width: 15 }
  ];
  
  // Style headers
  statsSheet.getRow(1).font = { bold: true };
  statsSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD3D3D3' } };
  
  statsSheet.addRows(cityStats);
  
  const outPathExcel = path.resolve(__dirname, '..', 'trend_analysis_data.xlsx');
  await workbook.xlsx.writeFile(outPathExcel);
  
  // CSV Export for Rich Actions Data
  const outPathCsv = path.resolve(__dirname, '..', 'trend_analysis_data.csv');
  await workbook.csv.writeFile(outPathCsv, { sheetName: 'Rich Actions Data' });
  
  // 5. Generate Verification Summary Report
  logDivider(`STEP 5: Generating Verification Summary`);
  const summaryLines = [
    `EXTRACTION VERIFICATION SUMMARY`,
    `===============================`,
    `Window Start: ${startDateTime}`,
    `Window End:   ${endDateTime}`,
    ``,
    `Total Ninjas Processed: ${activeNinjas.length}`,
    `Total Actions Fetched:  ${totalActionsFetched}`,
    `Actions Included:       ${actionsIncluded} (Match exact timeframe)`,
    `Actions Discarded:      ${totalActionsFetched - actionsIncluded}`,
    `   - Too Early:         ${actionsTooEarly}`,
    `   - Too Late:          ${actionsTooLate}`,
    ``,
    `NEAR MISSES (Actions discarded that happened on ${startDate} or ${endDate}):`,
    ...(missedActions.length > 0 
        ? missedActions.map(m => ` - [${m.date}] ${m.ninjaName}: ${m.title}`) 
        : [` - No near misses found.`])
  ];
  const outPathSummary = path.resolve(__dirname, '..', 'extraction_summary.txt');
  fs.writeFileSync(outPathSummary, summaryLines.join('\\n'), 'utf-8');
  logInfo(`Saved extraction summary to ${outPathSummary}`);

  logInfo(`Successfully wrote ${allRichActions.length} actions and ${cityStats.length} city stats to ${outPathExcel}`);
  logInfo(`Also saved action data directly to ${outPathCsv}`);
  logDivider(`EXTRACTION COMPLETE`);
}

main().catch(e => {
  logError('Analysis failed', e);
  process.exit(1);
});
