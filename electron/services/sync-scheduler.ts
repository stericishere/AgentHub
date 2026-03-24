// 自動同步排程器
// 負責定期觸發 syncAll，以及離線佇列回放

import { logger } from '../utils/logger';

class SyncScheduler {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private _interval: number = 5 * 60 * 1000; // 預設 5 分鐘
  private _enabled: boolean = false;
  private _onSync: (() => Promise<void>) | null = null;

  /**
   * 設定同步回呼函式（通常由 main.ts 傳入 syncManager.syncAll）
   */
  configure(onSync: () => Promise<void>): void {
    this._onSync = onSync;
  }

  /**
   * 啟動自動同步排程
   * @param intervalMs 間隔毫秒數，不傳則沿用上次設定（預設 5 分鐘）
   */
  start(intervalMs?: number): void {
    if (this.intervalId) this.stop();

    if (intervalMs !== undefined && intervalMs > 0) {
      this._interval = intervalMs;
    }

    this._enabled = true;
    this.intervalId = setInterval(() => {
      this.tick();
    }, this._interval);

    logger.info(`[SyncScheduler] 已啟動，間隔 ${this._interval}ms（${this._interval / 60000} 分鐘）`);
  }

  /**
   * 停止自動同步排程
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this._enabled = false;
    logger.info('[SyncScheduler] 已停止');
  }

  get enabled(): boolean {
    return this._enabled;
  }

  get interval(): number {
    return this._interval;
  }

  private async tick(): Promise<void> {
    if (!this._onSync) {
      logger.warn('[SyncScheduler] onSync 尚未設定，跳過本次同步');
      return;
    }
    logger.info('[SyncScheduler] 開始定時同步...');
    try {
      await this._onSync();
      logger.info('[SyncScheduler] 定時同步完成');
    } catch (err) {
      logger.error('[SyncScheduler] 定時同步失敗', err);
    }
  }
}

export const syncScheduler = new SyncScheduler();
