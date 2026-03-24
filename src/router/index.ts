import { createRouter, createWebHashHistory } from 'vue-router';

const routes = [
  {
    path: '/',
    name: 'dashboard',
    component: () => import('../views/DashboardView.vue'),
    meta: { title: '儀表板', icon: '▣', section: 'overview' },
  },
  {
    path: '/sessions',
    name: 'sessions',
    component: () => import('../views/SessionsView.vue'),
    meta: { title: '工作階段', icon: '▶', section: 'overview' },
  },
  {
    path: '/agents',
    name: 'agents',
    component: () => import('../views/AgentsView.vue'),
    meta: { title: '代理人', icon: '☯', section: 'workspace' },
  },
  {
    path: '/agents/:id',
    name: 'agent-detail',
    component: () => import('../views/AgentDetailView.vue'),
    meta: { title: '代理人詳情', icon: '☯', section: 'workspace' },
  },
  {
    path: '/projects',
    name: 'projects',
    component: () => import('../views/ProjectsView.vue'),
    meta: { title: '專案管理', icon: '📁', section: 'workspace' },
  },
  {
    path: '/projects/:id',
    name: 'project-detail',
    component: () => import('../views/ProjectDetailView.vue'),
    meta: { title: '專案詳情', icon: '📁', section: 'workspace' },
  },
  {
    path: '/tasks',
    name: 'tasks',
    component: () => import('../views/TaskBoardView.vue'),
    meta: { title: '任務看板', icon: '☐', section: 'workspace' },
  },
  {
    path: '/tasks/:id',
    name: 'task-detail',
    component: () => import('../views/TaskDetailView.vue'),
    meta: { title: '任務詳情', icon: '☐', section: 'workspace' },
  },
  {
    path: '/knowledge',
    name: 'knowledge',
    component: () => import('../views/KnowledgeView.vue'),
    meta: { title: '知識庫', icon: '📚', section: 'workspace' },
  },
  {
    path: '/costs',
    name: 'costs',
    component: () => import('../views/CostsView.vue'),
    meta: { title: '成本分析', icon: '💰', section: 'system' },
  },
  {
    path: '/gates',
    name: 'gates',
    component: () => import('../views/GatesView.vue'),
    meta: { title: '審核關卡', icon: '🔒', section: 'system' },
  },
  {
    path: '/guide',
    name: 'guide',
    component: () => import('../views/GuideView.vue'),
    meta: { title: '使用說明', icon: '?', section: 'system' },
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('../views/SettingsView.vue'),
    meta: { title: '設定', icon: '⚙', section: 'system' },
  },
];

export const router = createRouter({
  history: createWebHashHistory(),
  routes,
});
