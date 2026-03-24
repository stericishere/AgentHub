export type GateType = 'G0' | 'G1' | 'G2' | 'G3' | 'G4' | 'G5' | 'G6';
export type GateStatus = 'pending' | 'submitted' | 'approved' | 'rejected';

export interface GateCreateParams {
  projectId: string;
  sprintId?: string | null;
  gateType: GateType;
}

export interface SubmitGateParams {
  gateId: string;
  submittedBy: string;
  checklist: Record<string, boolean>;
}

export interface ReviewGateParams {
  gateId: string;
  reviewer: string;
  decision: 'approved' | 'rejected';
  comment?: string;
  checklist?: Record<string, boolean>;
  itemReasons?: Record<string, string>;
}

export interface GateFilters {
  projectId?: string;
  sprintId?: string | null;
  gateType?: GateType;
  status?: GateStatus;
}

export interface GateChecklistItem {
  label: string;
  criteria: string;
}

export interface GateChecklist {
  gateType: GateType;
  label: string;
  items: GateChecklistItem[];
}

export interface GateWithDetails {
  id: string;
  projectId: string;
  sprintId: string | null;
  gateType: GateType;
  status: GateStatus;
  submittedBy: string | null;
  reviewer: string | null;
  checklist: Record<string, boolean> | null;
  decision: string | null;
  itemReasons?: Record<string, string> | null;
  createdAt: string;
  projectName?: string;
  sprintName?: string;
}
