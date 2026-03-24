import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { useIpc } from '../composables/useIpc';

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

export interface Department {
  id: string;
  name: string;
  color: string;
  agentCount: number;
}

/** Agent ID → 專屬圖示 */
const AGENT_ICONS: Record<string, string> = {
  // 工程部
  'tech-lead': '👨‍💻',
  'backend-architect': '🏗️',
  'frontend-developer': '🖥️',
  'mobile-app-builder': '📱',
  'ai-engineer': '🤖',
  'rapid-prototyper': '⚡',
  'devops-automator': '🔧',
  'infrastructure-maintainer': '🛠️',
  // 設計部
  'design-director': '🎨',
  'ui-designer': '🖌️',
  'ux-researcher': '🔬',
  'visual-storyteller': '📸',
  'brand-guardian': '🛡️',
  'whimsy-injector': '✨',
  // 產品部
  'product-manager': '📋',
  'feedback-synthesizer': '💬',
  'sprint-prioritizer': '🎯',
  'trend-researcher': '📈',
  // 行銷部
  'marketing-lead': '📣',
  'content-creator': '✍️',
  'app-store-optimizer': '🏪',
  'tiktok-strategist': '🎵',
  // 測試部
  'qa-lead': '🧪',
  'test-writer-fixer': '🧬',
  'api-tester': '🔌',
  'performance-benchmarker': '⏱️',
  'test-results-analyzer': '📊',
  'tool-evaluator': '🔍',
  'workflow-optimizer': '⚙️',
  // 專案管理部
  'project-lead': '👔',
  'project-shipper': '🚀',
  'studio-producer': '🎬',
  'experiment-tracker': '🧮',
  // 工作室營運
  'operations-lead': '🏢',
  'finance-tracker': '💰',
  'analytics-reporter': '📉',
  'legal-compliance-checker': '⚖️',
  'support-responder': '🎧',
  'context-manager': '🧠',
  'studio-coach': '🏅',
  // 特殊
  'joker': '🃏',
};

/** Agent ID → 繁體中文顯示名稱 */
const AGENT_DISPLAY_NAMES: Record<string, string> = {
  // 工程部
  'tech-lead': '技術主管',
  'backend-architect': '後端架構師',
  'frontend-developer': '前端工程師',
  'mobile-app-builder': '行動應用工程師',
  'ai-engineer': 'AI 工程師',
  'rapid-prototyper': '快速原型師',
  'devops-automator': 'DevOps 工程師',
  'infrastructure-maintainer': '基礎設施維護師',
  // 設計部
  'design-director': '設計總監',
  'ui-designer': 'UI 設計師',
  'ux-researcher': 'UX 研究員',
  'visual-storyteller': '視覺敘事師',
  'brand-guardian': '品牌守護者',
  'whimsy-injector': '趣味注入師',
  // 產品部
  'product-manager': '產品經理',
  'feedback-synthesizer': '回饋分析師',
  'sprint-prioritizer': '衝刺排序師',
  'trend-researcher': '趨勢研究員',
  // 行銷部
  'marketing-lead': '行銷主管',
  'content-creator': '內容創作者',
  'app-store-optimizer': '應用商店優化師',
  'tiktok-strategist': 'TikTok 策略師',
  // 測試部
  'qa-lead': 'QA 主管',
  'test-writer-fixer': '測試工程師',
  'api-tester': 'API 測試師',
  'performance-benchmarker': '效能測試師',
  'test-results-analyzer': '測試結果分析師',
  'tool-evaluator': '工具評估師',
  'workflow-optimizer': '流程優化師',
  // 專案管理部
  'project-lead': '專案主管',
  'project-shipper': '專案交付師',
  'studio-producer': '工作室製作人',
  'experiment-tracker': '實驗追蹤師',
  // 工作室營運
  'operations-lead': '營運主管',
  'finance-tracker': '財務追蹤師',
  'analytics-reporter': '分析報表師',
  'legal-compliance-checker': '法務合規師',
  'support-responder': '客服回應師',
  'context-manager': '情境管理師',
  'studio-coach': '工作室教練',
  // 特殊
  'joker': '百搭牌',
};

export const useAgentsStore = defineStore('agents', () => {
  const ipc = useIpc();

  const agents = ref<AgentDefinition[]>([]);
  const departments = ref<Department[]>([]);
  const filterDepartment = ref<string | null>(null);
  const filterLevel = ref<string | null>(null);
  const filterSearch = ref('');
  const loading = ref(false);

  const filteredAgents = computed(() => {
    let result = agents.value;

    if (filterDepartment.value) {
      result = result.filter((a) => a.department === filterDepartment.value);
    }
    if (filterLevel.value) {
      result = result.filter((a) => a.level === filterLevel.value);
    }
    if (filterSearch.value) {
      const q = filterSearch.value.toLowerCase();
      result = result.filter(
        (a) =>
          a.id.toLowerCase().includes(q) ||
          a.name.toLowerCase().includes(q) ||
          a.description.toLowerCase().includes(q),
      );
    }

    return result;
  });

  const agentsByDepartment = computed(() => {
    const map = new Map<string, AgentDefinition[]>();
    for (const agent of filteredAgents.value) {
      const list = map.get(agent.department) || [];
      list.push(agent);
      map.set(agent.department, list);
    }
    return map;
  });

  const agentCount = computed(() => agents.value.length);

  async function fetchAll() {
    loading.value = true;
    try {
      agents.value = (await ipc.listAgents()) as AgentDefinition[];
    } catch (err) {
      console.error('Failed to fetch agents', err);
    } finally {
      loading.value = false;
    }
  }

  async function fetchDepartments() {
    try {
      departments.value = (await ipc.getDepartments()) as Department[];
    } catch (err) {
      console.error('Failed to fetch departments', err);
    }
  }

  async function getDetail(id: string): Promise<AgentDetail | null> {
    try {
      return (await ipc.getAgent(id)) as AgentDetail;
    } catch (err) {
      console.error('Failed to get agent detail', err);
      return null;
    }
  }

  function getById(id: string): AgentDefinition | undefined {
    return agents.value.find((a) => a.id === id);
  }

  function setFilterDepartment(dept: string | null) {
    filterDepartment.value = dept;
  }

  function setFilterLevel(level: string | null) {
    filterLevel.value = level;
  }

  function setFilterSearch(search: string) {
    filterSearch.value = search;
  }

  /** 取得 Agent 的中文顯示名稱，找不到時 fallback 為原始 name/id */
  function displayName(agentOrId: string | AgentDefinition): string {
    const id = typeof agentOrId === 'string' ? agentOrId : agentOrId.id;
    return AGENT_DISPLAY_NAMES[id] || id;
  }

  /** 取得 Agent 的專屬圖示 */
  function agentIcon(agentOrId: string | AgentDefinition): string {
    const id = typeof agentOrId === 'string' ? agentOrId : agentOrId.id;
    return AGENT_ICONS[id] || '🤖';
  }

  return {
    // State
    agents,
    departments,
    filterDepartment,
    filterLevel,
    filterSearch,
    loading,
    // Computed
    filteredAgents,
    agentsByDepartment,
    agentCount,
    // Actions
    fetchAll,
    fetchDepartments,
    getDetail,
    getById,
    setFilterDepartment,
    setFilterLevel,
    setFilterSearch,
    displayName,
    agentIcon,
  };
});
