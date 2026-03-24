// 文件同步管理器 — Phase 6D
// Markdown 檔案 ↔ Notion Page + Blocks 雙向同步

import * as fs from 'fs';
import * as path from 'path';
import { database } from './database';
import { notionApi } from './notion-api';
import { markdownToBlocks, blocksToMarkdown, contentHash } from './markdown-notion';
import { logger } from '../utils/logger';
import type {
  DocSyncScope,
  DocSyncMapping,
  DocSyncStatus,
  DocSyncResult,
  DocSyncOptions,
  DocConflictStrategy,
} from '../types/sync';

// 專案根目錄
const PROJECT_ROOT = process.env.MAESTRO_ROOT || path.resolve(__dirname, '..', '..');

interface ScopeConfig {
  scope: DocSyncScope;
  label: string;
  settingsKey: string;
  getBasePath: (projectWorkDir?: string) => string;
}

const SCOPE_CONFIGS: ScopeConfig[] = [
  {
    scope: 'knowledge',
    label: '知識庫',
    settingsKey: 'docSync.knowledge.rootPageId',
    getBasePath: () => path.join(PROJECT_ROOT, 'knowledge', 'company'),
  },
  {
    scope: 'docs',
    label: '專案文件',
    settingsKey: 'docSync.docs.rootPageId',
    getBasePath: () => path.join(PROJECT_ROOT, 'docs'),
  },
  {
    scope: 'project',
    label: '專案',
    settingsKey: 'docSync.project.rootPageId',
    getBasePath: (workDir?: string) => workDir || PROJECT_ROOT,
  },
];

class DocSyncManager {
  // ── 檔案探索 ───────────────────────────────────────────

  discoverFiles(scope: DocSyncScope, projectWorkDir?: string): string[] {
    const config = SCOPE_CONFIGS.find((c) => c.scope === scope);
    if (!config) return [];
    const basePath = config.getBasePath(projectWorkDir);
    if (!fs.existsSync(basePath)) return [];
    return this.walkMdFiles(basePath).map((absPath) =>
      path.relative(PROJECT_ROOT, absPath).replace(/\\/g, '/'),
    );
  }

