import { randomUUID } from 'crypto';
import { database } from './database';
import { taskManager } from './task-manager';
import { logger } from '../utils/logger';
import type {
  SprintRecord,
  SprintStatus,
  SprintType,
  SprintCreateParams,
  SprintStatusInfo,
  TaskStatus,
} from '../types';

const VALID_SPRINT_TRANSITIONS: Record<SprintStatus, SprintStatus[]> = {
  planning: ['active'],
  active: ['review'],
  review: ['completed'],
  completed: [],
};

class SprintManager {
  create(params: SprintCreateParams): SprintRecord {
    const id = randomUUID();
    const sprintType = params.sprintType || 'full';

    database.run(
      `INSERT INTO sprints (id, project_id, name, goal, sprint_type) VALUES (?, ?, ?, ?, ?)`,
      [id, params.projectId, params.name, params.goal || null, sprintType],
    );

    logger.info(`Sprint created: ${id} - ${params.name} (${sprintType})`);
    return this.getById(id)!;
  }

  getById(id: string): SprintRecord | null {
    const rows = database.prepare('SELECT * FROM sprints WHERE id = ?', [id]);
    if (rows.length === 0) return null;
    return this.rowToSprint(rows[0]);
  }

  list(projectId: string): SprintRecord[] {
    const rows = database.prepare(
      'SELECT * FROM sprints WHERE project_id = ? ORDER BY created_at DESC',
      [projectId],
    );
    return rows.map((r: any) => this.rowToSprint(r));
  }

  getActiveSprint(projectId: string): SprintRecord | null {
    const rows = database.prepare(
      "SELECT * FROM sprints WHERE project_id = ? AND status = 'active' LIMIT 1",
      [projectId],
    );
    if (rows.length === 0) return null;
    return this.rowToSprint(rows[0]);
  }

  start(id: string): SprintRecord {
    const sprint = this.getById(id);
    if (!sprint) throw new Error(`Sprint not found: ${id}`);
    this.validateTransition(sprint.status, 'active');

    // 檢查同一個專案是否已有進行中的 sprint，避免同時存在兩個 active sprint
    const activeSprint = this.getActiveSprint(sprint.projectId);
    if (activeSprint) throw new Error('Project already has an active sprint');

    database.run(
      "UPDATE sprints SET status = 'active', started_at = ? WHERE id = ?",
      [new Date().toISOString(), id],
    );

    logger.info(`Sprint started: ${sprint.name}`);
    return this.getById(id)!;
  }

  enterReview(id: string): SprintRecord {
    const sprint = this.getById(id);
    if (!sprint) throw new Error(`Sprint not found: ${id}`);
    this.validateTransition(sprint.status, 'review');

    database.run("UPDATE sprints SET status = 'review' WHERE id = ?", [id]);
    logger.info(`Sprint entered review: ${sprint.name}`);
    return this.getById(id)!;
  }

  complete(id: string): SprintRecord {
    const sprint = this.getById(id);
    if (!sprint) throw new Error(`Sprint not found: ${id}`);
    this.validateTransition(sprint.status, 'completed');

    database.run(
      "UPDATE sprints SET status = 'completed', completed_at = ? WHERE id = ?",
      [new Date().toISOString(), id],
    );

    logger.info(`Sprint completed: ${sprint.name}`);
    return this.getById(id)!;
  }

  /**
   * Get sprint status with task counts.
   */
  getStatus(id: string): SprintStatusInfo {
    const sprint = this.getById(id);
    if (!sprint) throw new Error(`Sprint not found: ${id}`);

    const taskCounts = taskManager.getStatusCounts(sprint.projectId, id);
    const totalTasks = Object.values(taskCounts).reduce((a, b) => a + b, 0);
    const completedTasks = taskCounts.done || 0;
    const progressPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    return {
      sprint,
      taskCounts: taskCounts as Record<TaskStatus, number>,
      totalTasks,
      completedTasks,
      progressPct,
    };
  }

