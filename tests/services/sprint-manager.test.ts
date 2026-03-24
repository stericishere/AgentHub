import { sprintManager } from '../../electron/services/sprint-manager';

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

vi.mock('../../electron/services/task-manager', () => ({
  taskManager: {
    getStatusCounts: vi.fn(() => ({
      created: 0,
      assigned: 0,
      in_progress: 2,
      in_review: 1,
      blocked: 0,
      rejected: 0,
      done: 3,
    })),
    list: vi.fn(() => []),
  },
}));

import { database } from '../../electron/services/database';
import { taskManager } from '../../electron/services/task-manager';

const mockDb = database as { run: ReturnType<typeof vi.fn>; prepare: ReturnType<typeof vi.fn> };
const mockTaskManager = taskManager as {
  getStatusCounts: ReturnType<typeof vi.fn>;
  list: ReturnType<typeof vi.fn>;
};

const makeSprintRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'sprint-1',
  project_id: 'proj-1',
  name: 'Sprint 1',
  goal: 'Ship MVP',
  status: 'planning',
  started_at: null,
  completed_at: null,
  created_at: '2026-01-01T00:00:00Z',
  ...overrides,
});

describe('SprintManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // mockReturnValue 設定預設回傳值，mockReturnValueOnce 可按順序覆蓋個別呼叫
    mockDb.prepare.mockReturnValue([]);
    mockTaskManager.getStatusCounts.mockReturnValue({
      created: 0, assigned: 0, in_progress: 2, in_review: 1,
      blocked: 0, rejected: 0, done: 3,
    });
    mockTaskManager.list.mockReturnValue([]);
  });

  describe('create', () => {
    it('inserts a sprint and returns the record', () => {
      mockDb.prepare.mockReturnValueOnce([makeSprintRow()]);

      const result = sprintManager.create({ projectId: 'proj-1', name: 'Sprint 1', goal: 'Ship MVP' });

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO sprints'),
        expect.arrayContaining(['proj-1', 'Sprint 1', 'Ship MVP']),
      );
      expect(result.name).toBe('Sprint 1');
      expect(result.status).toBe('planning');
    });

    it('creates a sprint without a goal', () => {
      mockDb.prepare.mockReturnValueOnce([makeSprintRow({ goal: null })]);

      sprintManager.create({ projectId: 'proj-1', name: 'Sprint 2' });

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO sprints'),
        expect.arrayContaining([null]),
      );
    });
  });

  describe('start', () => {
    it('throws if sprint is not found', () => {
      mockDb.prepare.mockReturnValueOnce([]);

      expect(() => sprintManager.start('nonexistent')).toThrow('Sprint not found: nonexistent');
    });

    it('throws if sprint is not in planning status', () => {
      mockDb.prepare.mockReturnValueOnce([makeSprintRow({ status: 'active' })]);

      expect(() => sprintManager.start('sprint-1')).toThrow('Invalid sprint transition: active → active');
    });

    it('throws if project already has an active sprint', () => {
      mockDb.prepare
        .mockReturnValueOnce([makeSprintRow({ status: 'planning' })])   // getById
        .mockReturnValueOnce([makeSprintRow({ id: 'sprint-0', status: 'active' })]); // getActiveSprint

      expect(() => sprintManager.start('sprint-1')).toThrow('Project already has an active sprint');
    });

    it('starts a planning sprint when no active sprint exists', () => {
      mockDb.prepare
        .mockReturnValueOnce([makeSprintRow({ status: 'planning' })])   // getById
        .mockReturnValueOnce([])                                         // getActiveSprint - none
        .mockReturnValueOnce([makeSprintRow({ status: 'active' })]);    // getById after update

      const result = sprintManager.start('sprint-1');

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining("SET status = 'active'"),
        expect.arrayContaining(['sprint-1']),
      );
      expect(result.status).toBe('active');
    });
  });

  describe('enterReview', () => {
    it('transitions active sprint to review', () => {
      mockDb.prepare
        .mockReturnValueOnce([makeSprintRow({ status: 'active' })])
        .mockReturnValueOnce([makeSprintRow({ status: 'review' })]);

      const result = sprintManager.enterReview('sprint-1');

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining("SET status = 'review'"),
        ['sprint-1'],
      );
      expect(result.status).toBe('review');
    });

    it('throws for invalid transition from planning to review', () => {
      mockDb.prepare.mockReturnValueOnce([makeSprintRow({ status: 'planning' })]);

      expect(() => sprintManager.enterReview('sprint-1')).toThrow(
        'Invalid sprint transition: planning → review',
      );
    });
  });

  describe('complete', () => {
    it('completes a sprint in review status', () => {
      mockDb.prepare
        .mockReturnValueOnce([makeSprintRow({ status: 'review' })])
        .mockReturnValueOnce([makeSprintRow({ status: 'completed' })]);

      const result = sprintManager.complete('sprint-1');

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining("SET status = 'completed'"),
        expect.arrayContaining(['sprint-1']),
      );
      expect(result.status).toBe('completed');
    });
  });

  describe('getStatus', () => {
    it('returns sprint status with task counts and progress percentage', () => {
      mockDb.prepare
        .mockReturnValueOnce([makeSprintRow({ status: 'active' })]);

      const status = sprintManager.getStatus('sprint-1');

      expect(status.sprint.id).toBe('sprint-1');
      expect(status.totalTasks).toBe(6); // 2 + 1 + 3
      expect(status.completedTasks).toBe(3);
      expect(status.progressPct).toBe(50);
    });

    it('returns 0% progress when there are no tasks', () => {
      mockTaskManager.getStatusCounts.mockReturnValueOnce({
        created: 0, assigned: 0, in_progress: 0, in_review: 0,
        blocked: 0, rejected: 0, done: 0,
      });

      // getStatus → getById：回傳一筆 active sprint
      mockDb.prepare.mockReturnValueOnce([makeSprintRow({ status: 'active' })]);

      const status = sprintManager.getStatus('sprint-1');

      expect(status.totalTasks).toBe(0);
      expect(status.progressPct).toBe(0);
    });

    it('throws when sprint is not found', () => {
      // beforeEach 已設 mockReturnValue([])，getById 會回傳 null → 拋出錯誤
      expect(() => sprintManager.getStatus('nonexistent')).toThrow('Sprint not found: nonexistent');
    });
  });
});
