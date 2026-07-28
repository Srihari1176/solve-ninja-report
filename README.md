# Solve Ninja Report Automation

This repository contains automated scripts for generating daily activity reports and extracting specific data trends for Solve Ninjas.

## Daily Report Generation

This script automates the creation of a daily summary report. It fetches the latest active ninjas, extracts their portfolio details, takes automated screenshots of their profiles, and compiles everything into both an Excel sheet and a PDF report.

### Running the Script

To generate the daily report, simply run:
```bash
npm run report
```

### Outputs
After the script finishes, it cleans up temporary files and generates two primary reports in the root directory:
1. **`daily_ninja_report.xlsx`**: An Excel file containing detailed stats, actions, and metadata for the day's active ninjas.
2. **`daily_ninja_report_[DATE].pdf`**: A formatted PDF report containing visual statistics and screenshots of ninja portfolios.

## Trend Analysis Data Extraction

The Trend Analysis script allows you to perfectly extract all user actions from the Solve Ninja platform that fall into a specific time window. 

By default, it will fetch actions from the **previous 24 hours (5:00 PM yesterday to 5:00 PM today)**.

### Running the Script

To run the analysis for the default 24-hour window, simply use:
```bash
npx tsx src/generateAnalysisData.ts
```

*(Note: We use `tsx` to flawlessly execute the script and avoid Node ES Module extension errors).*

### Running for Custom Date Ranges
You can easily override the default dates to pull historical data for any timeframe you wish! 
Pass in the specific dates and times using flags:

```bash
npx tsx src/generateAnalysisData.ts --startDate="2025-01-01" --endDate="2026-07-25" --startTime="00:00:00" --endTime="23:59:59"
```

### Outputs
The script will generate three files in the root directory:
1. **`trend_analysis_data.xlsx`**: A full Excel spreadsheet containing the extracted rich actions (Sheet 1) and Geographic/City statistics (Sheet 2).
2. **`trend_analysis_data.csv`**: A CSV version of the rich actions data.
3. **`extraction_summary.txt`**: The Verification Audit Log.

## The Verification Mechanism (Audit Log)
Data integrity is critical. Whenever you run the analysis, the script generates an `extraction_summary.txt` file that proves **exactly** what happened during the run.

The summary file includes:
- **Exact Window Parameters:** The start and end timestamps the script checked against.
- **Global Counts:** How many total ninjas were processed, and how many raw actions they had in total.
- **Filtering Breakdown:** The number of actions kept vs. the number discarded (broken down into 'too early' or 'too late').
- **Near Misses:** A strict log of any action that was discarded but happened on the boundary dates (e.g. earlier on the start date). This logs the exact timestamp and action name so your team can factually verify *why* an action didn't make it into the final Excel sheet.
