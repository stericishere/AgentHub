import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { useIpc } from '../composables/useIpc';

interface GitHubUser {
  id: number;
  login: string;
  name: string | null;
  email: string | null;
  avatarUrl: string;
  htmlUrl: string;
}

export const useAuthStore = defineStore('auth', () => {
  const { authLogin, authLogout, authGetProfile, authGetStatus } = useIpc();

  const user = ref<GitHubUser | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const isAuthenticated = computed(() => user.value !== null);

  async function checkStatus() {
    try {
      const status = await authGetStatus();
      if (status.authenticated && status.user) {
        user.value = status.user as GitHubUser;
      } else {
        user.value = null;
      }
    } catch {
      user.value = null;
    }
  }

  async function login() {
    loading.value = true;
    error.value = null;
    try {
      const result = await authLogin();
      if (result.success && result.user) {
        user.value = result.user as GitHubUser;
      } else {
        error.value = result.error || '登入失敗';
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : '登入失敗';
    } finally {
      loading.value = false;
    }
  }

  async function logout() {
    loading.value = true;
    try {
      await authLogout();
      user.value = null;
    } catch (err) {
      error.value = err instanceof Error ? err.message : '登出失敗';
    } finally {
      loading.value = false;
    }
  }

  async function fetchProfile() {
    try {
      const profile = await authGetProfile();
      user.value = profile as GitHubUser;
    } catch {
      // 忽略，可能未登入
    }
  }

  return { user, loading, error, isAuthenticated, checkStatus, login, logout, fetchProfile };
});
