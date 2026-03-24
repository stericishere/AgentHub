import { logger } from '../utils/logger';

class CrashReporter {
  initialize(): void {
    process.on('unhandledRejection', (reason) => {
      logger.error('Unhandled Promise Rejection:', reason);
    });

    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      // Don't exit - try to keep running
    });

    logger.info('Crash reporter initialized');
  }
}

export const crashReporter = new CrashReporter();
