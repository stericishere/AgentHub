import { registerSystemHandlers } from './system';
import { registerSessionHandlers } from './sessions';
import { registerAgentHandlers } from './agents';
import { registerTaskHandlers } from './tasks';
import { registerSprintHandlers } from './sprints';
import { registerProjectHandlers } from './projects';
import { registerKnowledgeHandlers } from './knowledge';
import { registerGateHandlers } from './gates';
import { registerCostHandlers } from './costs';
import { registerSettingsHandlers } from './settings';
import { registerObjectionHandlers } from './objections';
import { registerGitHandlers } from './git';
import { registerAuthHandlers } from './auth';
import { registerSyncHandlers } from './sync';
import { registerDocSyncHandlers } from './doc-sync';
import { registerBrowseHandlers } from './browse';

export function registerAllHandlers(): void {
  registerSystemHandlers();
  registerSessionHandlers();
  registerAgentHandlers();
  registerTaskHandlers();
  registerSprintHandlers();
  registerProjectHandlers();
  registerKnowledgeHandlers();
  registerGateHandlers();
  registerCostHandlers();
  registerSettingsHandlers();
  registerObjectionHandlers();
  registerGitHandlers();
  registerAuthHandlers();
  registerSyncHandlers();
  registerDocSyncHandlers();
  registerBrowseHandlers();
}
