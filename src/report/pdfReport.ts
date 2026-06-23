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
      screenshotCellHtml = `<div class="screenshot-container"><img src="${base64Img}" alt="Action Screenshot" /></div>`;
    } else {
      const label = action.screenshotPath === 'SCREENSHOT_FAILED' ? 'Capture Failed' : 'N/A';
      screenshotCellHtml = `<div class="screenshot-container"><span class="failed-badge">${label}</span></div>`;
    }

    const rowClass = i % 2 === 1 ? 'alt-row' : '';

    tableRowsHtml += `
      <tr class="${rowClass}">
        <td class="text-center font-medium text-muted">${i + 1}</td>
        <td>
          <div class="ninja-name">${action.ninjaName}</div>
          <div class="ninja-username">@${action.username}</div>
        </td>
        <td>
          <span class="location-badge">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
            ${action.location}
          </span>
        </td>
        <td>
          <a class="profile-link" href="${action.profileUrl}" target="_blank">
            ${action.profileUrl}
          </a>
        </td>
        <td class="action-title">${action.actionTitle}</td>
        <td class="text-center text-sm">${action.actionDate}</td>
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
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --primary: #1FAA64;
      --primary-light: #E8F6F0;
      --primary-dark: #16854E;
      --accent: #2E86AB;
      --text-main: #1C2321;
      --text-muted: #606864;
      --bg-main: #F4F7F6;
      --card-bg: #FFFFFF;
      --border-color: #E6EAE8;
    }
    
    body {
      font-family: 'Outfit', sans-serif;
      margin: 0;
      padding: 0;
      color: var(--text-main);
      background-color: var(--bg-main);
      -webkit-print-color-adjust: exact;
    }
    
    .container {
      padding: 30px 40px;
      max-width: 100%;
    }

    /* Modern Glassy Header */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
      padding: 24px 32px;
      border-radius: 16px;
      margin-bottom: 30px;
      color: white;
      box-shadow: 0 10px 25px rgba(31, 170, 100, 0.2);
    }
    .header-title h1 {
      margin: 0;
      font-size: 28px;
      font-weight: 700;
      letter-spacing: -0.5px;
    }
    .header-title p {
      margin: 6px 0 0 0;
      font-size: 14px;
      opacity: 0.9;
      font-weight: 300;
    }
    .header-brand {
      font-weight: 700;
      font-size: 14px;
      background: rgba(255, 255, 255, 0.2);
      backdrop-filter: blur(10px);
      padding: 8px 16px;
      border-radius: 20px;
      letter-spacing: 1px;
      border: 1px solid rgba(255, 255, 255, 0.3);
    }

    /* Sleek Summary Dashboard */
    .summary-section {
      margin-bottom: 36px;
    }
    .section-title {
      font-size: 18px;
      font-weight: 600;
      color: var(--text-main);
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .section-title::before {
      content: '';
      display: block;
      width: 4px;
      height: 18px;
      background: var(--primary);
      border-radius: 4px;
    }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 20px;
    }
    .summary-card {
      background-color: var(--card-bg);
      padding: 20px 24px;
      border-radius: 16px;
      box-shadow: 0 4px 15px rgba(0,0,0,0.03);
      border: 1px solid var(--border-color);
      position: relative;
      overflow: hidden;
    }
    .summary-card::after {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 4px;
      background: var(--primary);
    }
    .summary-card.accent::after {
      background: var(--accent);
    }
    .summary-card .label {
      font-size: 12px;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      font-weight: 600;
      margin-bottom: 8px;
    }
    .summary-card .value {
      font-size: 28px;
      font-weight: 700;
      color: var(--text-main);
    }

    /* Premium Table Styling */
    .table-container {
      background: var(--card-bg);
      border-radius: 16px;
      box-shadow: 0 4px 15px rgba(0,0,0,0.03);
      border: 1px solid var(--border-color);
      overflow: hidden;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    th {
      background-color: #FAFCFB;
      color: var(--text-muted);
      font-weight: 600;
      text-align: left;
      padding: 16px 12px;
      border-bottom: 1px solid var(--border-color);
      text-transform: uppercase;
      font-size: 11px;
      letter-spacing: 0.5px;
    }
    td {
      padding: 16px 12px;
      border-bottom: 1px solid var(--border-color);
      vertical-align: middle;
    }
    tr:last-child td {
      border-bottom: none;
    }
    .alt-row {
      background-color: #FAFCFB;
    }
    
    .ninja-name {
      font-weight: 600;
      font-size: 14px;
      color: var(--text-main);
    }
    .ninja-username {
      font-size: 11px;
      color: var(--text-muted);
      margin-top: 4px;
    }
    .location-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      background: var(--primary-light);
      color: var(--primary-dark);
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 500;
    }
    .profile-link {
      color: var(--accent);
      text-decoration: none;
      word-break: break-all;
      font-size: 12px;
      font-weight: 500;
    }
    .action-title {
      font-weight: 500;
      color: var(--text-main);
      max-width: 220px;
      line-height: 1.4;
    }
    .text-center { text-align: center; }
    .text-sm { font-size: 12px; }
    .font-medium { font-weight: 500; }
    .text-muted { color: var(--text-muted); }
    
    /* Elegant Image Thumbnails */
    .screenshot-cell {
      text-align: center;
      width: 280px;
      padding: 8px !important;
    }
    .screenshot-container {
      background: #F8F9FA;
      padding: 6px;
      border-radius: 12px;
      border: 1px solid var(--border-color);
      display: inline-block;
    }
    .screenshot-container img {
      max-width: 250px;
      max-height: 140px;
      border-radius: 8px;
      display: block;
      margin: 0 auto;
      object-fit: cover;
    }
    .failed-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 250px;
      height: 80px;
      background-color: #FFF0F0;
      color: #D32F2F;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 600;
      border: 1px dashed #FFCDD2;
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

    <!-- Summary Dashboard -->
    <div class="summary-section">
      <div class="section-title">Overview Dashboard</div>
      <div class="summary-grid">
        <div class="summary-card">
          <div class="label">Report Date</div>
          <div class="value">${targetDate}</div>
        </div>
        <div class="summary-card accent">
          <div class="label">Total Actions Recorded</div>
          <div class="value">${matchedActions.length}</div>
        </div>
        <div class="summary-card accent">
          <div class="label">Unique Ninjas Engaged</div>
          <div class="value">${uniqueNinjas}</div>
        </div>
        <div class="summary-card">
          <div class="label">Screenshots Captured</div>
          <div class="value">${successfulScreenshots} / ${matchedActions.length}</div>
        </div>
      </div>
    </div>

    <!-- Data Table -->
    <div class="table-section">
      <div class="section-title">Daily Activity Details</div>
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th style="width: 5%; text-align: center;">S.No</th>
              <th style="width: 18%;">Ninja Profile</th>
              <th style="width: 14%;">Location</th>
              <th style="width: 22%;">Profile Link</th>
              <th style="width: 20%;">Action Title</th>
              <th style="width: 10%; text-align: center;">Action Date</th>
              <th style="width: 11%; text-align: center;">Screenshot Verification</th>
            </tr>
          </thead>
          <tbody>
            ${tableRowsHtml || '<tr><td colspan="7" class="text-center" style="padding: 40px; color: var(--text-muted);">No actions recorded for this date.</td></tr>'}
          </tbody>
        </table>
      </div>
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
