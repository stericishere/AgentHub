// Notion API 客戶端
// 封裝 @notionhq/client 並內建 Rate Limiter（3 req/s token bucket）

import { Client } from '@notionhq/client';
import { logger } from '../utils/logger';

class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private queue: Array<{ resolve: () => void }> = [];
  private draining = false;

  constructor(
    private maxTokens: number = 3,
    private refillIntervalMs: number = 1000,
  ) {
    this.tokens = maxTokens;
    this.lastRefill = Date.now();
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const newTokens = Math.floor(elapsed / this.refillIntervalMs) * this.maxTokens;
    if (newTokens > 0) {
      this.tokens = Math.min(this.maxTokens, this.tokens + newTokens);
      this.lastRefill = now;
    }
  }

  async acquire(): Promise<void> {
    this.refill();
    if (this.tokens > 0) {
      this.tokens--;
      return;
    }
    return new Promise<void>((resolve) => {
      this.queue.push({ resolve });
      this.startDraining();
    });
  }

  private startDraining(): void {
    if (this.draining) return;
    this.draining = true;
    const drain = () => {
      this.refill();
      while (this.tokens > 0 && this.queue.length > 0) {
        this.tokens--;
        this.queue.shift()!.resolve();
      }
      if (this.queue.length > 0) {
        setTimeout(drain, this.refillIntervalMs);
      } else {
        this.draining = false;
      }
    };
    setTimeout(drain, this.refillIntervalMs);
  }
}

class NotionApiService {
  private client: Client | null = null;
  private limiter = new RateLimiter(3, 1000);

  initialize(accessToken: string): void {
    this.client = new Client({
      auth: accessToken,
      timeoutMs: 30_000,
    });
    logger.info('[NotionApi] Client initialized');
  }

  private getClient(): Client {
    if (!this.client) {
      throw new Error('NotionApi 尚未初始化，請先呼叫 initialize()');
    }
    return this.client;
  }

  async getUser(): Promise<{ botId: string; workspaceId: string; workspaceName: string; workspaceIcon: string | null }> {
    await this.limiter.acquire();
    const client = this.getClient();
    const response = await client.users.me({});
    const bot = response as any;
    return {
      botId: bot.id,
      workspaceId: bot.bot?.owner?.workspace ? bot.id : '',
      workspaceName: bot.name || 'Workspace',
      workspaceIcon: bot.avatar_url || null,
    };
  }

  async createDatabase(
    parentPageId: string,
    title: string,
    properties: Record<string, any>,
  ): Promise<{ id: string }> {
    await this.limiter.acquire();
    const client = this.getClient();
    const response = await client.databases.create({
      parent: { type: 'page_id', page_id: parentPageId },
      title: [{ type: 'text', text: { content: title } }],
      properties,
    } as any);
    logger.info(`[NotionApi] Database "${title}" created: ${response.id}`);
    return { id: response.id };
  }

  async queryDatabase(
    databaseId: string,
    filter?: any,
    sorts?: any[],
  ): Promise<any[]> {
    const client = this.getClient();
    const allResults: any[] = [];
    let cursor: string | undefined = undefined;
    let hasMore = true;

    while (hasMore) {
      await this.limiter.acquire();
      const response = await (client as any).databases.query({
        database_id: databaseId,
        filter,
        sorts,
        start_cursor: cursor,
        page_size: 100,
      });
      allResults.push(...response.results);
      hasMore = response.has_more;
      cursor = response.next_cursor ?? undefined;
    }

    return allResults;
  }

  async createPage(
    databaseId: string,
    properties: Record<string, any>,
  ): Promise<{ id: string }> {
    await this.limiter.acquire();
    const client = this.getClient();
    const response = await client.pages.create({
      parent: { database_id: databaseId },
      properties,
    });
    return { id: response.id };
  }

  async updatePage(
    pageId: string,
    properties: Record<string, any>,
  ): Promise<void> {
    await this.limiter.acquire();
    const client = this.getClient();
    await client.pages.update({
      page_id: pageId,
      properties,
    });
  }

  async archivePage(pageId: string): Promise<void> {
    await this.limiter.acquire();
    const client = this.getClient();
    await client.pages.update({
      page_id: pageId,
      archived: true,
    });
  }

  // === Block API（6D 文件同步用）===

  async listBlocks(pageId: string): Promise<any[]> {
    const client = this.getClient();
    const allBlocks: any[] = [];
    let cursor: string | undefined = undefined;
    let hasMore = true;

    while (hasMore) {
      await this.limiter.acquire();
      const response = await (client as any).blocks.children.list({
        block_id: pageId,
        start_cursor: cursor,
        page_size: 100,
      });
      allBlocks.push(...response.results);
      hasMore = response.has_more;
      cursor = response.next_cursor ?? undefined;
    }

    return allBlocks;
  }

  async appendBlocks(parentId: string, blocks: any[]): Promise<void> {
    const client = this.getClient();
    // Notion API 限制每次最多 100 個 blocks
    for (let i = 0; i < blocks.length; i += 100) {
      await this.limiter.acquire();
      const chunk = blocks.slice(i, i + 100);
      await (client as any).blocks.children.append({
        block_id: parentId,
        children: chunk,
      });
    }
  }

  async deleteBlock(blockId: string): Promise<void> {
    await this.limiter.acquire();
    const client = this.getClient();
    await (client as any).blocks.delete({ block_id: blockId });
  }

  async createPageWithContent(
    parentPageId: string,
    title: string,
    blocks: any[],
  ): Promise<{ id: string }> {
    await this.limiter.acquire();
    const client = this.getClient();
    // 建立頁面（最多 100 blocks 在 children 中）
    const firstBatch = blocks.slice(0, 100);
    const response = await client.pages.create({
      parent: { page_id: parentPageId },
      properties: {
        title: { title: [{ text: { content: title } }] },
      },
      children: firstBatch,
    } as any);
    // 剩餘 blocks 用 appendBlocks 補上
    if (blocks.length > 100) {
      await this.appendBlocks(response.id, blocks.slice(100));
    }
    logger.info(`[NotionApi] Page "${title}" created: ${response.id}`);
    return { id: response.id };
  }

  disconnect(): void {
    this.client = null;
    logger.info('[NotionApi] Client disconnected');
  }
}

export const notionApi = new NotionApiService();
