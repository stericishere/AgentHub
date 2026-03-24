<script setup lang="ts">
const props = defineProps<{
  variant?: 'primary' | 'secondary' | 'ghost' | 'icon' | 'success' | 'danger';
  size?: 'sm' | 'default';
  loading?: boolean;
}>();

const variantClasses: Record<string, string> = {
  primary: 'bg-accent text-white hover:bg-[#7c6df0]',
  secondary: 'border border-border-default bg-bg-hover text-text-primary hover:bg-bg-active',
  ghost: 'bg-transparent text-text-secondary hover:bg-bg-hover hover:text-text-primary',
  icon: 'flex h-[34px] w-[34px] items-center justify-center border border-border-default bg-transparent p-0 text-text-secondary hover:bg-bg-hover hover:text-text-primary',
  success: 'bg-success text-white hover:bg-[#00c07f]',
  danger: 'bg-danger text-white hover:bg-[#e55a5a]',
};
</script>

<template>
  <button
    class="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border-none font-medium transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-50"
    :class="[
      variantClasses[variant || 'ghost'],
      size === 'sm' ? 'px-2.5 py-[5px] text-xs' : 'px-4 py-2 text-[13px]',
    ]"
    :disabled="loading"
  >
    <svg v-if="loading" class="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
    <slot />
  </button>
</template>
