import { sessionManager } from './session-manager';
import { taskManager } from './task-manager';
import { communicationBus } from './communication-bus';
import { memoryManager } from './memory-manager';
import { delegationParser } from './delegation-parser';
import { agentLoader } from './agent-loader';
import { eventBus } from './event-bus';
import { logger } from '../utils/logger';
import type { TaskRecord, DelegationCommand } from '../types';

interface ExecutionResult {
  sessionId: string;
  agentId: string;
  taskId: string;
  status: 'completed' | 'failed';
  delegations: DelegationCommand[];
  childTasks: TaskRecord[];
  output: string;
  error?: string;
}

class Orchestrator {
  /**
   * Execute a task via an agent session.
   * Core orchestration flow:
   * 1. Spawn L1 session
   * 2. Wait for completion
   * 3. Parse delegation commands
   * 4. Create child tasks & spawn L2 sessions
   * 5. Extract memory
   * 6. Report result
   */
  async executeTask(
    agentId: string,
    taskId: string,
    projectId: string,
    sprintId?: string | null,
  ): Promise<ExecutionResult> {
    const agent = agentLoader.getById(agentId);
    if (!agent) throw new Error(`Agent not found: ${agentId}`);

    const task = taskManager.getById(taskId);
    if (!task) throw new Error(`Task not found: ${taskId}`);

    logger.info(`Orchestrator: executing task ${taskId} with agent ${agentId}`);

    // Transition task to in_progress
    try {
      taskManager.transition({ taskId, toStatus: 'in_progress' });
    } catch {
      // May already be in_progress
    }

    // Spawn session
    const { sessionId } = sessionManager.spawn({
      agentId,
      task: task.title + (task.description ? `\n\n${task.description}` : ''),
      projectId,
    });

    // Wait for completion
    let output = '';
    try {
      output = await sessionManager.waitForCompletion(sessionId);
    } catch (err: any) {
      logger.error(`Session ${sessionId} failed`, err);

      // Send failure report
      if (agent.reportsTo) {
        communicationBus.send({
          fromAgent: agentId,
          toAgent: agent.reportsTo,
          messageType: 'report',
          content: `任務執行失敗: ${task.title}\n錯誤: ${err.message}`,
          projectId,
          taskId,
        });
      }

      return {
        sessionId,
        agentId,
        taskId,
        status: 'failed',
        delegations: [],
        childTasks: [],
        output: '',
        error: err.message,
      };
    }

    // Parse delegation commands (L1 → L2)
    const delegations = delegationParser.parse(output);
    let childTasks: TaskRecord[] = [];

    if (delegations.length > 0 && agent.level === 'L1') {
      // Create sub-tasks
      childTasks = taskManager.createFromDelegations(
        delegations,
        projectId,
        sprintId,
        taskId,
        agentId,
      );

      // Assign and transition sub-tasks
      for (const child of childTasks) {
        try {
          taskManager.transition({ taskId: child.id, toStatus: 'assigned' });
        } catch { /* ignore */ }
      }

      // Spawn L2 sessions in parallel
      const l2Promises = childTasks.map(async (child) => {
        if (!child.assignedTo) return;

        // Send command message
        communicationBus.send({
          fromAgent: agentId,
          toAgent: child.assignedTo,
          messageType: 'command',
          content: child.title,
          projectId,
          taskId: child.id,
        });

        // Execute child task
        try {
          await this.executeTask(child.assignedTo, child.id, projectId, sprintId);
        } catch (err) {
          logger.error(`Child task ${child.id} failed`, err);
        }
      });

      await Promise.all(l2Promises);
    }

    // Extract memory from session output
    memoryManager.extractFromSession(output, agentId, projectId, sessionId);

    // Transition task to in_review or done
    try {
      if (childTasks.length > 0) {
        // L1 task goes to in_review while L2 tasks are processing
        taskManager.transition({ taskId, toStatus: 'in_review' });
      } else {
        taskManager.transition({ taskId, toStatus: 'in_review' });
      }
    } catch { /* ignore transition errors */ }

    // Report result to parent
    if (agent.reportsTo) {
      communicationBus.send({
        fromAgent: agentId,
        toAgent: agent.reportsTo,
        messageType: 'report',
        content: `任務完成: ${task.title}\n委派了 ${delegations.length} 個子任務`,
        projectId,
        taskId,
      });
    }

    // Emit orchestration event
    eventBus.emit('orch:task-completed', {
      taskId,
      agentId,
      sessionId,
      delegationCount: delegations.length,
    });

    return {
      sessionId,
      agentId,
      taskId,
      status: 'completed',
      delegations,
      childTasks,
      output,
    };
  }
}

export const orchestrator = new Orchestrator();
