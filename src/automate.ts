import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import { CONFIG } from './config';
import { logInfo, logError, logDivider } from './utils/logger';

// Load environment variables
dotenv.config();

const EMAIL_HOST = process.env.EMAIL_HOST;
const EMAIL_PORT = parseInt(process.env.EMAIL_PORT || '587', 10);
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;
const EMAIL_TO = process.env.EMAIL_TO;
const EMAIL_FROM = process.env.EMAIL_FROM || EMAIL_USER;

async function sendEmail(attachments: { filename: string, path: string }[]) {
  if (!EMAIL_HOST || !EMAIL_USER || !EMAIL_PASS || !EMAIL_TO) {
    throw new Error('Email configuration is incomplete. Please check your .env file.');
  }

  const transporter = nodemailer.createTransport({
    host: EMAIL_HOST,
    port: EMAIL_PORT,
    secure: EMAIL_PORT === 465, // true for 465, false for other ports
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_PASS,
    },
  });

  const mailOptions = {
    from: EMAIL_FROM,
    to: EMAIL_TO,
    subject: `Solve Ninja Daily Reports - ${CONFIG.TARGET_DATE}`,
    text: `Please find the daily Solve Ninja reports and trend analysis data attached for ${CONFIG.TARGET_DATE}.`,
    attachments,
  };

  logInfo(`Sending email to ${EMAIL_TO}...`);
  const info = await transporter.sendMail(mailOptions);
  logInfo(`Email sent successfully: ${info.messageId}`);
}

async function main() {
  logDivider('STARTING AUTOMATED REPORT GENERATION');
  
  try {
    // 1. Run the report script
    logInfo('Running npm run report...');
    execSync('npm run report', { stdio: 'inherit', cwd: CONFIG.PROJECT_ROOT });
    
    // 2. Run the analyze script
    logInfo('Running npm run analyze...');
    execSync('npm run analyze', { stdio: 'inherit', cwd: CONFIG.PROJECT_ROOT });

    // 3. Gather attachments
    const filesToAttach = [
      CONFIG.PDF_REPORT_FILE, // daily_ninja_report_<date>.pdf
      path.resolve(CONFIG.PROJECT_ROOT, 'trend_analysis_data.csv')
    ];

    const attachments = filesToAttach
      .filter(filePath => fs.existsSync(filePath))
      .map(filePath => ({
        filename: path.basename(filePath),
        path: filePath
      }));

    if (attachments.length === 0) {
      logError('No reports were generated. Skipping email.');
      return;
    }

    logInfo(`Found ${attachments.length} files to attach.`);

    // 4. Send Email
    await sendEmail(attachments);

    logDivider('AUTOMATED REPORT GENERATION COMPLETE');
  } catch (error) {
    logError('Automation failed:', error as Error);
    process.exit(1);
  }
}

main();
