<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useProjectsStore } from '../stores/projects';
import ProjectCard from '../components/project/ProjectCard.vue';
import ProjectCreateModal from '../components/project/ProjectCreateModal.vue';
import BaseButton from '../components/common/BaseButton.vue';

const projectsStore = useProjectsStore();
const showCreateModal = ref(false);

onMounted(async () => {
  await projectsStore.fetchAll();
  await projectsStore.fetchAllStats();
});

async function handleCreate(params: { name: string; description: string; template: string; workDir: string }) {
  const project = await projectsStore.create(params);
  showCreateModal.value = false;
  await projectsStore.fetchStats(project.id);
}
</script>

<template>
  <div class="h-full">
    <div class="mb-4 flex items-center justify-between">
      <h2 class="text-xl font-semibold">專案</h2>
      <BaseButton variant="primary" size="sm" @click="showCreateModal = true">
        + 新增專案
      </BaseButton>
    </div>

    <div class="grid gap-4" style="grid-template-columns: repeat(auto-fill, minmax(340px, 1fr))">
      <ProjectCard
        v-for="project in projectsStore.projects"
        :key="project.id"
        :project="project"
        :stats="projectsStore.projectStats[project.id] ?? null"
      />

      <!-- New project card (dashed) -->
      <div
        class="flex min-h-[280px] cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-border-default bg-bg-card opacity-60 transition-all hover:border-accent hover:opacity-80"
        @click="showCreateModal = true"
      >
        <div class="mb-3 text-4xl text-text-muted">+</div>
        <div class="text-sm font-medium text-text-muted">建立新專案</div>
        <div class="mt-1 text-xs text-text-muted">選擇模板</div>
      </div>
    </div>

    <!-- Create Project Modal -->
    <Teleport to="body">
      <ProjectCreateModal
        v-if="showCreateModal"
        @close="showCreateModal = false"
        @create="handleCreate"
      />
    </Teleport>
  </div>
</template>
