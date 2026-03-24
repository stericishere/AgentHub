<script setup lang="ts">
import { computed } from 'vue';
import { marked } from 'marked';

const props = defineProps<{
  content: string;
  filePath?: string;
}>();

const html = computed(() => {
  try {
    return marked(props.content, { async: false }) as string;
  } catch {
    return `<pre>${props.content}</pre>`;
  }
});
</script>

<template>
  <div>
    <div v-if="filePath" class="mb-3 text-xs text-text-muted/60">
      {{ filePath }}
    </div>
    <div
      class="prose prose-invert max-w-none text-sm leading-relaxed
        [&_h1]:mb-3 [&_h1]:mt-6 [&_h1]:text-lg [&_h1]:font-bold
        [&_h2]:mb-2 [&_h2]:mt-5 [&_h2]:text-base [&_h2]:font-semibold
        [&_h3]:mb-2 [&_h3]:mt-4 [&_h3]:text-sm [&_h3]:font-semibold
        [&_p]:mb-2 [&_p]:text-text-secondary
        [&_ul]:mb-2 [&_ul]:ml-4 [&_ul]:list-disc [&_ul]:text-text-secondary
        [&_ol]:mb-2 [&_ol]:ml-4 [&_ol]:list-decimal [&_ol]:text-text-secondary
        [&_li]:mb-0.5
        [&_code]:rounded [&_code]:bg-bg-hover [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-xs [&_code]:text-accent-light
        [&_pre]:mb-3 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-bg-primary [&_pre]:p-4 [&_pre]:text-xs
        [&_pre_code]:bg-transparent [&_pre_code]:p-0
        [&_table]:mb-3 [&_table]:w-full [&_table]:border-collapse
        [&_th]:border [&_th]:border-border-default [&_th]:bg-bg-hover [&_th]:px-3 [&_th]:py-1.5 [&_th]:text-left [&_th]:text-xs [&_th]:font-semibold
        [&_td]:border [&_td]:border-border-default [&_td]:px-3 [&_td]:py-1.5 [&_td]:text-xs
        [&_blockquote]:border-l-2 [&_blockquote]:border-accent [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-text-muted
        [&_a]:text-accent-light [&_a]:underline
        [&_hr]:my-4 [&_hr]:border-border-default
      "
      v-html="html"
    />
  </div>
</template>
