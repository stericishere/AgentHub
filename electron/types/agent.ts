export interface AgentDefinition {
  id: string;
  name: string;
  level: 'L1' | 'L2';
  department: string;
  description: string;
  tools: string[];
  color: string;
  model: 'opus' | 'sonnet' | 'haiku';
  manages: string[];
  reportsTo: string;
  coordinatesWith: string[];
  filePath: string;
}

export interface AgentDetail extends AgentDefinition {
  systemPrompt: string;
  sessionCount: number;
  totalCost: number;
}

export interface AgentFilters {
  department?: string;
  level?: 'L1' | 'L2';
  search?: string;
}

export interface Department {
  id: string;
  name: string;
  color: string;
  agentCount: number;
}
