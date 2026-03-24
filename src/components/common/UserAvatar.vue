<script setup lang="ts">
import { useAuthStore } from '../../stores/auth';
import { useRouter } from 'vue-router';

defineProps<{
  collapsed?: boolean;
}>();

const authStore = useAuthStore();
const router = useRouter();

function goToAccount() {
  router.push('/settings?tab=account');
}
</script>

<template>
  <div
    class="flex cursor-pointer items-center gap-2.5 border-t border-border-default px-4 py-2.5 transition-colors hover:bg-bg-hover"
    @click="goToAccount"
  >
    <!-- 頭像 -->
    <img
      v-if="authStore.isAuthenticated && authStore.user?.avatarUrl"
      :src="authStore.user.avatarUrl"
      :alt="authStore.user.login"
      class="h-8 w-8 flex-shrink-0 rounded-full"
    />
    <div
      v-else
      class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-bg-hover text-sm text-text-muted"
    >
      ?
    </div>

    <!-- 文字（展開時顯示） -->
    <div v-if="!collapsed" class="min-w-0 flex-1">
      <div v-if="authStore.isAuthenticated" class="truncate text-xs font-medium text-text-primary">
        {{ authStore.user?.login }}
      </div>
      <div v-else class="text-xs text-text-muted">未登入</div>

      <div v-if="authStore.isAuthenticated" class="flex items-center gap-1 text-[10px] text-success">
        <span class="inline-block h-1.5 w-1.5 rounded-full bg-success"></span>
        已連線
      </div>
      <div v-else class="text-[10px] text-text-muted">連結 GitHub</div>
    </div>
  </div>
</template>
