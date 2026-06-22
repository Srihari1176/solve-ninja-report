import ExcelJS from 'exceljs';
import fs from 'fs';
import { CONFIG } from '../config';
import { MatchedAction } from '../processing/actionFilter';
import { logInfo, logError } from '../utils/logger';

/**
 * Generate the daily ninja report Excel file.
 */
export async function generateExcelReport(
  matchedActions: MatchedAction[],
  targetDate: string
): Promise<string> {
  logInfo(`Generating Excel report with ${matchedActions.length} row(s)...`);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Solve Ninja Report Automation';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Daily Report', {
    properties: { tabColor: { argb: '1FAA64' } },
  });

  // Define columns
  sheet.columns = [
    { header: 'S.No', key: 'sno', width: 8 },
    { header: 'Name', key: 'name', width: 25 },
    { header: 'Location', key: 'location', width: 20 },
    { header: 'Profile URL', key: 'profileUrl', width: 50 },
    { header: 'Action Title', key: 'actionTitle', width: 35 },
    { header: 'Action Date', key: 'actionDate', width: 18 },
    { header: 'Screenshot', key: 'screenshot', width: 40 },
  ];

  // Style the header row
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFF' }, size: 12, name: 'Calibri' };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: '1FAA64' }, // Solve Ninja green
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  headerRow.height = 28;

  // Add data rows
  for (let i = 0; i < matchedActions.length; i++) {
    const action = matchedActions[i];
    const hasScreenshot = action.screenshotPath && action.screenshotPath !== 'SCREENSHOT_FAILED' && fs.existsSync(action.screenshotPath);
    
    const row = sheet.addRow({
      sno: i + 1,
      name: action.ninjaName,
      location: action.location,
      profileUrl: action.profileUrl,
      actionTitle: action.actionTitle,
      actionDate: action.actionDate,
      screenshot: hasScreenshot ? '' : (action.screenshotPath === 'SCREENSHOT_FAILED' ? 'Failed' : 'N/A'),
    });

    // Make profile URL a clickable hyperlink
    const urlCell = row.getCell('profileUrl');
    urlCell.value = {
      text: action.profileUrl,
      hyperlink: action.profileUrl,
    };
    urlCell.font = { color: { argb: '0563C1' }, underline: true };

    // Style data rows
    row.alignment = { vertical: 'middle', wrapText: true };
    
    if (hasScreenshot) {
      row.height = 140; // 140 points (~186 pixels)
      try {
        const imageId = workbook.addImage({
          filename: action.screenshotPath,
          extension: 'png',
        });
        sheet.addImage(imageId, {
          tl: { col: 6, row: i + 1 },
          ext: { width: 300, height: 170 } // Width: 300px, Height: 170px fits nicely inside 140pt row and 45width column
        });
      } catch (err) {
        logError(`Failed to embed screenshot for action of ninja ${action.ninjaName}`, err as Error);
        row.getCell('screenshot').value = 'Failed to Embed';
        row.height = 22;
      }
    } else {
      row.height = 22;
    }

    // Alternate row shading
    if (i % 2 === 1) {
      row.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'F0F8F0' },
      };
    }
  }

  // Add borders to all cells
  const lastRow = sheet.rowCount;
  const lastCol = sheet.columnCount;
  for (let r = 1; r <= lastRow; r++) {
    for (let c = 1; c <= lastCol; c++) {
      const cell = sheet.getCell(r, c);
      cell.border = {
        top: { style: 'thin', color: { argb: 'D0D0D0' } },
        left: { style: 'thin', color: { argb: 'D0D0D0' } },
        bottom: { style: 'thin', color: { argb: 'D0D0D0' } },
        right: { style: 'thin', color: { argb: 'D0D0D0' } },
      };
    }
  }

  // Auto-fit columns (approximate based on content)
  sheet.columns.forEach((column) => {
    if (column.header && column.width) {
      if (column.key === 'screenshot') {
        column.width = 45; // Keep fixed width for screenshots
        return;
      }
      let maxLength = column.header.length;
      column.eachCell?.({ includeEmpty: false }, (cell) => {
        const cellValue = cell.value?.toString() || '';
        maxLength = Math.max(maxLength, cellValue.length);
      });
      column.width = Math.min(Math.max(maxLength + 2, column.width), 60);
    }
  });

  // Add a summary sheet
  const summarySheet = workbook.addWorksheet('Summary', {
    properties: { tabColor: { argb: '2E86AB' } },
  });

  summarySheet.columns = [
    { header: 'Metric', key: 'metric', width: 30 },
    { header: 'Value', key: 'value', width: 30 },
  ];

  // Style summary header
  const summaryHeader = summarySheet.getRow(1);
  summaryHeader.font = { bold: true, color: { argb: 'FFFFFF' }, size: 12 };
  summaryHeader.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: '2E86AB' },
  };

  // Count unique ninjas
  const uniqueNinjas = new Set(matchedActions.map(a => a.username)).size;

  summarySheet.addRow({ metric: 'Report Date', value: targetDate });
  summarySheet.addRow({ metric: 'Generated At', value: new Date().toISOString() });
  summarySheet.addRow({ metric: 'Total Actions Found', value: matchedActions.length });
  summarySheet.addRow({ metric: 'Unique Ninjas', value: uniqueNinjas });
  summarySheet.addRow({
    metric: 'Successful Screenshots',
    value: matchedActions.filter(a => a.screenshotPath && a.screenshotPath !== 'SCREENSHOT_FAILED').length,
  });
  summarySheet.addRow({
    metric: 'Failed Screenshots',
    value: matchedActions.filter(a => a.screenshotPath === 'SCREENSHOT_FAILED').length,
  });

  // Write file
  const outputPath = CONFIG.REPORT_FILE;
  await workbook.xlsx.writeFile(outputPath);

  logInfo(`Excel report saved: ${outputPath}`);
  return outputPath;
}
