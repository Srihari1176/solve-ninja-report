import fs from 'fs';
import path from 'path';
import { CONFIG } from '../config';

type LogLevel = 'INFO' | 'WARN' | 'ERROR';

/**
 * Ensures the directory for the error log exists.
 */
function ensureLogDir(): void {
  const dir = path.dirname(CONFIG.ERROR_LOG_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Get current timestamp string for log output in local time.
 */
function timestamp(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * Log a message to the console with level prefix.
 */
export function log(level: LogLevel, message: string): void {
  const ts = timestamp();
  const formatted = `[${level}] ${ts} - ${message}`;
  
  if (level === 'ERROR') {
    console.error(formatted);
  } else if (level === 'WARN') {
    console.warn(formatted);
  } else {
    console.log(formatted);
  }
}

/**
 * Log an info message.
 */
export function logInfo(message: string): void {
  log('INFO', message);
}

/**
 * Log a warning message.
 */
export function logWarn(message: string): void {
  log('WARN', message);
}

/**
 * Log an error message to both console and errors.log.
 */
export function logError(message: string, error?: Error): void {
  const errorDetails = error ? ` | ${error.message}\n${error.stack}` : '';
  const fullMessage = `${message}${errorDetails}`;
  
  log('ERROR', fullMessage);

  // Also append to errors.log
  try {
    ensureLogDir();
    const ts = timestamp();
    const logLine = `[${ts}] ${fullMessage}\n`;
    fs.appendFileSync(CONFIG.ERROR_LOG_FILE, logLine, 'utf-8');
  } catch (e) {
    console.error('[ERROR] Failed to write to error log file:', e);
  }
}

/**
 * Log a summary section divider.
 */
export function logDivider(title: string): void {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  ${title}`);
  console.log(`${'='.repeat(60)}\n`);
}
