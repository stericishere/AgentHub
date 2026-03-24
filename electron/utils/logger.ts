type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

class Logger {
  private level: LogLevel = 'info';

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  debug(msg: string, ...args: unknown[]): void {
    this.log('debug', msg, ...args);
  }

  info(msg: string, ...args: unknown[]): void {
    this.log('info', msg, ...args);
  }

  warn(msg: string, ...args: unknown[]): void {
    this.log('warn', msg, ...args);
  }

  error(msg: string, ...args: unknown[]): void {
    this.log('error', msg, ...args);
  }

  private log(level: LogLevel, msg: string, ...args: unknown[]): void {
    if (LEVEL_ORDER[level] < LEVEL_ORDER[this.level]) return;
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
    console[level](`${prefix} ${msg}`, ...args);
  }
}

export const logger = new Logger();
