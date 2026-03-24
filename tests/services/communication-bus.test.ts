import { communicationBus } from '../../electron/services/communication-bus';

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

vi.mock('../../electron/services/agent-loader', () => ({
  agentLoader: {
    getById: vi.fn((id: string) => {
      if (id === 'tech-lead') return { id: 'tech-lead', level: 'L1' };
      if (id === 'frontend-engineer') return { id: 'frontend-engineer', level: 'L2' };
      if (id === 'backend-engineer') return { id: 'backend-engineer', level: 'L2' };
      if (id === 'product-manager') return { id: 'product-manager', level: 'L1' };
      return null;
    }),
  },
}));

import { database } from '../../electron/services/database';

const mockDb = database as { run: ReturnType<typeof vi.fn>; prepare: ReturnType<typeof vi.fn> };

const makeMessageRow = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  project_id: 'proj-1',
  task_id: null,
  from_agent: 'boss',
  to_agent: 'tech-lead',
  message_type: 'command',
  content: 'Start the sprint',
  metadata: null,
  created_at: '2026-01-01T00:00:00Z',
  ...overrides,
});

describe('CommunicationBus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('send', () => {
    it('boss sends command to L1 agent', () => {
      mockDb.prepare.mockReturnValueOnce([makeMessageRow()]);

      const result = communicationBus.send({
        fromAgent: 'boss',
        toAgent: 'tech-lead',
        messageType: 'command',
        content: 'Start the sprint',
        projectId: 'proj-1',
      });

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO messages'),
        expect.arrayContaining(['boss', 'tech-lead', 'command', 'Start the sprint']),
      );
      expect(result.fromAgent).toBe('boss');
      expect(result.messageType).toBe('command');
    });

    it('throws when boss sends invalid message type to L1', () => {
      expect(() =>
        communicationBus.send({
          fromAgent: 'boss',
          toAgent: 'tech-lead',
          messageType: 'report',
          content: 'some report',
        }),
      ).toThrow('Boss can only send command/notify to L1');
    });

    it('L1 can send report to boss', () => {
      mockDb.prepare.mockReturnValueOnce([
        makeMessageRow({ from_agent: 'tech-lead', to_agent: 'boss', message_type: 'report' }),
      ]);

      const result = communicationBus.send({
        fromAgent: 'tech-lead',
        toAgent: 'boss',
        messageType: 'report',
        content: 'Sprint completed',
      });

      expect(result.messageType).toBe('report');
    });

    it('throws when L1 sends invalid message type to boss', () => {
      expect(() =>
        communicationBus.send({
          fromAgent: 'tech-lead',
          toAgent: 'boss',
          messageType: 'command',
          content: 'bad message',
        }),
      ).toThrow('L1 can only send report/proposal/objection to Boss');
    });

    it('L2 can send report to L1', () => {
      mockDb.prepare.mockReturnValueOnce([
        makeMessageRow({
          from_agent: 'frontend-engineer',
          to_agent: 'tech-lead',
          message_type: 'report',
        }),
      ]);

      const result = communicationBus.send({
        fromAgent: 'frontend-engineer',
        toAgent: 'tech-lead',
        messageType: 'report',
        content: 'Feature done',
      });

      expect(result.fromAgent).toBe('frontend-engineer');
    });

    it('same-level agents can coordinate', () => {
      mockDb.prepare.mockReturnValueOnce([
        makeMessageRow({
          from_agent: 'frontend-engineer',
          to_agent: 'backend-engineer',
          message_type: 'coordinate',
        }),
      ]);

      const result = communicationBus.send({
        fromAgent: 'frontend-engineer',
        toAgent: 'backend-engineer',
        messageType: 'coordinate',
        content: 'Aligning on API contract',
      });

      expect(result.messageType).toBe('coordinate');
    });

    it('creates an objection record when messageType is objection', () => {
      mockDb.prepare.mockReturnValueOnce([
        makeMessageRow({
          from_agent: 'frontend-engineer',
          to_agent: 'tech-lead',
          message_type: 'objection',
        }),
      ]);

      communicationBus.send({
        fromAgent: 'frontend-engineer',
        toAgent: 'tech-lead',
        messageType: 'objection',
        content: 'I disagree with this approach',
      });

      // Once for the message INSERT, once for the objection INSERT
      expect(mockDb.run).toHaveBeenCalledTimes(2);
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO objections'),
        expect.any(Array),
      );
    });
  });

  describe('getMessages', () => {
    it('returns empty array when no messages exist', () => {
      mockDb.prepare.mockReturnValueOnce([]);
      const result = communicationBus.getMessages({ projectId: 'proj-1' });
      expect(result).toEqual([]);
    });

    it('applies agentId filter for both from and to fields', () => {
      mockDb.prepare.mockReturnValueOnce([]);
      communicationBus.getMessages({ agentId: 'tech-lead' });

      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('(from_agent = ? OR to_agent = ?)'),
        expect.arrayContaining(['tech-lead', 'tech-lead']),
      );
    });

    it('respects custom limit', () => {
      mockDb.prepare.mockReturnValueOnce([]);
      communicationBus.getMessages({ limit: 10 });

      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT ?'),
        expect.arrayContaining([10]),
      );
    });
  });

  describe('objection handling', () => {
    it('getOpenObjections returns open objections', () => {
      mockDb.prepare.mockReturnValueOnce([
        {
          id: 1,
          message_id: 5,
          project_id: 'proj-1',
          raised_by: 'frontend-engineer',
          target: 'tech-lead',
          reason: 'disagree',
          status: 'open',
          resolved_by: null,
          resolution: null,
          created_at: '2026-01-01T00:00:00Z',
          resolved_at: null,
        },
      ]);

      const result = communicationBus.getOpenObjections('proj-1');

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('open');
      expect(result[0].raisedBy).toBe('frontend-engineer');
    });

    it('resolveObjection updates status and resolution', () => {
      communicationBus.resolveObjection(1, 'tech-lead', 'Accepted after review', 'accepted');

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE objections SET status = ?'),
        expect.arrayContaining(['accepted', 'tech-lead', 'Accepted after review', 1]),
      );
    });
  });
});
