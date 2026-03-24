import { syncManager, TABLE_MAPPINGS } from '../../electron/services/sync-manager';

vi.mock('../../electron/services/database', () => ({
  database: {
    run: vi.fn(),
    prepare: vi.fn(() => []),
    get: vi.fn(),
  },
}));

vi.mock('../../electron/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../electron/services/notion-api', () => ({
  notionApi: {
    initialize: vi.fn(),
    getUser: vi.fn().mockResolvedValue({
      botId: 'bot-1',
      workspaceId: 'ws-1',
      workspaceName: 'Test Workspace',
      workspaceIcon: null,
    }),
    createDatabase: vi.fn().mockResolvedValue({ id: 'notion-db-id' }),
    createPage: vi.fn().mockResolvedValue({ id: 'notion-page-new' }),
    updatePage: vi.fn().mockResolvedValue(undefined),
    archivePage: vi.fn().mockResolvedValue(undefined),
    queryDatabase: vi.fn().mockResolvedValue([]),
    disconnect: vi.fn(),
  },
}));

vi.mock('electron', () => {
  const win = {
    loadURL: vi.fn(),
    on: vi.fn(),
    close: vi.fn(),
    isDestroyed: vi.fn().mockReturnValue(false),
    webContents: { send: vi.fn() },
  };
  return {
    BrowserWindow: Object.assign(
      vi.fn().mockImplementation(() => win),
      { getAllWindows: vi.fn().mockReturnValue([win]) },
    ),
    safeStorage: {
      isEncryptionAvailable: vi.fn().mockReturnValue(false),
      encryptString: vi.fn(),
      decryptString: vi.fn(),
    },
  };
});

import { database } from '../../electron/services/database';
import { notionApi } from '../../electron/services/notion-api';

const mockDb = database as {
  run: ReturnType<typeof vi.fn>;
  prepare: ReturnType<typeof vi.fn>;
};

const mockNotionApi = notionApi as {
  initialize: ReturnType<typeof vi.fn>;
  getUser: ReturnType<typeof vi.fn>;
  createDatabase: ReturnType<typeof vi.fn>;
  createPage: ReturnType<typeof vi.fn>;
  updatePage: ReturnType<typeof vi.fn>;
  archivePage: ReturnType<typeof vi.fn>;
  queryDatabase: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
};

