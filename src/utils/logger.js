// logger.js
const chalk = require('chalk');

function formatTime(date) {
  return date.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3
  });
}

function formatMetadata(meta) {
  if (!meta || Object.keys(meta).length === 0) return '';
  
  const important = ['jobId', 'ip', 'status', 'port', 'method', 'url', 'duration_ms'];
  const formatted = [];
  
  for (const key of important) {
    if (key in meta) {
      const value = meta[key];
      if (key === 'status') {
        const color = value >= 500 ? 'red' : value >= 400 ? 'yellow' : value >= 300 ? 'cyan' : 'green';
        formatted.push(`${chalk.gray(key)}: ${chalk[color](value)}`);
      } else if (key === 'duration_ms') {
        formatted.push(`${chalk.gray('duration')}: ${chalk.magenta(value + 'ms')}`);
      } else {
        formatted.push(`${chalk.gray(key)}: ${chalk.white(value)}`);
      }
    }
  }

  // Add other important metadata that might be present
  const errorKeys = Object.keys(meta).filter(k => k.toLowerCase().includes('error'));
  for (const key of errorKeys) {
    if (meta[key]) {
      formatted.push(`${chalk.red(key)}: ${chalk.red(meta[key])}`);
    }
  }

  return formatted.length ? chalk.gray(' [') + formatted.join(chalk.gray(' | ')) + chalk.gray(']') : '';
}

function safeStringify(v) {
  try {
    return typeof v === "string" ? v : JSON.stringify(v);
  } catch (e) {
    return String(v);
  }
}

function log(level, message, meta = {}) {

  // Console formatting
  const timestamp = chalk.gray(formatTime(new Date()));
  const metadata = JSON.stringify(meta);

  let levelFormatted;
  let messageFormatted;
  let icon;

  switch (level) {
    case 'info':
      icon = '○';
      levelFormatted = chalk.blue(icon + ' INFO ');
      messageFormatted = chalk.white(message);
      break;
    case 'warn':
      icon = '⚠';
      levelFormatted = chalk.yellow(icon + ' WARN ');
      messageFormatted = chalk.yellow(message);
      break;
    case 'error':
      icon = '✖';
      levelFormatted = chalk.red(icon + ' ERROR');
      messageFormatted = chalk.red(message);
      break;
    case 'debug':
      icon = '⚡';
      levelFormatted = chalk.magenta(icon + ' DEBUG');
      messageFormatted = chalk.gray(message);
      break;
    case 'success':
      icon = '✓';
      levelFormatted = chalk.green(icon + ' OK   ');
      messageFormatted = chalk.green(message);
      break;
    default:
      icon = '•';
      levelFormatted = chalk.white(icon + ` ${level.toUpperCase()}`);
      messageFormatted = chalk.white(message);
  }

  // Build the final log line with padding and alignment
  const logLine = `${timestamp} ${levelFormatted} ${messageFormatted}${metadata}`;

  // Output to console
  if (level === 'error') {
    console.error(logLine);
    // If there's an error stack, print it with proper formatting
    if (meta.error?.stack) {
      console.error(chalk.red('  └─ ') + chalk.red(meta.error.stack.replace(/\n/g, '\n     ')));
    }
  } else {
    console.log(logLine);
  }

  // For JSON logging to file if needed
  // fs.appendFileSync('app.log', JSON.stringify(entry) + '\n');
}

// Helper methods for common log levels
const logger = {
  info: (message, meta) => log('info', message, meta),
  warn: (message, meta) => log('warn', message, meta),
  error: (message, meta) => log('error', message, meta),
  debug: (message, meta) => log('debug', message, meta),
  success: (message, meta) => log('success', message, meta)
};

module.exports = { log, logger, safeStringify };