  private walkMdFiles(dir: string): string[] {
    const results: string[] = [];
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          results.push(...this.walkMdFiles(fullPath));
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
          results.push(fullPath);
        }
      }
    } catch {
      // 權限或路徑不存在
    }
    return results;
  }

  // ── 狀態查詢 ───────────────────────────────────────────

  getStatus(scope: DocSyncScope, projectWorkDir?: string): DocSyncStatus {
    const config = SCOPE_CONFIGS.find((c) => c.scope === scope)!;
    const files = this.discoverFiles(scope, projectWorkDir);
    const rootPageId = this.getRootPageId(scope);

    // 已同步數
    const mappings = this.getMappings(scope);
    const synced = mappings.filter((m) => m.notionPageId).length;

    return {
      scope,
      label: config.label,
      totalFiles: files.length,
      synced,
      pendingPush: files.length - synced,
      rootPageId,
    };
  }

  getMappings(scope: DocSyncScope): DocSyncMapping[] {
    const rows = database.prepare(
      'SELECT id, scope, local_path, notion_page_id, local_hash, notion_hash, last_synced_at FROM doc_sync_mapping WHERE scope = ?',
      [scope],
    );
    return rows.map((row: any) => ({
      id: row.id,
      scope: row.scope,
      localPath: row.local_path,
      notionPageId: row.notion_page_id,
      localHash: row.local_hash,
      notionHash: row.notion_hash,
      lastSyncedAt: row.last_synced_at,
    }));
  }

  // ── Push：本地 → Notion ──────────────────────────────

  async push(options: DocSyncOptions): Promise<DocSyncResult> {
    const start = Date.now();
    const { scope, projectWorkDir } = options;
    const errors: string[] = [];
    let pushed = 0;

    const rootPageId = this.getRootPageId(scope);
    if (!rootPageId) {
      return {
        success: false,
        pushed: 0,
        pulled: 0,
        conflicts: 0,
        errors: [`${scope} 尚未設定 Notion 根頁面 ID`],
        durationMs: Date.now() - start,
      };
    }

    const files = this.discoverFiles(scope, projectWorkDir);
    const existingMappings = new Map(this.getMappings(scope).map((m) => [m.localPath, m]));

    for (const relPath of files) {
      try {
        const absPath = path.join(PROJECT_ROOT, relPath);
        const content = fs.readFileSync(absPath, 'utf-8');
        const hash = contentHash(content);
        const existing = existingMappings.get(relPath);

        // 未變更 → 跳過
        if (existing?.localHash === hash && existing.notionPageId) {
          continue;
        }

        const blocks = markdownToBlocks(content);
        const title = this.extractTitle(content, relPath);

        if (existing?.notionPageId) {
          // 已有映射 → 刪除所有 blocks 再重新 append
          await this.replacePageBlocks(existing.notionPageId, blocks);
        } else {
          // 新檔案 → 確保資料夾頁面存在 → 建立頁面
          const parentId = await this.ensureFolderPage(scope, relPath, rootPageId);
          const page = await notionApi.createPageWithContent(parentId, title, blocks);
          this.upsertMapping(scope, relPath, page.id, hash);
          pushed++;
          continue;
        }

        // 更新 mapping
        this.upsertMapping(scope, relPath, existing!.notionPageId!, hash);
        pushed++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`${relPath}: ${msg}`);
        logger.error(`[DocSync] Push 失敗: ${relPath}`, err);
      }
    }

    // 處理已刪除的檔案
    for (const [relPath, mapping] of existingMappings) {
      if (!files.includes(relPath) && mapping.notionPageId) {
        try {
          await notionApi.archivePage(mapping.notionPageId);
          database.run('DELETE FROM doc_sync_mapping WHERE id = ?', [mapping.id]);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          errors.push(`刪除 ${relPath}: ${msg}`);
        }
      }
    }

    return {
      success: errors.length === 0,
      pushed,
      pulled: 0,
      conflicts: 0,
      errors,
      durationMs: Date.now() - start,
    };
  }

  // ── Pull：Notion → 本地 ──────────────────────────────

  async pull(options: DocSyncOptions): Promise<DocSyncResult> {
    const start = Date.now();
    const { scope, conflictStrategy = 'local-wins' } = options;
    const errors: string[] = [];
    let pulled = 0;
    let conflicts = 0;

    const mappings = this.getMappings(scope);

    for (const mapping of mappings) {
      if (!mapping.notionPageId) continue;

      try {
        const notionBlocks = await notionApi.listBlocks(mapping.notionPageId);
        const notionMd = blocksToMarkdown(notionBlocks);
        const notionNewHash = contentHash(notionMd);

        // Notion 端未變更
        if (notionNewHash === mapping.notionHash) continue;

        const absPath = path.join(PROJECT_ROOT, mapping.localPath);
        const localExists = fs.existsSync(absPath);
        const localContent = localExists ? fs.readFileSync(absPath, 'utf-8') : '';
        const localCurrentHash = contentHash(localContent);

        // 本地也變更了 → 衝突
        if (localCurrentHash !== mapping.localHash && mapping.localHash) {
          conflicts++;
          if (conflictStrategy === 'skip') continue;
          if (conflictStrategy === 'local-wins') {
            // 保留本地版本，只更新 notion hash
            this.updateMappingHashes(mapping.id, localCurrentHash, notionNewHash);
            continue;
          }
          // notion-wins → 覆寫本地
        }

        // 寫入本地檔案
        const dir = path.dirname(absPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(absPath, notionMd, 'utf-8');
        this.updateMappingHashes(mapping.id, contentHash(notionMd), notionNewHash);
        pulled++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`${mapping.localPath}: ${msg}`);
        logger.error(`[DocSync] Pull 失敗: ${mapping.localPath}`, err);
      }
    }

    return {
      success: errors.length === 0,
      pushed: 0,
      pulled,
      conflicts,
      errors,
      durationMs: Date.now() - start,
    };
  }

  // ── 同步全部 ───────────────────────────────────────────

  async syncAll(options: DocSyncOptions): Promise<DocSyncResult> {
    const pushResult = await this.push(options);
    const pullResult = await this.pull(options);

    return {
      success: pushResult.success && pullResult.success,
      pushed: pushResult.pushed,
      pulled: pullResult.pulled,
      conflicts: pullResult.conflicts,
      errors: [...pushResult.errors, ...pullResult.errors],
      durationMs: pushResult.durationMs + pullResult.durationMs,
    };
  }

  // ── 根頁面設定 ─────────────────────────────────────────

  setRootPageId(scope: DocSyncScope, pageId: string): void {
    const config = SCOPE_CONFIGS.find((c) => c.scope === scope)!;
    database.run(
      `INSERT INTO user_preferences (key, value, category) VALUES (?, ?, 'doc_sync')
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
      [config.settingsKey, pageId],
    );
  }

  getRootPageId(scope: DocSyncScope): string | null {
    const config = SCOPE_CONFIGS.find((c) => c.scope === scope)!;
    const rows = database.prepare(
      'SELECT value FROM user_preferences WHERE key = ?',
      [config.settingsKey],
    );
    return rows.length > 0 ? (rows[0] as any).value : null;
  }

  // ── 內部輔助方法 ───────────────────────────────────────

  private extractTitle(content: string, relPath: string): string {
    const firstLine = content.split('\n').find((l) => l.startsWith('# '));
    if (firstLine) return firstLine.replace(/^#\s+/, '');
    return path.basename(relPath, '.md');
  }

  private async replacePageBlocks(pageId: string, newBlocks: any[]): Promise<void> {
    // 刪除所有既有 blocks
    const existingBlocks = await notionApi.listBlocks(pageId);
    for (const block of existingBlocks) {
      await notionApi.deleteBlock(block.id);
    }
    // 寫入新 blocks
    if (newBlocks.length > 0) {
      await notionApi.appendBlocks(pageId, newBlocks);
    }
  }

  private async ensureFolderPage(
    scope: DocSyncScope,
    relPath: string,
    rootPageId: string,
  ): Promise<string> {
    // 取得相對於 scope 根目錄的路徑
    const config = SCOPE_CONFIGS.find((c) => c.scope === scope)!;
    const basePath = config.getBasePath();
    const absPath = path.join(PROJECT_ROOT, relPath);
    const relToBase = path.relative(basePath, path.dirname(absPath)).replace(/\\/g, '/');

    if (!relToBase || relToBase === '.') return rootPageId;

    // 逐層建立子頁面
    const parts = relToBase.split('/');
    let currentParent = rootPageId;
    let currentDir = '';

    for (const part of parts) {
      currentDir = currentDir ? `${currentDir}/${part}` : part;
      const fullDir = `${scope}:${currentDir}`;

      // 查詢是否已建立
      const folderRows = database.prepare(
        'SELECT notion_page_id FROM doc_sync_folders WHERE scope = ? AND local_dir = ?',
        [scope, currentDir],
      );
      const folderId = folderRows.length > 0 ? (folderRows[0] as any).notion_page_id : null;

      if (folderId) {
        currentParent = folderId;
        continue;
      }

      // 建立子頁面
      const page = await notionApi.createPageWithContent(currentParent, part, []);
      database.run(
        'INSERT INTO doc_sync_folders (id, scope, local_dir, notion_page_id) VALUES (?, ?, ?, ?)',
        [fullDir, scope, currentDir, page.id],
      );
      currentParent = page.id;
    }

    return currentParent;
  }

  private upsertMapping(
    scope: DocSyncScope,
    localPath: string,
    notionPageId: string,
    localHash: string,
  ): void {
    database.run(
      `INSERT INTO doc_sync_mapping (id, scope, local_path, notion_page_id, local_hash, notion_hash, last_synced_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(local_path) DO UPDATE SET
         notion_page_id = excluded.notion_page_id,
         local_hash = excluded.local_hash,
         notion_hash = excluded.notion_hash,
         last_synced_at = datetime('now'),
         updated_at = datetime('now')`,
      [`${scope}:${localPath}`, scope, localPath, notionPageId, localHash, localHash],
    );
  }

  private updateMappingHashes(id: string, localHash: string, notionHash: string): void {
    database.run(
      `UPDATE doc_sync_mapping SET local_hash = ?, notion_hash = ?, last_synced_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`,
      [localHash, notionHash, id],
    );
  }
}

export const docSyncManager = new DocSyncManager();
