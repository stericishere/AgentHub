<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue';
import * as monaco from 'monaco-editor';

const props = defineProps<{
  original: string;
  modified: string;
  filename?: string;
  inline?: boolean;
}>();

const containerRef = ref<HTMLDivElement | null>(null);
let diffEditor: monaco.editor.IStandaloneDiffEditor | null = null;

// Detect language from filename
function getLanguage(filename?: string): string {
  if (!filename) return 'plaintext';
  const ext = filename.split('.').pop()?.toLowerCase();
  const langMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    vue: 'html',
    html: 'html',
    css: 'css',
    scss: 'scss',
    json: 'json',
    md: 'markdown',
    py: 'python',
    yml: 'yaml',
    yaml: 'yaml',
    sql: 'sql',
    sh: 'shell',
    bash: 'shell',
  };
  return langMap[ext || ''] || 'plaintext';
}

// Define maestro-dark theme
function defineTheme() {
  monaco.editor.defineTheme('maestro-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [],
    colors: {
      'editor.background': '#1c1e2e',
      'editor.foreground': '#e4e4f0',
      'editorLineNumber.foreground': '#5c5e72',
      'editorGutter.background': '#1c1e2e',
      'diffEditor.insertedTextBackground': '#00d68f22',
      'diffEditor.removedTextBackground': '#ff6b6b22',
      'diffEditor.insertedLineBackground': '#00d68f11',
      'diffEditor.removedLineBackground': '#ff6b6b11',
    },
  });
}

function createEditor() {
  if (!containerRef.value) return;

  defineTheme();

  const language = getLanguage(props.filename);
  const originalModel = monaco.editor.createModel(props.original, language);
  const modifiedModel = monaco.editor.createModel(props.modified, language);

  diffEditor = monaco.editor.createDiffEditor(containerRef.value, {
    theme: 'maestro-dark',
    readOnly: true,
    renderSideBySide: !props.inline,
    automaticLayout: true,
    fontSize: 13,
    fontFamily: "'Cascadia Code', 'Fira Code', 'JetBrains Mono', monospace",
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    lineNumbers: 'on',
    folding: true,
    renderWhitespace: 'selection',
  });

  diffEditor.setModel({ original: originalModel, modified: modifiedModel });
}

function destroyEditor() {
  if (diffEditor) {
    const model = diffEditor.getModel();
    model?.original?.dispose();
    model?.modified?.dispose();
    diffEditor.dispose();
    diffEditor = null;
  }
}

watch(
  () => [props.original, props.modified, props.filename],
  () => {
    if (diffEditor) {
      const language = getLanguage(props.filename);
      const model = diffEditor.getModel();
      if (model) {
        model.original.setValue(props.original);
        model.modified.setValue(props.modified);
        monaco.editor.setModelLanguage(model.original, language);
        monaco.editor.setModelLanguage(model.modified, language);
      }
    }
  },
);

watch(
  () => props.inline,
  (isInline) => {
    if (diffEditor) {
      diffEditor.updateOptions({ renderSideBySide: !isInline });
    }
  },
);

onMounted(() => {
  nextTick(() => createEditor());
});

onBeforeUnmount(() => {
  destroyEditor();
});
</script>

<template>
  <div ref="containerRef" class="h-full w-full" />
</template>
