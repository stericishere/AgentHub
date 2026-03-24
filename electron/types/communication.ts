export type MessageType =
  | 'command'
  | 'report'
  | 'proposal'
  | 'objection'
  | 'coordinate'
  | 'notify';

export interface MessageRecord {
  id: number;
  projectId: string | null;
  taskId: string | null;
  fromAgent: string;
  toAgent: string;
  messageType: MessageType;
  content: string;
  metadata: string | null;
  createdAt: string;
}

export interface SendMessageParams {
  projectId?: string | null;
  taskId?: string | null;
  fromAgent: string;
  toAgent: string;
  messageType: MessageType;
  content: string;
  metadata?: Record<string, unknown>;
}

export interface DelegationCommand {
  targetAgent: string;
  task: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  context?: string;
}

export interface MemoryBlock {
  id: number;
  agentId: string;
  projectId: string | null;
  blockType: string;
  content: string;
  sourceSessionId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DecisionRecord {
  id: number;
  projectId: string | null;
  title: string;
  content: string;
  reason: string | null;
  category: string;
  status: 'active' | 'superseded' | 'revoked';
  decidedBy: string | null;
  createdAt: string;
}

export interface ConversationRecord {
  id: number;
  projectId: string | null;
  agentId: string;
  sessionId: string | null;
  role: string;
  content: string;
  createdAt: string;
}

export interface ObjectionRecord {
  id: number;
  messageId: number;
  projectId: string | null;
  raisedBy: string;
  target: string;
  reason: string;
  status: 'open' | 'accepted' | 'rejected' | 'resolved';
  resolvedBy: string | null;
  resolution: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

export interface ProjectCreateParams {
  name: string;
  description?: string;
  template?: string;
  workDir?: string;
}

export interface ProjectUpdateParams {
  name?: string;
  description?: string;
  status?: 'planning' | 'active' | 'paused' | 'completed' | 'archived';
  workDir?: string;
}

export interface KnowledgeTreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: KnowledgeTreeNode[];
}
