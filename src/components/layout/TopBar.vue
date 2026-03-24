<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useUiStore } from '../../stores/ui';
import { useAuthStore } from '../../stores/auth';
import { useSyncStore } from '../../stores/sync';

const route = useRoute();
const router = useRouter();
const uiStore = useUiStore();
const authStore = useAuthStore();
const syncStore = useSyncStore();

const pageTitle = computed(() => (route.meta.title as string) || 'Maestro');

const syncDotClass = computed(() => {
  const conn = syncStore.status.connection;
  if (conn === 'syncing') return 'bg-yellow-500 animate-pulse';
  if (conn === 'connected') return 'bg-green-500';
  if (conn === 'error') return 'bg-red-500';
  return 'bg-gray-400';
});

const syncDotTitle = computed(() => {
  const conn = syncStore.status.connection;
  if (conn === 'syncing') return 'Notion 同步中...';
  if (conn === 'connected') return `Notion 已連線：${syncStore.status.workspaceName || ''}`;
  if (conn === 'error') return 'Notion 同步錯誤';
  return 'Notion 未連線';
});
const showUserDropdown = ref(false);
const userPillRef = ref<HTMLElement | null>(null);
const dropdownRef = ref<HTMLElement | null>(null);

function toggleDropdown() {
  showUserDropdown.value = !showUserDropdown.value;
}

function closeDropdown() {
  showUserDropdown.value = false;
}

function goToSettings() {
  router.push('/settings');
}

function goToAccountSettings() {
  closeDropdown();
  router.push('/settings?tab=account');
}

async function handleLogin() {
  closeDropdown();
  await authStore.login();
}

async function handleLogout() {
  closeDropdown();
  await authStore.logout();
}

function onClickOutside(e: MouseEvent) {
  if (
    showUserDropdown.value &&
    userPillRef.value &&
    dropdownRef.value &&
    !userPillRef.value.contains(e.target as Node) &&
    !dropdownRef.value.contains(e.target as Node)
  ) {
    closeDropdown();
  }
}

onMounted(() => {
  document.addEventListener('click', onClickOutside, true);
  // 初始化 sync 狀態（靜默失敗，不影響 TopBar 渲染）
  syncStore.checkStatus().catch(() => undefined);
});
onUnmounted(() => {
  document.removeEventListener('click', onClickOutside, true);
});
</script>

<template>
  <header
    class="flex h-[52px] min-h-[52px] items-center gap-4 border-b border-border-default bg-bg-secondary pl-6 pr-[144px]"
    style="-webkit-app-region: drag"
  >
    <h1 class="whitespace-nowrap text-base font-semibold">{{ pageTitle }}</h1>

    <div style="-webkit-app-region: no-drag">
      <slot name="actions" />
    </div>

    <!-- Right section -->
    <div class="relative ml-auto flex items-center gap-2.5" style="-webkit-app-region: no-drag">
      <!-- Search box -->
      <div
        class="flex cursor-pointer items-center gap-2 rounded-lg border border-border-default bg-bg-card px-3 py-1.5 text-[13px] text-text-muted"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          class="flex-shrink-0"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <span>搜尋...</span>
        <kbd
          class="rounded border border-border-light bg-bg-hover px-1.5 py-[1px] font-sans text-[11px]"
        >
          Ctrl+K
        </kbd>
      </div>

      <!-- Theme toggle -->
      <button
        class="flex h-[34px] w-[34px] cursor-pointer items-center justify-center rounded-lg border border-border-default bg-transparent text-sm text-text-muted transition-colors hover:bg-bg-hover hover:text-text-primary"
        :title="uiStore.theme === 'dark' ? '切換亮色主題' : '切換暗色主題'"
        @click="uiStore.toggleTheme()"
      >
        {{ uiStore.theme === 'dark' ? '\u25D1' : '\u25D0' }}
      </button>

      <!-- Notion sync indicator (只在已連線時顯示) -->
      <div
        v-if="syncStore.status.connection !== 'disconnected'"
        class="flex h-[34px] w-[34px] cursor-pointer items-center justify-center rounded-lg border border-border-default bg-transparent transition-colors hover:bg-bg-hover"
        :title="syncDotTitle"
        @click="goToSettings"
      >
        <span class="inline-block h-2 w-2 rounded-full" :class="syncDotClass"></span>
      </div>

      <!-- Settings gear -->
      <button
        class="flex h-[34px] w-[34px] cursor-pointer items-center justify-center rounded-lg border border-border-default bg-transparent text-sm text-text-muted transition-colors hover:bg-bg-hover hover:text-text-primary"
        title="設定"
        @click="goToSettings"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>

      <!-- User pill -->
      <div
        ref="userPillRef"
        class="flex cursor-pointer items-center gap-2 rounded-full border border-border-default py-1 pl-1 pr-3 transition-colors hover:border-border-light hover:bg-bg-hover"
        @click="toggleDropdown"
      >
        <!-- Avatar -->
        <img
          v-if="authStore.isAuthenticated && authStore.user?.avatarUrl"
          :src="authStore.user.avatarUrl"
          :alt="authStore.user.login"
          class="h-7 w-7 rounded-full"
        />
        <div
          v-else
          class="flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold text-white"
          style="background: linear-gradient(135deg, #6c5ce7, #22d3ee)"
        >
          ?
        </div>

        <!-- Connected dot -->
        <span
          v-if="authStore.isAuthenticated"
          class="absolute bottom-[5px] left-[24px] h-1.5 w-1.5 rounded-full border-2 border-bg-secondary bg-success"
        ></span>

        <!-- Name -->
        <span class="text-xs font-medium text-text-primary">
          {{ authStore.isAuthenticated ? authStore.user?.login : '登入' }}
        </span>

        <!-- Chevron -->
        <span class="text-[10px] text-text-muted">&#9662;</span>
      </div>

      <!-- User dropdown -->
      <div
        v-if="showUserDropdown"
        ref="dropdownRef"
        class="absolute right-0 top-[42px] z-[100] w-[220px] overflow-hidden rounded-xl border border-border-light bg-bg-card shadow-2xl"
      >
        <!-- Authenticated dropdown -->
        <template v-if="authStore.isAuthenticated">
          <div class="flex items-center gap-2.5 border-b border-border-default px-4 py-3.5">
            <img
              :src="authStore.user?.avatarUrl"
              :alt="authStore.user?.login"
              class="h-9 w-9 rounded-full"
            />
            <div>
              <div class="text-[13px] font-semibold">{{ authStore.user?.login }}</div>
              <div class="flex items-center gap-1 text-[11px] text-success">
                <span class="inline-block h-[5px] w-[5px] rounded-full bg-success"></span>
                已連線 GitHub
              </div>
            </div>
          </div>
          <div class="p-1.5">
            <button
              class="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13px] text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary"
              @click="goToAccountSettings"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
              帳號設定
            </button>
            <div class="mx-2 my-1 h-px bg-border-default"></div>
            <button
              class="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13px] text-danger transition-colors hover:bg-danger/10"
              @click="handleLogout"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              登出
            </button>
          </div>
        </template>

        <!-- Unauthenticated dropdown -->
        <template v-else>
          <div class="p-1.5">
            <button
              class="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13px] text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary"
              :disabled="authStore.loading"
              @click="handleLogin"
            >
              <svg class="h-4 w-4" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
              </svg>
              {{ authStore.loading ? '連線中...' : '以 GitHub 登入' }}
            </button>
          </div>
        </template>
      </div>
    </div>
  </header>
</template>
