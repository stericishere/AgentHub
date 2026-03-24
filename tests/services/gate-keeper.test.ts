import { gateKeeper } from '../../electron/services/gate-keeper';

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

import { database } from '../../electron/services/database';

const mockDb = database as { run: ReturnType<typeof vi.fn>; prepare: ReturnType<typeof vi.fn> };

describe('GateKeeper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('create', () => {
    it('creates a gate and inserts into database', () => {
      const result = gateKeeper.create({ projectId: 'proj-1', gateType: 'G0' });

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO gates'),
        expect.arrayContaining(['proj-1', null, 'G0']),
      );
      expect(result.projectId).toBe('proj-1');
      expect(result.gateType).toBe('G0');
      expect(result.status).toBe('pending');
      expect(result.id).toBeTruthy();
    });

    it('creates a gate with optional sprintId', () => {
      gateKeeper.create({ projectId: 'proj-1', gateType: 'G2', sprintId: 'sprint-1' });

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO gates'),
        expect.arrayContaining(['proj-1', 'sprint-1', 'G2']),
      );
    });
  });

  describe('submit', () => {
    it('throws if gate is not found', () => {
      mockDb.prepare.mockReturnValueOnce([]);

      expect(() =>
        gateKeeper.submit({ gateId: 'nonexistent', submittedBy: 'agent-1', checklist: [] }),
      ).toThrow('Gate not found: nonexistent');
    });

    it('throws if gate status is not pending or rejected', () => {
      mockDb.prepare.mockReturnValueOnce([{ id: 'g-1', status: 'approved' }]);

      expect(() =>
        gateKeeper.submit({ gateId: 'g-1', submittedBy: 'agent-1', checklist: [] }),
      ).toThrow('cannot be submitted from status: approved');
    });

    it('updates gate status to submitted for a pending gate', () => {
      mockDb.prepare
        .mockReturnValueOnce([{ id: 'g-1', status: 'pending' }])
        .mockReturnValueOnce([
          {
            id: 'g-1',
            project_id: 'proj-1',
            sprint_id: null,
            gate_type: 'G1',
            status: 'submitted',
            submitted_by: 'agent-1',
            reviewer: null,
            checklist: '[]',
            decision: null,
            created_at: '2026-01-01T00:00:00Z',
          },
        ])
        // tryAutoApprove runs after get() — mock consumed by tryAutoApprove is harmless
        ;

      const result = gateKeeper.submit({
        gateId: 'g-1',
        submittedBy: 'agent-1',
        checklist: ['done'],
      });

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining("SET status = 'submitted'"),
        expect.arrayContaining(['agent-1', 'g-1']),
      );
      expect(result.status).toBe('submitted');
    });

    it('allows re-submission from rejected status', () => {
      mockDb.prepare
        .mockReturnValueOnce([{ id: 'g-1', status: 'rejected' }])
        .mockReturnValueOnce([
          {
            id: 'g-1',
            project_id: 'proj-1',
            sprint_id: null,
            gate_type: 'G2',
            status: 'submitted',
            submitted_by: 'agent-2',
            reviewer: null,
            checklist: '["item1"]',
            decision: null,
            created_at: '2026-01-01T00:00:00Z',
          },
        ])
        // tryAutoApprove runs after get() — mock consumed by tryAutoApprove is harmless
        ;

      const result = gateKeeper.submit({
        gateId: 'g-1',
        submittedBy: 'agent-2',
        checklist: ['item1'],
      });

      expect(result.status).toBe('submitted');
    });
  });

  describe('review', () => {
    it('throws if gate is not in submitted status', () => {
      mockDb.prepare.mockReturnValueOnce([{ id: 'g-1', status: 'pending' }]);

      expect(() =>
        gateKeeper.review({ gateId: 'g-1', reviewer: 'tech-lead', decision: 'approved' }),
      ).toThrow('cannot be reviewed from status: pending');
    });

    it('approves a submitted gate', () => {
      const approvedRow = {
        id: 'g-1',
        project_id: 'proj-1',
        sprint_id: null,
        gate_type: 'G3',
        status: 'approved',
        submitted_by: 'agent-1',
        reviewer: 'tech-lead',
        checklist: null,
        decision: 'approved',
        created_at: '2026-01-01T00:00:00Z',
      };
      mockDb.prepare
        .mockReturnValueOnce([{ id: 'g-1', status: 'submitted' }])
        .mockReturnValueOnce([approvedRow]);

      const result = gateKeeper.review({
        gateId: 'g-1',
        reviewer: 'tech-lead',
        decision: 'approved',
      });

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE gates SET status'),
        expect.arrayContaining(['approved', 'tech-lead', 'g-1']),
      );
      expect(result.status).toBe('approved');
    });

    it('rejects a gate', () => {
      const rejectedRow = {
        id: 'g-1',
        project_id: 'proj-1',
        sprint_id: null,
        gate_type: 'G3',
        status: 'rejected',
        submitted_by: 'agent-1',
        reviewer: 'tech-lead',
        checklist: null,
        decision: 'rejected: needs more tests',
        created_at: '2026-01-01T00:00:00Z',
      };
      mockDb.prepare
        .mockReturnValueOnce([{ id: 'g-1', status: 'submitted' }])  // review SELECT
        .mockReturnValueOnce([rejectedRow]);                          // get after review

      const result = gateKeeper.review({
        gateId: 'g-1',
        reviewer: 'tech-lead',
        decision: 'rejected',
        comment: 'needs more tests',
      });

      expect(mockDb.run).toHaveBeenCalledTimes(1);
      expect(result.status).toBe('rejected');
    });
  });

  describe('getChecklists', () => {
    it('returns all 7 gate checklists', () => {
      const checklists = gateKeeper.getChecklists();

      expect(checklists).toHaveLength(7);
      expect(checklists.map((c) => c.gateType)).toEqual(['G0', 'G1', 'G2', 'G3', 'G4', 'G5', 'G6']);
    });

    it('each checklist has label and items', () => {
      const checklists = gateKeeper.getChecklists();

      for (const cl of checklists) {
        expect(cl.label).toBeTruthy();
        expect(Array.isArray(cl.items)).toBe(true);
        expect(cl.items.length).toBeGreaterThan(0);
      }
    });
  });

  describe('list', () => {
    it('returns empty array when no gates exist', () => {
      mockDb.prepare.mockReturnValueOnce([]);
      const result = gateKeeper.list();
      expect(result).toEqual([]);
    });

    it('applies projectId filter in query', () => {
      mockDb.prepare.mockReturnValueOnce([]);
      gateKeeper.list({ projectId: 'proj-1' });

      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('project_id = ?'),
        expect.arrayContaining(['proj-1']),
      );
    });
  });

  describe('9C: autoSubmitNextGate', () => {
    it('returns null when no pending gates exist', () => {
      // list() returns no pending gates
      mockDb.prepare.mockReturnValueOnce([]);

      const result = gateKeeper.autoSubmitNextGate('sprint-1');
      expect(result).toBeNull();
    });

    it('submits the first pending gate sorted by gateType', () => {
      // list({ sprintId }) → returns two pending gates (G2 and G3)
      mockDb.prepare.mockReturnValueOnce([
        {
          id: 'gate-g3',
          project_id: 'proj-1',
          sprint_id: 'sprint-1',
          gate_type: 'G3',
          status: 'pending',
          submitted_by: null,
          reviewer: null,
          checklist: null,
          decision: null,
          created_at: '2026-01-02T00:00:00Z',
        },
        {
          id: 'gate-g2',
          project_id: 'proj-1',
          sprint_id: 'sprint-1',
          gate_type: 'G2',
          status: 'pending',
          submitted_by: null,
          reviewer: null,
          checklist: null,
          decision: null,
          created_at: '2026-01-01T00:00:00Z',
        },
      ]);

      // submit() internally calls:
      // 1. prepare (SELECT gate by id) → pending gate
      mockDb.prepare.mockReturnValueOnce([
        { id: 'gate-g2', status: 'pending', project_id: 'proj-1', sprint_id: 'sprint-1', gate_type: 'G2' },
      ]);
      // 2. Sequence check: sprint gates
      mockDb.prepare.mockReturnValueOnce([]);
      // 3. get() after submit (for return + tryAutoApprove)
      mockDb.prepare.mockReturnValueOnce([
        {
          id: 'gate-g2',
          project_id: 'proj-1',
          sprint_id: 'sprint-1',
          gate_type: 'G2',
          status: 'submitted',
          submitted_by: 'system（自動送審：所有任務已完成）',
          reviewer: null,
          checklist: '{}',
          decision: null,
          created_at: '2026-01-01T00:00:00Z',
        },
      ]);
      // tryAutoApprove → SELECT gate
      mockDb.prepare.mockReturnValueOnce([
        { id: 'gate-g2', gate_type: 'G2', project_id: 'proj-1', status: 'submitted' },
      ]);
      // tryAutoApprove → check rules
      mockDb.prepare.mockReturnValueOnce([]);
      // re-fetch after submit: get(gateId)
      mockDb.prepare.mockReturnValueOnce([
        {
          id: 'gate-g2',
          project_id: 'proj-1',
          sprint_id: 'sprint-1',
          gate_type: 'G2',
          status: 'submitted',
          submitted_by: 'system（自動送審：所有任務已完成）',
          reviewer: null,
          checklist: '{}',
          decision: null,
          created_at: '2026-01-01T00:00:00Z',
        },
      ]);

      const result = gateKeeper.autoSubmitNextGate('sprint-1');
      expect(result).not.toBeNull();
      expect(result!.gateType).toBe('G2');
      expect(result!.status).toBe('submitted');
    });
  });
});
