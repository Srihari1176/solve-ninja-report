import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { CONFIG } from '../config';
import { MatchedAction } from '../processing/actionFilter';
import { logInfo, logError } from '../utils/logger';

/**
 * Generate a beautifully styled PDF report representing all worksheets in the Excel report.
 */
export async function generatePdfReport(
  matchedActions: MatchedAction[],
  targetDate: string
): Promise<string> {
  logInfo(`Generating PDF report with ${matchedActions.length} row(s)...`);

  // 1. Calculate Summary Metrics (matching the Summary sheet in Excel)
  const uniqueNinjas = new Set(matchedActions.map(a => a.username)).size;
  const successfulScreenshots = matchedActions.filter(
    a => a.screenshotPath && a.screenshotPath !== 'SCREENSHOT_FAILED' && fs.existsSync(a.screenshotPath)
  ).length;
  const failedScreenshots = matchedActions.length - successfulScreenshots;
  const generatedAtStr = new Date().toLocaleString();

  // Helper to convert screenshot path to base64
  const getBase64Image = (filePath: string | undefined): string => {
    if (filePath && filePath !== 'SCREENSHOT_FAILED' && fs.existsSync(filePath)) {
      try {
        const fileBuffer = fs.readFileSync(filePath);
        return `data:image/png;base64,${fileBuffer.toString('base64')}`;
      } catch (err) {
        logError(`Failed to read screenshot file for base64 conversion: ${filePath}`, err as Error);
      }
    }
    return '';
  };

  // 2. Build the HTML Structure
  let tableRowsHtml = '';
  for (let i = 0; i < matchedActions.length; i++) {
    const action = matchedActions[i];
    const base64Img = getBase64Image(action.screenshotPath);
    
    let screenshotCellHtml = '';
    if (base64Img) {
      screenshotCellHtml = `<img src="${base64Img}" alt="Action Screenshot" />`;
    } else {
      const label = action.screenshotPath === 'SCREENSHOT_FAILED' ? 'Capture Failed' : 'N/A';
      screenshotCellHtml = `<span class="failed-badge">${label}</span>`;
    }

    const rowClass = i % 2 === 1 ? 'alt-row' : '';

    tableRowsHtml += `
      <tr class="${rowClass}">
        <td style="text-align: center;">${i + 1}</td>
        <td>
          <div class="ninja-name">${action.ninjaName}</div>
          <div class="ninja-username">@${action.username}</div>
        </td>
        <td>${action.location}</td>
        <td>
          <a class="profile-link" href="${action.profileUrl}" target="_blank">
            ${action.profileUrl}
          </a>
        </td>
        <td class="action-title">${action.actionTitle}</td>
        <td style="text-align: center;">${action.actionDate}</td>
        <td class="screenshot-cell">${screenshotCellHtml}</td>
      </tr>
    `;
  }

  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Solve Ninja Daily Activity Report</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      margin: 0;
      padding: 0;
      color: #1C2321;
      background-color: #FFFFFF;
      -webkit-print-color-adjust: exact;
    }
    
    .container {
      padding: 24px;
    }

    /* Header styling */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 3px solid #1FAA64;
      padding-bottom: 12px;
      margin-bottom: 24px;
    }
    .header-title h1 {
      margin: 0;
      font-size: 24px;
      color: #1FAA64;
      font-weight: 700;
      letter-spacing: -0.5px;
    }
    .header-title p {
      margin: 4px 0 0 0;
      font-size: 13px;
      color: #606864;
    }
    .header-brand {
      font-weight: 700;
      font-size: 16px;
      color: #1FAA64;
      border: 2px solid #1FAA64;
      padding: 4px 10px;
      border-radius: 6px;
      letter-spacing: 0.5px;
    }

    /* Summary section (dashboard metrics style) */
    .summary-section {
      margin-bottom: 28px;
    }
    .summary-title {
      font-size: 14px;
      font-weight: 600;
      color: #404844;
      margin-bottom: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
    }
    .summary-card {
      background-color: #F7F9F8;
      border-left: 4px solid #1FAA64;
      padding: 12px 16px;
      border-radius: 4px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }
    .summary-card.accent {
      border-left-color: #2E86AB;
    }
    .summary-card .label {
      font-size: 11px;
      color: #606864;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }
    .summary-card .value {
      font-size: 18px;
      font-weight: 700;
      color: #1C2321;
    }

    /* Table styling */
    .table-title {
      font-size: 14px;
      font-weight: 600;
      color: #404844;
      margin-bottom: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #D0D0D0;
      font-size: 12px;
      margin-bottom: 20px;
    }
    th {
      background-color: #1FAA64;
      color: #FFFFFF;
      font-weight: 600;
      text-align: left;
      padding: 10px 8px;
      border: 1px solid #1FAA64;
      text-transform: uppercase;
      font-size: 11px;
      letter-spacing: 0.5px;
    }
    th:first-child {
      text-align: center;
    }
    td {
      padding: 10px 8px;
      border: 1px solid #E0E4E2;
      vertical-align: middle;
      word-wrap: break-word;
    }
    .alt-row {
      background-color: #F7F9F8;
    }
    
    .ninja-name {
      font-weight: 600;
      color: #1C2321;
    }
    .ninja-username {
      font-size: 10px;
      color: #707874;
      margin-top: 2px;
    }
    .profile-link {
      color: #0563C1;
      text-decoration: underline;
      word-break: break-all;
      font-size: 11px;
    }
    .action-title {
      font-weight: 500;
      color: #1C2321;
      max-width: 200px;
    }
    
    /* Screenshot fitting */
    .screenshot-cell {
      text-align: center;
      width: 260px;
      padding: 6px;
    }
    .screenshot-cell img {
      max-width: 250px;
      max-height: 140px;
      border-radius: 4px;
      border: 1px solid #D0D0D0;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      display: block;
      margin: 0 auto;
    }
    .failed-badge {
      display: inline-block;
      padding: 4px 8px;
      background-color: #FCE8E6;
      color: #C5221F;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 500;
      border: 1px solid #FAD2CF;
    }

    /* Print-specific overrides to avoid mid-row breaks */
    tr {
      page-break-inside: avoid;
      break-inside: avoid;
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div class="header">
      <div class="header-title">
        <h1>Solve Ninja Daily Activity Report</h1>
        <p>Target Date: <strong>${targetDate}</strong> | Generated on ${generatedAtStr}</p>
      </div>
      <div class="header-brand">REAP BENEFIT</div>
    </div>

    <!-- Summary Sheet Contents (Worksheet 1 representation) -->
    <div class="summary-section">
      <div class="summary-title">Report Summary</div>
      <div class="summary-grid">
        <div class="summary-card">
          <div class="label">Report Date</div>
          <div class="value">${targetDate}</div>
        </div>
        <div class="summary-card accent">
          <div class="label">Total Actions Found</div>
          <div class="value">${matchedActions.length}</div>
        </div>
        <div class="summary-card accent">
          <div class="label">Unique Ninjas</div>
          <div class="value">${uniqueNinjas}</div>
        </div>
        <div class="summary-card">
          <div class="label">Screenshots Captured</div>
          <div class="value">${successfulScreenshots} / ${matchedActions.length}</div>
        </div>
      </div>
    </div>

    <!-- Daily Report Sheet Contents (Worksheet 2 representation) -->
    <div class="table-section">
      <div class="table-title">Daily Activity Details</div>
      <table>
        <thead>
          <tr>
            <th style="width: 5%; text-align: center;">S.No</th>
            <th style="width: 18%;">Name</th>
            <th style="width: 14%;">Location</th>
            <th style="width: 25%;">Profile URL</th>
            <th style="width: 20%;">Action Title</th>
            <th style="width: 10%; text-align: center;">Action Date</th>
            <th style="width: 8%; text-align: center;">Screenshot</th>
          </tr>
        </thead>
        <tbody>
          ${tableRowsHtml || '<tr><td colspan="7" style="text-align: center; padding: 20px; color: #707874;">No actions recorded for this date.</td></tr>'}
        </tbody>
      </table>
    </div>
  </div>
</body>
</html>
  `;

  // 3. Render HTML to PDF via Playwright
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    // Set content and wait until loaded
    await page.setContent(htmlContent, { waitUntil: 'networkidle' });

    // Print to Landscape PDF (perfect for spreadsheet layouts)
    await page.pdf({
      path: CONFIG.PDF_REPORT_FILE,
      format: 'A4',
      landscape: true,
      printBackground: true,
      margin: {
        top: '10mm',
        bottom: '10mm',
        left: '10mm',
        right: '10mm',
      },
    });

    logInfo(`PDF report successfully created: ${CONFIG.PDF_REPORT_FILE}`);
    return CONFIG.PDF_REPORT_FILE;

  } catch (err) {
    logError('Failed to generate PDF from HTML via Playwright', err as Error);
    throw err;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
