<template>
  <div class="panel">
    <strong>{{ label }}</strong>
    <div v-if="!stat || !stat.exists" class="hint">未找到</div>
    <div v-else class="stack hint" style="gap: var(--space-1); margin-top: var(--space-2)">
      <div><span class="dim">路径：</span><span class="mono">{{ stat.path }}</span></div>
      <div><span class="dim">大小：</span><span class="mono">{{ formatSize(stat.size) }}</span></div>
      <div><span class="dim">修改时间：</span><span class="mono">{{ formatTime(stat.mtime) }}</span></div>
      <div><span class="dim">属主：</span><span class="mono">{{ stat.uid }}:{{ stat.gid }}</span></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { StatEntry } from '@/root/bridge';

defineProps<{ label: string; stat?: StatEntry | null }>();

function formatSize(bytes?: number): string {
  if (!bytes) return '—';
  if (bytes > 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MiB`;
  if (bytes > 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${bytes} B`;
}

function formatTime(epoch?: number): string {
  if (!epoch) return '—';
  try {
    return new Date(epoch * 1000).toISOString().replace('T', ' ').replace(/\.\d+Z$/, 'Z');
  } catch {
    return String(epoch);
  }
}
</script>