  /**
   * Generate a sprint review summary.
   */
  generateReview(id: string): string {
    const status = this.getStatus(id);
    const tasks = taskManager.list({ sprintId: id });

    const lines: string[] = [
      `# Sprint 回顧: ${status.sprint.name}`,
      '',
      `## 概要`,
      `- 總任務數: ${status.totalTasks}`,
      `- 已完成: ${status.completedTasks} (${status.progressPct}%)`,
      `- 進行中: ${status.taskCounts.in_progress || 0}`,
      `- 被阻塞: ${status.taskCounts.blocked || 0}`,
      `- 被拒絕: ${status.taskCounts.rejected || 0}`,
      '',
      `## 任務明細`,
    ];

    for (const task of tasks) {
      const statusEmoji: Record<string, string> = {
        done: '✅',
        in_progress: '🔄',
        blocked: '🚫',
        rejected: '❌',
        created: '📝',
        assigned: '👤',
        in_review: '🔍',
      };
      lines.push(`- ${statusEmoji[task.status] || '•'} [${task.status}] ${task.title} (${task.assignedTo || '未指派'})`);
    }

    // Save review to DB
    const content = lines.join('\n');
    database.run(
      `INSERT INTO sprint_reviews (sprint_id, review_type, content, generated_by)
       VALUES (?, ?, ?, ?)`,
      [id, 'review', content, 'system'],
    );

    return content;
  }

  /**
   * 根據 Gate 審核結果自動推進 Sprint 狀態。
   * 動態判斷：第一個 gate approved → active，最後一個 → completed，
   * 中間某個 gate 通過且後面還有 → review。
   */
  syncStatusFromGate(sprintId: string, gateType: string): void {
    const sprint = this.getById(sprintId);
    if (!sprint) return;

    // 查出此 sprint 實際擁有的 gate 列表（按 gate_type 排序）
    const sprintGates = database.prepare(
      `SELECT gate_type, status FROM gates WHERE sprint_id = ? ORDER BY gate_type`,
      [sprintId],
    );
    const gateTypes = sprintGates.map((r: any) => r.gate_type as string);
    if (gateTypes.length === 0) return;

    const firstGate = gateTypes[0];
    const lastGate = gateTypes[gateTypes.length - 1];

    let targetStatus: SprintStatus | null = null;
    if (gateType === firstGate) {
      targetStatus = 'active';
    } else if (gateType === lastGate) {
      targetStatus = 'completed';
    } else {
      // 中間 gate — 檢查是否所有到此 gate 為止都 approved
      const idx = gateTypes.indexOf(gateType);
      const allApproved = sprintGates.slice(0, idx + 1).every((r: any) => r.status === 'approved');
      if (allApproved) targetStatus = 'review';
    }
    if (!targetStatus) return;

    // 只往前推進，不倒退
    const order: SprintStatus[] = ['planning', 'active', 'review', 'completed'];
    if (order.indexOf(targetStatus) <= order.indexOf(sprint.status)) return;

    const now = new Date().toISOString();
    if (targetStatus === 'active') {
      database.run(
        "UPDATE sprints SET status = 'active', started_at = COALESCE(started_at, ?) WHERE id = ?",
        [now, sprintId],
      );
    } else if (targetStatus === 'completed') {
      database.run(
        "UPDATE sprints SET status = 'completed', completed_at = ? WHERE id = ?",
        [now, sprintId],
      );
    } else {
      database.run('UPDATE sprints SET status = ? WHERE id = ?', [targetStatus, sprintId]);
    }
    logger.info(`Sprint ${sprint.name} auto-transitioned to ${targetStatus} by gate ${gateType}`);
  }

  private validateTransition(from: SprintStatus, to: SprintStatus): void {
    const allowed = VALID_SPRINT_TRANSITIONS[from];
    if (!allowed || !allowed.includes(to)) {
      throw new Error(`Invalid sprint transition: ${from} → ${to}`);
    }
  }

  private rowToSprint(row: any): SprintRecord {
    return {
      id: row.id,
      projectId: row.project_id,
      name: row.name,
      goal: row.goal || null,
      sprintType: (row.sprint_type as SprintType) || 'full',
      status: row.status,
      startedAt: row.started_at || null,
      completedAt: row.completed_at || null,
      createdAt: row.created_at,
    };
  }
}

export const sprintManager = new SprintManager();
