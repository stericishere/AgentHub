import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { useIpc } from '../composables/useIpc';
import { useUiStore } from './ui';
import { useProjectsStore } from './projects';

export type TaskStatus =
  | 'created'
  | 'assigned'
  | 'in_progress'
  | 'in_review'
  | 'blocked'
  | 'rejected'
  | 'done';

export interface TaskRecord {
  id: string;
  projectId: string;
  sprintId: string | null;
  parentTaskId: string | null;
  title: string;
  description: string;
  status: TaskStatus;
  assignedTo: string | null;
  createdBy: string | null;
  priority: 'low' | 'medium' | 'high' | 'critical';
  tags: string | null;
  estimatedHours: number | null;
  actualHours: number | null;
  dependsOn: string[];
  createdAt: string;
  updatedAt: string;
}

const KANBAN_COLUMNS: { key: TaskStatus; label: string }[] = [
  { key: 'created', label: '建立' },
  { key: 'assigned', label: '已分配' },
  { key: 'in_progress', label: '進行中' },
  { key: 'in_review', label: '審查中' },
  { key: 'done', label: '完成' },
];

export const useTasksStore = defineStore('tasks', () => {
  const { listTasks, createTask, transitionTask, updateTask, deleteTask, getTaskSessionCounts, getTask, addTaskDependency, removeTaskDependency } = useIpc();

  const tasks = ref<TaskRecord[]>([]);
  const subtasks = ref<TaskRecord[]>([]);
  const selectedTaskId = ref<string | null>(null);
  const currentProjectId = ref<string | null>(null);
  const currentSprintId = ref<string | null>(null);
  const loading = ref(false);
  const sessionCounts = ref<Record<string, { total: number; active: number }>>({});

  const columns = computed(() => KANBAN_COLUMNS);

  const tasksByStatus = computed(() => {
    const map: Record<string, TaskRecord[]> = {};
    for (const col of KANBAN_COLUMNS) {
      map[col.key] = [];
    }
    // Also track blocked/rejected separately
    map.blocked = [];
    map.rejected = [];

    for (const task of tasks.value) {
      if (map[task.status]) {
        map[task.status].push(task);
      }
    }
    return map;
  });

  const selectedTask = computed(() =>
    tasks.value.find((t) => t.id === selectedTaskId.value) || null,
  );

  const totalCount = computed(() => tasks.value.length);
  const doneCount = computed(() => tasks.value.filter((t) => t.status === 'done').length);

  async function fetchTasks(projectId?: string) {
    loading.value = true;
    try {
      const pid = projectId || currentProjectId.value;
      const filters: Record<string, string> = {};
      if (pid) filters.projectId = pid;
      if (currentSprintId.value) filters.sprintId = currentSprintId.value;
      tasks.value = (await listTasks(Object.keys(filters).length > 0 ? filters : undefined)) as TaskRecord[];
    } catch (e) {
      console.error('Failed to fetch tasks', e);
    } finally {
      loading.value = false;
    }
  }

  async function create(params: {
    projectId: string;
    title: string;
    description?: string;
    priority?: string;
    assignedTo?: string;
    sprintId?: string;
  }) {
    const task = (await createTask(params)) as TaskRecord;
    tasks.value.unshift(task);
    return task;
  }

  async function transition(taskId: string, toStatus: TaskStatus) {
    const result = (await transitionTask(taskId, toStatus)) as TaskRecord;
    const idx = tasks.value.findIndex((t) => t.id === taskId);
    if (idx !== -1) tasks.value[idx] = result;
    if (toStatus === 'done') {
      const projectsStore = useProjectsStore();
      const project = projectsStore.projects.find((p) => p.id === result.projectId);
      if (project?.workDir) {
        const uiStore = useUiStore();
        uiStore.addToast('任務完成！建議提交 Git 變更', 'info', '提醒');
      }
    }
    return result;
  }

  async function update(taskId: string, params: Record<string, unknown>) {
    const result = (await updateTask(taskId, params)) as TaskRecord;
    const idx = tasks.value.findIndex((t) => t.id === taskId);
    if (idx !== -1) tasks.value[idx] = result;
    return result;
  }

  async function remove(taskId: string) {
    await deleteTask(taskId);
    tasks.value = tasks.value.filter((t) => t.id !== taskId);
    if (selectedTaskId.value === taskId) selectedTaskId.value = null;
  }

  async function fetchById(id: string): Promise<TaskRecord | null> {
    try {
      const task = (await getTask(id)) as TaskRecord | null;
      if (task) {
        const idx = tasks.value.findIndex((t) => t.id === id);
        if (idx !== -1) tasks.value[idx] = task;
      }
      return task;
    } catch (e) {
      console.error('Failed to fetch task by id', e);
      return null;
    }
  }

  async function fetchSubtasks(parentId: string, projectId?: string) {
    try {
      const filters: Record<string, string> = { parentTaskId: parentId };
      if (projectId) filters.projectId = projectId;
      subtasks.value = (await listTasks(filters)) as TaskRecord[];
    } catch (e) {
      console.error('Failed to fetch subtasks', e);
      subtasks.value = [];
    }
  }

  async function addDependency(taskId: string, dependsOnId: string) {
    await addTaskDependency(taskId, dependsOnId);
  }

  async function removeDependency(taskId: string, dependsOnId: string) {
    await removeTaskDependency(taskId, dependsOnId);
  }

  function selectTask(id: string | null) {
    selectedTaskId.value = id;
  }

  async function fetchSessionCounts() {
    const ids = tasks.value.map((t) => t.id);
    if (ids.length === 0) {
      sessionCounts.value = {};
      return;
    }
    try {
      sessionCounts.value = await getTaskSessionCounts(ids);
    } catch (e) {
      console.error('Failed to fetch session counts', e);
    }
  }

  function setProject(projectId: string | null) {
    setContext(projectId, null);
  }

  function setContext(projectId: string | null, sprintId: string | null) {
    currentProjectId.value = projectId;
    currentSprintId.value = sprintId;
  }

  return {
    tasks,
    subtasks,
    columns,
    tasksByStatus,
    selectedTask,
    selectedTaskId,
    currentProjectId,
    currentSprintId,
    loading,
    sessionCounts,
    totalCount,
    doneCount,
    fetchTasks,
    fetchById,
    fetchSubtasks,
    fetchSessionCounts,
    create,
    transition,
    update,
    remove,
    addDependency,
    removeDependency,
    selectTask,
    setProject,
    setContext,
  };
});
