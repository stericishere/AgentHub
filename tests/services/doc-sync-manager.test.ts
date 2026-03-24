import { docSyncManager } from '../../electron/services/doc-sync-manager';

vi.mock('../../electron/services/database', () => ({
  database: {
    run: vi.fn(),
    prepare: vi.fn(() => []),
  },
}));

vi.mock('../../electron/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../electron/services/notion-api', () => ({
  notionApi: {
    listBlocks: vi.fn().mockResolvedValue([]),
    appendBlocks: vi.fn().mockResolvedValue(undefined),
    deleteBlock: vi.fn().mockResolvedValue(undefined),
    createPageWithContent: vi.fn().mockResolvedValue({ id: 'new-page-id' }),
    archivePage: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../electron/services/markdown-notion', () => ({
  markdownToBlocks: vi.fn().mockReturnValue([]),
  blocksToMarkdown: vi.fn().mockReturnValue('# Test\n'),
  contentHash: vi.fn().mockReturnValue('abc123'),
}));

import { database } from '../../electron/services/database';
import { notionApi } from '../../electron/services/notion-api';

const mockDb = database as {
  run: ReturnType<typeof vi.fn>;
  prepare: ReturnType<typeof vi.fn>;
};

const mockNotionApi = notionApi as {
  listBlocks: ReturnType<typeof vi.fn>;
  appendBlocks: ReturnType<typeof vi.fn>;
  deleteBlock: ReturnType<typeof vi.fn>;
  createPageWithContent: ReturnType<typeof vi.fn>;
  archivePage: ReturnType<typeof vi.fn>;
};

describe('DocSyncManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.prepare.mockImplementation(() => []);
  });

  describe('discoverFiles', () => {
    it('returns empty array for unknown scope', () => {
      const files = docSyncManager.discoverFiles('unknown' as any);
      expect(files).toEqual([]);
    });

    it('returns empty array when directory does not exist', () => {
      const files = docSyncManager.discoverFiles('project', 'C:/nonexistent/path');
      expect(files).toEqual([]);
    });

    it('discovers knowledge files', () => {
      const files = docSyncManager.discoverFiles('knowledge');
      // 應有實際知識庫檔案（取決於專案是否存在）
      expect(Array.isArray(files)).toBe(true);
      files.forEach((f: string) => expect(f.endsWith('.md')).toBe(true));
    });

    it('discovers docs files', () => {
      const files = docSyncManager.discoverFiles('docs');
      expect(Array.isArray(files)).toBe(true);
      files.forEach((f: string) => expect(f.endsWith('.md')).toBe(true));
    });
  });

  describe('getStatus', () => {
    it('returns status with correct scope', () => {
      const status = docSyncManager.getStatus('knowledge');
      expect(status.scope).toBe('knowledge');
      expect(status.label).toBe('知識庫');
      expect(typeof status.totalFiles).toBe('number');
      expect(typeof status.synced).toBe('number');
      expect(typeof status.pendingPush).toBe('number');
    });

    it('returns docs status', () => {
      const status = docSyncManager.getStatus('docs');
      expect(status.scope).toBe('docs');
      expect(status.label).toBe('專案文件');
    });
  });

  describe('getMappings', () => {
    it('returns empty array when no mappings exist', () => {
      const mappings = docSyncManager.getMappings('knowledge');
      expect(mappings).toEqual([]);
    });

    it('queries correct scope', () => {
      docSyncManager.getMappings('docs');
      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('FROM doc_sync_mapping'),
        ['docs'],
      );
    });
  });

  describe('setRootPageId / getRootPageId', () => {
    it('saves root page ID to user_preferences', () => {
      docSyncManager.setRootPageId('knowledge', 'page-123');
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('user_preferences'),
        expect.arrayContaining(['docSync.knowledge.rootPageId', 'page-123']),
      );
    });

    it('returns null when no root page is set', () => {
      const result = docSyncManager.getRootPageId('knowledge');
      expect(result).toBeNull();
    });
  });

  describe('push', () => {
    it('fails when no root page is set', async () => {
      const result = await docSyncManager.push({ scope: 'knowledge' });
      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('尚未設定 Notion 根頁面 ID');
    });
  });

  describe('pull', () => {
    it('returns zero pulled when no mappings exist', async () => {
      const result = await docSyncManager.pull({ scope: 'knowledge' });
      expect(result.pulled).toBe(0);
      expect(result.success).toBe(true);
    });
  });

  describe('syncAll', () => {
    it('combines push and pull results', async () => {
      const result = await docSyncManager.syncAll({ scope: 'knowledge' });
      // Push will fail (no root page), pull will succeed with 0
      expect(result.success).toBe(false);
      expect(result.pushed).toBe(0);
      expect(result.pulled).toBe(0);
    });
  });
});