describe('SyncManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-establish defaults after clearAllMocks
    mockDb.prepare.mockImplementation(() => []);
    mockNotionApi.createPage.mockResolvedValue({ id: 'notion-page-new' });
    mockNotionApi.updatePage.mockResolvedValue(undefined);
    mockNotionApi.archivePage.mockResolvedValue(undefined);
    mockNotionApi.queryDatabase.mockResolvedValue([]);
    mockNotionApi.getUser.mockResolvedValue({
      botId: 'bot-1',
      workspaceId: 'ws-1',
      workspaceName: 'Test Workspace',
      workspaceIcon: null,
    });
    mockNotionApi.createDatabase.mockResolvedValue({ id: 'notion-db-id' });
  });

  // Helper: install a persistent mock that returns valid connection data
  // whenever getConnection-related queries are issued, while returning []
  // for all other prepare calls. Uses mockImplementation so interleaved
  // calls (getNotionDatabaseId, etc.) don't consume queued values.
  function mockConnectedState() {
    mockDb.prepare.mockImplementation((sql: string) => {
      if (typeof sql === 'string' && sql.includes('notion_connection')) {
        return [
          {
            workspace_id: 'ws-1',
            workspace_name: 'WS',
            workspace_icon: null,
            bot_id: 'bot-1',
            parent_page_id: 'page-1',
            connected_at: '2026-01-01',
          },
        ];
      }
      if (typeof sql === 'string' && sql.includes('user_preferences')) {
        return [{ value: 'plain:token' }];
      }
      return [];
    });
  }

  // Helper: queue a single getConnection (for tests that need explicit ordering)
  function mockValidConnection() {
    mockDb.prepare
      .mockReturnValueOnce([
        {
          workspace_id: 'ws-1',
          workspace_name: 'WS',
          workspace_icon: null,
          bot_id: 'bot-1',
          parent_page_id: 'page-1',
          connected_at: '2026-01-01',
        },
      ])
      .mockReturnValueOnce([{ value: 'plain:token' }]);
  }

  describe('TABLE_MAPPINGS', () => {
    it('contains 18 table mappings', () => {
      expect(TABLE_MAPPINGS).toHaveLength(18);
    });

    it('every mapping has a title property', () => {
      for (const mapping of TABLE_MAPPINGS) {
        const hasTitle = mapping.properties.some((p) => p.isTitle);
        expect(hasTitle).toBe(true);
      }
    });

    it('every mapping has unique tableName', () => {
      const names = TABLE_MAPPINGS.map((m) => m.tableName);
      expect(new Set(names).size).toBe(names.length);
    });
  });

  describe('getConnection', () => {
    it('returns null when no connection exists', () => {
      const result = syncManager.getConnection();
      expect(result).toBeNull();
    });

    it('returns null when no token stored', () => {
      mockDb.prepare
        .mockReturnValueOnce([
          {
            workspace_id: 'ws-1',
            workspace_name: 'WS',
            workspace_icon: null,
            bot_id: 'bot-1',
            parent_page_id: 'page-1',
            connected_at: '2026-01-01',
          },
        ]);
      // second call → default [] (no token)
      const result = syncManager.getConnection();
      expect(result).toBeNull();
    });

    it('returns connection with decrypted token', () => {
      mockDb.prepare
        .mockReturnValueOnce([
          {
            workspace_id: 'ws-1',
            workspace_name: 'WS',
            workspace_icon: null,
            bot_id: 'bot-1',
            parent_page_id: 'page-1',
            connected_at: '2026-01-01',
          },
        ])
        .mockReturnValueOnce([{ value: 'plain:ntn_test_token_123' }]);

      const result = syncManager.getConnection();
      expect(result).not.toBeNull();
      expect(result!.workspaceId).toBe('ws-1');
      expect(result!.accessToken).toBe('ntn_test_token_123');
      expect(result!.parentPageId).toBe('page-1');
    });
  });

  describe('disconnect', () => {
    it('clears token, connection, and databases', () => {
      syncManager.disconnect();
      expect(mockDb.run).toHaveBeenCalledWith(
        'DELETE FROM user_preferences WHERE key = ?',
        ['notion_token'],
      );
      expect(mockDb.run).toHaveBeenCalledWith('DELETE FROM notion_connection WHERE id = 1');
      expect(mockDb.run).toHaveBeenCalledWith('DELETE FROM notion_databases');
      expect(mockNotionApi.disconnect).toHaveBeenCalled();
    });
  });

  describe('verifyConnection', () => {
    it('returns invalid when no connection', async () => {
      const result = await syncManager.verifyConnection();
      expect(result.valid).toBe(false);
    });

    it('returns valid when API call succeeds', async () => {
      mockValidConnection();
      const result = await syncManager.verifyConnection();
      expect(result.valid).toBe(true);
      expect(mockNotionApi.initialize).toHaveBeenCalledWith('token');
      expect(mockNotionApi.getUser).toHaveBeenCalled();
    });

    it('returns invalid when API call fails', async () => {
      mockValidConnection();
      mockNotionApi.getUser.mockRejectedValueOnce(new Error('Unauthorized'));
      const result = await syncManager.verifyConnection();
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Unauthorized');
    });
  });

  describe('setParentPageId', () => {
    it('updates database with page ID', () => {
      syncManager.setParentPageId('page-abc');
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE notion_connection SET parent_page_id'),
        ['page-abc'],
      );
    });
  });

  describe('initializeDatabases', () => {
    it('returns error when not connected', async () => {
      const result = await syncManager.initializeDatabases();
      expect(result.success).toBe(false);
      expect(result.error).toContain('尚未連結');
    });

    it('returns error when no parent page set', async () => {
      mockDb.prepare
        .mockReturnValueOnce([
          {
            workspace_id: 'ws-1',
            workspace_name: 'WS',
            workspace_icon: null,
            bot_id: 'bot-1',
            parent_page_id: '',
            connected_at: '2026-01-01',
          },
        ])
        .mockReturnValueOnce([{ value: 'plain:token' }]);

      const result = await syncManager.initializeDatabases();
      expect(result.success).toBe(false);
      expect(result.error).toContain('父頁面');
    });

    it('creates all 18 databases when none exist', async () => {
      mockValidConnection();
      // All tables: no existing DB → default [] handles this
      const result = await syncManager.initializeDatabases();
      expect(result.success).toBe(true);
      expect(result.created).toBe(18);
      expect(mockNotionApi.createDatabase).toHaveBeenCalledTimes(18);
    });

    it('skips already initialized databases', async () => {
      mockValidConnection();
      // First table: already exists
      mockDb.prepare.mockReturnValueOnce([{ notion_database_id: 'existing-id' }]);
      // Rest: default [] (not exist)

      const result = await syncManager.initializeDatabases();
      expect(result.success).toBe(true);
      expect(result.created).toBe(18);
      expect(mockNotionApi.createDatabase).toHaveBeenCalledTimes(17);
    });
  });

  describe('getDatabaseStatus', () => {
    it('returns missing status for uninitialized databases', () => {
      // For each table: no DB row → default [], count rows → need to mock
      for (let i = 0; i < TABLE_MAPPINGS.length; i++) {
        mockDb.prepare
          .mockReturnValueOnce([]) // no notion_databases row
          .mockReturnValueOnce([{ cnt: 5 }]); // count rows
      }

      const statuses = syncManager.getDatabaseStatus();
      expect(statuses).toHaveLength(18);
      expect(statuses[0].status).toBe('missing');
      expect(statuses[0].notionDatabaseId).toBeNull();
      expect(statuses[0].localRowCount).toBe(5);
    });

    it('returns ok status for initialized databases', () => {
      for (let i = 0; i < TABLE_MAPPINGS.length; i++) {
        mockDb.prepare
          .mockReturnValueOnce([
            {
              notion_database_id: `db-${i}`,
              last_synced_at: '2026-03-01',
              status: 'active',
            },
          ])
          .mockReturnValueOnce([{ cnt: 10 }]);
      }

      const statuses = syncManager.getDatabaseStatus();
      expect(statuses[0].status).toBe('ok');
      expect(statuses[0].notionDatabaseId).toBe('db-0');
      expect(statuses[0].localRowCount).toBe(10);
    });
  });

  describe('getStatus', () => {
    it('returns disconnected status when no connection', () => {
      const status = syncManager.getStatus();
      expect(status.connection).toBe('disconnected');
      expect(status.workspaceName).toBeNull();
      expect(status.databases).toEqual([]);
    });

    it('returns connected status with counts', () => {
      mockDb.prepare
        .mockReturnValueOnce([
          {
            workspace_id: 'ws-1',
            workspace_name: 'My WS',
            workspace_icon: null,
            bot_id: 'bot-1',
            parent_page_id: 'page-1',
            connected_at: '2026-01-01',
          },
        ])
        .mockReturnValueOnce([{ value: 'plain:token' }])
        .mockReturnValueOnce([{ cnt: 3 }]) // pending push
        .mockReturnValueOnce([{ completed_at: '2026-03-01T10:00:00Z' }]); // last sync

      // getDatabaseStatus: 18 tables x 2 queries
      for (let i = 0; i < TABLE_MAPPINGS.length; i++) {
        mockDb.prepare
          .mockReturnValueOnce([])
          .mockReturnValueOnce([{ cnt: 0 }]);
      }

      const status = syncManager.getStatus();
      expect(status.connection).toBe('connected');
      expect(status.workspaceName).toBe('My WS');
      expect(status.pendingPush).toBe(3);
      expect(status.lastSyncAt).toBe('2026-03-01T10:00:00Z');
      expect(status.databases).toHaveLength(18);
    });
  });

  // ---- 6C-2 新增測試 ------------------------------------------

  describe('sqliteToNotionProperties', () => {
    const projectMapping = TABLE_MAPPINGS.find((m) => m.tableName === 'projects')!;

    it('converts title field', () => {
      const props = syncManager.sqliteToNotionProperties({ name: 'Test Project' }, projectMapping);
      expect(props['名稱']).toEqual({
        title: [{ text: { content: 'Test Project' } }],
      });
    });

    it('converts rich_text field', () => {
      const props = syncManager.sqliteToNotionProperties({ description: 'A test' }, projectMapping);
      expect(props['描述']).toEqual({
        rich_text: [{ text: { content: 'A test' } }],
      });
    });

    it('converts number field', () => {
      const taskMapping = TABLE_MAPPINGS.find((m) => m.tableName === 'tasks')!;
      const props = syncManager.sqliteToNotionProperties({ estimated_hours: 8 }, taskMapping);
      expect(props['預估工時']).toEqual({ number: 8 });
    });

    it('converts select field', () => {
      const props = syncManager.sqliteToNotionProperties({ status: 'active' }, projectMapping);
      expect(props['狀態']).toEqual({ select: { name: 'active' } });
    });

    it('converts date field', () => {
      const props = syncManager.sqliteToNotionProperties(
        { created_at: '2026-03-01T10:00:00Z' },
        projectMapping,
      );
      expect(props['建立時間']).toEqual({ date: { start: '2026-03-01T10:00:00Z' } });
    });

    it('converts checkbox field', () => {
      const failMapping = TABLE_MAPPINGS.find((m) => m.tableName === 'execution_failures')!;
      const props = syncManager.sqliteToNotionProperties({ resolved: 1 }, failMapping);
      expect(props['已解決']).toEqual({ checkbox: true });
    });

    it('skips null values', () => {
      const props = syncManager.sqliteToNotionProperties(
        { name: 'X', description: null },
        projectMapping,
      );
      expect(props['描述']).toBeUndefined();
    });

    it('truncates rich_text to 2000 chars', () => {
      const props = syncManager.sqliteToNotionProperties(
        { description: 'A'.repeat(3000) },
        projectMapping,
      );
      expect(props['描述'].rich_text[0].text.content).toHaveLength(2000);
    });
  });

  describe('notionToSqliteRow', () => {
    const projectMapping = TABLE_MAPPINGS.find((m) => m.tableName === 'projects')!;

    it('converts title to string', () => {
      const row = syncManager.notionToSqliteRow(
        { properties: { '名稱': { title: [{ plain_text: 'My Project' }] } } },
        projectMapping,
      );
      expect(row.name).toBe('My Project');
    });

    it('converts rich_text to string', () => {
      const row = syncManager.notionToSqliteRow(
        { properties: { 'ID': { rich_text: [{ plain_text: 'proj-123' }] } } },
        projectMapping,
      );
      expect(row.id).toBe('proj-123');
    });

    it('converts number', () => {
      const taskMapping = TABLE_MAPPINGS.find((m) => m.tableName === 'tasks')!;
      const row = syncManager.notionToSqliteRow(
        { properties: { '預估工時': { number: 5 } } },
        taskMapping,
      );
      expect(row.estimated_hours).toBe(5);
    });

    it('converts checkbox true to 1', () => {
      const failMapping = TABLE_MAPPINGS.find((m) => m.tableName === 'execution_failures')!;
      const row = syncManager.notionToSqliteRow(
        { properties: { '已解決': { checkbox: true } } },
        failMapping,
      );
      expect(row.resolved).toBe(1);
    });

    it('converts checkbox false to 0', () => {
      const failMapping = TABLE_MAPPINGS.find((m) => m.tableName === 'execution_failures')!;
      const row = syncManager.notionToSqliteRow(
        { properties: { '已解決': { checkbox: false } } },
        failMapping,
      );
      expect(row.resolved).toBe(0);
    });

    it('returns null for missing properties', () => {
      const row = syncManager.notionToSqliteRow({ properties: {} }, projectMapping);
      expect(row.name).toBeNull();
      expect(row.description).toBeNull();
    });
  });

  describe('getLocalId', () => {
    it('returns id for regular tables', () => {
      expect(syncManager.getLocalId({ id: 'task-1' }, 'tasks')).toBe('task-1');
    });

    it('returns composite key for task_dependencies', () => {
      expect(
        syncManager.getLocalId({ task_id: 't-1', depends_on: 't-2' }, 'task_dependencies'),
      ).toBe('t-1::t-2');
    });
  });

  describe('push', () => {
    it('returns error when not connected', async () => {
      const result = await syncManager.push();
      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('尚未連結');
    });

    it('creates new pages for unmapped rows', async () => {
      mockValidConnection();
      // projects: has DB
      mockDb.prepare.mockReturnValueOnce([{ notion_database_id: 'ndb-1' }]);
      // projects: local rows
      mockDb.prepare.mockReturnValueOnce([
        { id: 'p-1', name: 'Project A', status: 'active', created_at: '2026-01-01' },
      ]);
      // projects: sync_mapping empty
      mockDb.prepare.mockReturnValueOnce([]);
      // remaining tables: default [] → skip

      const result = await syncManager.push();
      expect(result.pushed).toBeGreaterThanOrEqual(1);
      expect(mockNotionApi.createPage).toHaveBeenCalledWith('ndb-1', expect.any(Object));
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO sync_mapping'),
        expect.arrayContaining(['projects', 'p-1', 'notion-page-new']),
      );
    });

    it('updates existing mapped pages', async () => {
      mockValidConnection();
      mockDb.prepare.mockReturnValueOnce([{ notion_database_id: 'ndb-1' }]);
      mockDb.prepare.mockReturnValueOnce([
        { id: 'p-1', name: 'Updated Project', status: 'active' },
      ]);
      mockDb.prepare.mockReturnValueOnce([
        { local_id: 'p-1', notion_page_id: 'notion-page-existing' },
      ]);

      const result = await syncManager.push();
      expect(result.pushed).toBeGreaterThanOrEqual(1);
      expect(mockNotionApi.updatePage).toHaveBeenCalledWith(
        'notion-page-existing',
        expect.any(Object),
      );
    });

    it('archives deleted rows', async () => {
      mockValidConnection();
      mockDb.prepare.mockReturnValueOnce([{ notion_database_id: 'ndb-1' }]);
      // local rows: empty (all deleted)
      mockDb.prepare.mockReturnValueOnce([]);
      // sync_mapping: one orphan
      mockDb.prepare.mockReturnValueOnce([
        { local_id: 'p-deleted', notion_page_id: 'notion-page-del' },
      ]);

      const result = await syncManager.push();
      expect(result.pushed).toBeGreaterThanOrEqual(1);
      expect(mockNotionApi.archivePage).toHaveBeenCalledWith('notion-page-del');
    });

    it('handles partial failures gracefully', async () => {
      mockValidConnection();
      mockDb.prepare.mockReturnValueOnce([{ notion_database_id: 'ndb-1' }]);
      mockDb.prepare.mockReturnValueOnce([
        { id: 'p-1', name: 'OK' },
        { id: 'p-2', name: 'Fail' },
      ]);
      mockDb.prepare.mockReturnValueOnce([]); // no sync_mapping

      mockNotionApi.createPage
        .mockResolvedValueOnce({ id: 'np-1' })
        .mockRejectedValueOnce(new Error('Rate limited'));

      const result = await syncManager.push();
      expect(result.success).toBe(false);
      expect(result.pushed).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Rate limited');
    });
  });

  describe('pull', () => {
    it('returns error when not connected', async () => {
      const result = await syncManager.pull();
      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('尚未連結');
    });

    it('inserts new pages into local DB', async () => {
      mockValidConnection();
      mockDb.prepare.mockReturnValueOnce([{ notion_database_id: 'ndb-1' }]);

      mockNotionApi.queryDatabase.mockResolvedValueOnce([
        {
          id: 'notion-page-x',
          archived: false,
          last_edited_time: '2026-03-04T12:00:00Z',
          properties: {
            '名稱': { title: [{ plain_text: 'Cloud Project' }] },
            'ID': { rich_text: [{ plain_text: 'p-cloud' }] },
            '狀態': { select: { name: 'active' } },
          },
        },
      ]);

      // sync_mapping: empty (new page) → default []

      const result = await syncManager.pull();
      expect(result.pulled).toBeGreaterThanOrEqual(1);
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO projects'),
        expect.any(Array),
      );
    });

    it('updates existing local rows', async () => {
      mockValidConnection();
      mockDb.prepare.mockReturnValueOnce([{ notion_database_id: 'ndb-1' }]);

      mockNotionApi.queryDatabase.mockResolvedValueOnce([
        {
          id: 'notion-page-existing',
          archived: false,
          last_edited_time: '2026-03-04T12:00:00Z',
          properties: {
            '名稱': { title: [{ plain_text: 'Updated Name' }] },
            'ID': { rich_text: [{ plain_text: 'p-1' }] },
          },
        },
      ]);

      // sync_mapping: already mapped
      mockDb.prepare.mockReturnValueOnce([
        { local_id: 'p-1', notion_page_id: 'notion-page-existing' },
      ]);

      const result = await syncManager.pull();
      expect(result.pulled).toBeGreaterThanOrEqual(1);
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE projects SET'),
        expect.any(Array),
      );
    });

    it('deletes local rows for archived Notion pages', async () => {
      mockValidConnection();
      mockDb.prepare.mockReturnValueOnce([{ notion_database_id: 'ndb-1' }]);

      // queryDatabase returns empty (all pages archived/deleted)
      mockNotionApi.queryDatabase.mockResolvedValueOnce([]);

      // sync_mapping has an orphan
      mockDb.prepare.mockReturnValueOnce([
        { local_id: 'p-old', notion_page_id: 'notion-page-archived' },
      ]);

      const result = await syncManager.pull();
      expect(result.pulled).toBeGreaterThanOrEqual(1);
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM projects WHERE id = ?'),
        ['p-old'],
      );
    });

    it('skips cost_tracker table', async () => {
      mockValidConnection();
      // All tables use default [] → no notion DB → skip
      const result = await syncManager.pull();
      expect(result.errors).toHaveLength(0);
      // queryDatabase should not be called for cost_tracker
      expect(mockNotionApi.queryDatabase).not.toHaveBeenCalled();
    });
  });

  describe('syncAll', () => {
    it('returns error when not connected', async () => {
      const result = await syncManager.syncAll();
      expect(result.success).toBe(false);
      expect(result.errors).toContain('尚未連結 Notion');
    });

    it('runs push then pull and merges results', async () => {
      // Use persistent connected state so syncAll + push + pull all get valid connection
      mockConnectedState();

      const result = await syncManager.syncAll();
      expect(result.pushed).toBe(0);
      expect(result.pulled).toBe(0);
      expect(result.errors).toHaveLength(0);
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining("'full'"),
        expect.arrayContaining(['completed']),
      );
    });

    it('merges errors from push and pull', async () => {
      // Use persistent connected state + notion DB IDs + local rows for projects
      mockDb.prepare.mockImplementation((sql: string) => {
        if (typeof sql === 'string' && sql.includes('notion_connection')) {
          return [
            {
              workspace_id: 'ws-1',
              workspace_name: 'WS',
              workspace_icon: null,
              bot_id: 'bot-1',
              parent_page_id: 'page-1',
              connected_at: '2026-01-01',
            },
          ];
        }
        if (typeof sql === 'string' && sql.includes('user_preferences')) {
          return [{ value: 'plain:token' }];
        }
        if (typeof sql === 'string' && sql.includes('notion_databases')) {
          return [{ notion_database_id: 'ndb-1' }];
        }
        // Return local rows for first table (projects) to trigger createPage
        if (typeof sql === 'string' && sql.includes('SELECT * FROM') && sql.includes('projects')) {
          return [{ id: 'p-1', name: 'Test' }];
        }
        return [];
      });
      mockNotionApi.createPage.mockRejectedValueOnce(new Error('Push error'));
      mockNotionApi.queryDatabase.mockRejectedValueOnce(new Error('Pull error'));

      const result = await syncManager.syncAll();
      expect(result.success).toBe(false);
      expect(result.errors.some((e) => e.includes('Push error'))).toBe(true);
      expect(result.errors.some((e) => e.includes('Pull error'))).toBe(true);
    });

    it('writes sync_log with full type', async () => {
      mockConnectedState();

      await syncManager.syncAll();

      const syncLogCalls = mockDb.run.mock.calls.filter(
        (call: unknown[]) => typeof call[0] === 'string' && (call[0] as string).includes("'full'"),
      );
      expect(syncLogCalls.length).toBe(1);
    });
  });
});
