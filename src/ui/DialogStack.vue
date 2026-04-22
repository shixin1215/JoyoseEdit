<template>
  <Teleport to="body">
    <div
      v-if="active"
      class="dialog-backdrop"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="`dialog-title-${active.id}`"
      @mousedown.self="onBackdropClick"
      @keydown.esc="onCancel"
    >
      <div class="dialog-card" :class="{ 'dialog-destructive': active.destructive }">
        <h3 :id="`dialog-title-${active.id}`" class="dialog-title">{{ active.title }}</h3>
        <div v-if="active.detail" class="dialog-detail">{{ active.detail }}</div>

        <template v-if="active.kind === 'prompt'">
          <textarea
            v-if="active.multiline"
            ref="inputEl"
            v-model="promptValue"
            class="dialog-input"
            rows="4"
            :placeholder="active.placeholder"
            @keydown.ctrl.enter.exact="onOk"
            @keydown.meta.enter.exact="onOk"
          />
          <input
            v-else
            ref="inputEl"
            v-model="promptValue"
            class="dialog-input"
            :placeholder="active.placeholder"
            @keydown.enter.exact="onOk"
          />
        </template>

        <template v-if="active.kind === 'select'">
          <div class="dialog-options">
            <button
              v-for="(opt, idx) in active.options"
              :key="opt.value"
              ref="optionEls"
              type="button"
              class="dialog-option"
              :class="{ active: idx === selectIndex }"
              @click="onSelect(opt.value)"
              @mouseenter="selectIndex = idx"
            >
              <strong>{{ opt.label }}</strong>
              <span v-if="opt.detail" class="dialog-option-detail">{{ opt.detail }}</span>
            </button>
          </div>
        </template>

        <div class="dialog-actions">
          <button
            v-if="active.kind !== 'alert' && active.cancelText"
            type="button"
            class="ghost"
            @click="onCancel"
          >
            {{ active.cancelText }}
          </button>
          <button
            v-if="active.kind !== 'select'"
            ref="okBtn"
            type="button"
            :class="{ primary: !active.destructive, danger: active.destructive }"
            @click="onOk"
          >
            {{ active.okText }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { useDialogs, resolveDialog } from '@/state/dialog';

const state = useDialogs();
const active = computed(() => state.items[0] ?? null);

const promptValue = ref('');
const selectIndex = ref(0);
const inputEl = ref<HTMLInputElement | HTMLTextAreaElement | null>(null);
const okBtn = ref<HTMLButtonElement | null>(null);
const optionEls = ref<HTMLButtonElement[]>([]);

watch(
  active,
  async (d) => {
    if (!d) return;
    promptValue.value = d.kind === 'prompt' ? (d.initialValue ?? '') : '';
    selectIndex.value = 0;
    await nextTick();
    if (d.kind === 'prompt' && inputEl.value) {
      inputEl.value.focus();
      if ('select' in inputEl.value) inputEl.value.select();
    } else if (d.kind === 'select' && optionEls.value[0]) {
      optionEls.value[0].focus();
    } else if (okBtn.value) {
      okBtn.value.focus();
    }
  },
  { immediate: true },
);

function onOk() {
  if (!active.value) return;
  const d = active.value;
  if (d.kind === 'alert') resolveDialog(d.id, undefined);
  else if (d.kind === 'confirm') resolveDialog(d.id, true);
  else if (d.kind === 'prompt') resolveDialog(d.id, promptValue.value);
}

function onCancel() {
  if (!active.value) return;
  const d = active.value;
  if (d.kind === 'alert') resolveDialog(d.id, undefined);
  else if (d.kind === 'confirm') resolveDialog(d.id, false);
  else resolveDialog(d.id, null);
}

function onSelect(value: string) {
  if (!active.value) return;
  resolveDialog(active.value.id, value);
}

function onBackdropClick() {
  // Click outside card == cancel, matching native prompt/confirm convention
  // (but distinct from ESC so that prompt input focus doesn't get stolen).
  onCancel();
}

// Global ESC: capture when backdrop isn't focused (e.g. user tabbed into input).
window.addEventListener('keydown', (e) => {
  if (!active.value) return;
  if (e.key === 'Escape') {
    e.preventDefault();
    onCancel();
  }
});
</script>
