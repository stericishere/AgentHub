<script setup lang="ts">
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import BaseButton from '../common/BaseButton.vue';
import { useIpc } from '../../composables/useIpc';

const emit = defineEmits<{
  close: [];
  create: [params: { name: string; description: string; template: string; workDir: string }];
}>();

const { t } = useI18n();
const ipc = useIpc();
const name = ref('');
const description = ref('');
const template = ref('blank');
const workDir = ref('');

const templates = computed(() => [
  { value: 'blank', label: t('projects.modal.templateBlank') },
  { value: 'web-app', label: t('projects.modal.templateWebApp') },
  { value: 'mobile-app', label: t('projects.modal.templateMobileApp') },
  { value: 'api-service', label: t('projects.modal.templateApiService') },
  { value: 'library', label: t('projects.modal.templateLibrary') },
]);

async function browseFolder() {
  const folder = await ipc.selectFolder();
  if (folder) workDir.value = folder;
}

function submit() {
  if (!name.value.trim() || !workDir.value.trim()) return;
  emit('create', {
    name: name.value.trim(),
    description: description.value.trim(),
    template: template.value,
    workDir: workDir.value.trim(),
  });
}
</script>

<template>
  <div
    class="modal-overlay"
    @click.self="emit('close')"
  >
    <div class="modal">
      <div class="modal__title">{{ $t('projects.modal.title') }}</div>

      <div class="modal__field">
        <div class="modal__label">{{ $t('projects.modal.selectTemplate') }}</div>
        <div class="modal__template-grid">
          <button
            v-for="t in templates"
            :key="t.value"
            class="modal__template-card"
            :class="
              template === t.value
                ? 'modal__template-card--active'
                : 'modal__template-card--idle'
            "
            @click="template = t.value"
          >
            <span class="modal__template-icon">{{
              ({ blank: '📄', 'web-app': '🌐', 'mobile-app': '📱', 'api-service': '⚡', library: '📦' })[t.value]
            }}</span>
            <span class="modal__template-name">{{ t.label }}</span>
            <span class="modal__template-desc">{{
              ({ blank: $t('projects.modal.templateBlankDesc'), 'web-app': $t('projects.modal.templateWebAppDesc'), 'mobile-app': $t('projects.modal.templateMobileAppDesc'), 'api-service': $t('projects.modal.templateApiServiceDesc'), library: $t('projects.modal.templateLibraryDesc') })[t.value]
            }}</span>
          </button>
        </div>
      </div>

      <div class="modal__field">
        <label class="modal__label">{{ $t('projects.modal.nameLabel') }}</label>
        <input
          v-model="name"
          class="modal__input"
          :placeholder="$t('projects.modal.namePlaceholder')"
          @keydown.enter="submit"
        />
      </div>

      <div class="modal__field">
        <label class="modal__label">{{ $t('projects.modal.workDirLabel') }} <span class="modal__required">*</span></label>
        <div class="modal__workdir-row">
          <input
            v-model="workDir"
            class="modal__input modal__input--flex"
            :placeholder="$t('projects.modal.workDirPlaceholder')"
            @keydown.enter="submit"
          />
          <BaseButton variant="ghost" size="sm" @click="browseFolder">{{ $t('common.browse') }}</BaseButton>
        </div>
        <p class="modal__hint">{{ $t('projects.modal.workDirHint') }}</p>
      </div>

      <div class="modal__field">
        <label class="modal__label">{{ $t('projects.modal.descriptionLabel') }}</label>
        <textarea
          v-model="description"
          class="modal__input modal__input--textarea"
          :placeholder="$t('projects.modal.descriptionPlaceholder')"
        />
      </div>

      <div class="modal__actions">
        <BaseButton variant="ghost" size="sm" @click="emit('close')">{{ $t('common.cancel') }}</BaseButton>
        <BaseButton variant="primary" size="sm" @click="submit">{{ $t('projects.modal.create') }}</BaseButton>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Overlay */
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(0, 0, 0, 0.6);
}

/* Panel */
.modal {
  width: 480px;
  border-radius: 12px;
  border: 1px solid var(--color-border-light);
  background-color: var(--color-bg-secondary, var(--color-bg-card));
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  max-height: 90vh;
  overflow-y: auto;
}

.modal__title {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary);
}

/* Fields */
.modal__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.modal__label {
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text-secondary);
}

.modal__required {
  color: var(--color-error);
}

/* Inputs */
.modal__input {
  width: 100%;
  border-radius: 7px;
  border: 1px solid var(--color-border-default);
  background-color: var(--color-bg-card);
  padding: 8px 12px;
  font-size: 13px;
  color: var(--color-text-primary);
  outline: none;
  box-sizing: border-box;
  font-family: inherit;
  transition: border-color 0.15s;
}

.modal__input::placeholder {
  color: var(--color-text-muted);
}

.modal__input:focus {
  border-color: var(--color-accent);
}

.modal__input--textarea {
  resize: vertical;
  min-height: 72px;
  line-height: 1.5;
}

.modal__input--flex {
  flex: 1;
  min-width: 0;
  width: auto;
}

/* Work-dir row */
.modal__workdir-row {
  display: flex;
  gap: 8px;
}

.modal__hint {
  margin: 0;
  font-size: 11px;
  color: var(--color-text-muted);
}

/* Template grid — 2×2 card layout */
.modal__template-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.modal__template-card {
  cursor: pointer;
  border-radius: 8px;
  border: 1px solid var(--color-border-default);
  padding: 12px;
  text-align: left;
  display: flex;
  flex-direction: column;
  gap: 4px;
  transition: border-color 0.15s ease, background-color 0.15s ease;
  background: none;
  font-family: inherit;
}

.modal__template-card--active {
  border-color: var(--color-accent);
  background-color: rgba(108, 92, 231, 0.1);
}

.modal__template-card--idle {
  border-color: var(--color-border-default);
  background-color: transparent;
}

.modal__template-card--idle:hover {
  border-color: var(--color-border-light);
  background-color: var(--color-bg-hover, rgba(255, 255, 255, 0.04));
}

.modal__template-icon {
  font-size: 20px;
  line-height: 1;
}

.modal__template-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-primary);
}

.modal__template-desc {
  font-size: 11px;
  color: var(--color-text-muted);
}

/* Actions */
.modal__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
