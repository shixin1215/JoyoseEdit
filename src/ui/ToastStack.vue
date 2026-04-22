<template>
  <Teleport to="body">
    <div class="toast-stack" :aria-live="'polite'" aria-atomic="true">
      <TransitionGroup name="toast">
        <div
          v-for="t in toasts.items"
          :key="t.id"
          class="toast"
          :class="t.kind"
          role="status"
          @click="dismissToast(t.id)"
        >
          <div class="toast-icon">{{ iconFor(t.kind) }}</div>
          <div class="toast-body">
            <strong>{{ t.message }}</strong>
            <div v-if="t.detail" class="toast-detail">{{ t.detail }}</div>
          </div>
          <button class="toast-close" aria-label="关闭" @click.stop="dismissToast(t.id)">×</button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { useToasts, dismissToast } from '@/state/toast';
import type { ToastKind } from '@/state/toast';

const toasts = useToasts();

function iconFor(kind: ToastKind): string {
  switch (kind) {
    case 'success': return '✓';
    case 'warn': return '!';
    case 'error': return '✕';
    default: return 'i';
  }
}
</script>
