import { watch, type FSWatcher } from 'fs';
import { join } from 'path';
import { existsSync } from 'fs';
import { getAgentsDir, getKnowledgeDir } from '../utils/paths';
import { agentLoader } from './agent-loader';
import { eventBus } from './event-bus';
import { logger } from '../utils/logger';

/**
 * File watcher for agents/ and knowledge/ directories.
 * Reloads agent definitions when files change.
 * Priority: P1 (nice-to-have, not critical for core flow).
 */
class FileWatcher {
  private watchers: FSWatcher[] = [];
  private reloadTimer: ReturnType<typeof setTimeout> | null = null;

  start(): void {
    const agentsDir = join(getAgentsDir(), 'definitions');
    const knowledgeDir = getKnowledgeDir();

    if (existsSync(agentsDir)) {
      try {
        const watcher = watch(agentsDir, { recursive: true }, (eventType, filename) => {
          if (filename && filename.endsWith('.md')) {
            logger.info(`Agent definition changed: ${filename}`);
            this.scheduleReload();
          }
        });
        this.watchers.push(watcher);
        logger.info(`Watching agent definitions: ${agentsDir}`);
      } catch (err) {
        logger.warn('Failed to watch agents directory', err);
      }
    }

    if (existsSync(knowledgeDir)) {
      try {
        const watcher = watch(knowledgeDir, { recursive: true }, (eventType, filename) => {
          if (filename) {
            logger.debug(`Knowledge file changed: ${filename}`);
          }
        });
        this.watchers.push(watcher);
        logger.info(`Watching knowledge directory: ${knowledgeDir}`);
      } catch (err) {
        logger.warn('Failed to watch knowledge directory', err);
      }
    }
  }

  stop(): void {
    for (const watcher of this.watchers) {
      watcher.close();
    }
    this.watchers = [];
    if (this.reloadTimer) {
      clearTimeout(this.reloadTimer);
      this.reloadTimer = null;
    }
    logger.info('File watchers stopped');
  }

  private scheduleReload(): void {
    if (this.reloadTimer) clearTimeout(this.reloadTimer);
    this.reloadTimer = setTimeout(() => {
      logger.info('Reloading agent definitions...');
      agentLoader.load();
      // Notify renderer that agents were reloaded
      eventBus.emit('agents:reloaded', { count: agentLoader.getCount() });
    }, 500);
  }
}

export const fileWatcher = new FileWatcher();
