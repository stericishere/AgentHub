import { ipcMain } from 'electron';
import { IpcChannels } from '../types';
import { agentLoader } from '../services/agent-loader';
import { logger } from '../utils/logger';
import type { AgentFilters } from '../types';

export function registerAgentHandlers(): void {
  // List agents (with optional filters)
  ipcMain.handle(IpcChannels.AGENT_LIST, (_e, filters?: AgentFilters) => {
    try {
      if (filters) {
        return agentLoader.getFiltered(filters);
      }
      return agentLoader.getAll();
    } catch (err) {
      logger.error('Failed to list agents', err);
      throw err;
    }
  });

  // Get single agent by ID
  ipcMain.handle(IpcChannels.AGENT_GET, (_e, id: string) => {
    try {
      const agent = agentLoader.getById(id);
      if (!agent) {
        throw new Error(`Agent not found: ${id}`);
      }
      // Return as AgentDetail with system prompt
      return {
        ...agent,
        systemPrompt: agentLoader.getSystemPrompt(id),
        sessionCount: 0,
        totalCost: 0,
      };
    } catch (err) {
      logger.error('Failed to get agent', err);
      throw err;
    }
  });

  // Get departments
  ipcMain.handle(IpcChannels.AGENT_GET_DEPARTMENTS, () => {
    try {
      return agentLoader.getDepartments();
    } catch (err) {
      logger.error('Failed to get departments', err);
      throw err;
    }
  });
}
