<template>
  <div class="panel">
    <div class="panel-header">
      <h2>{{ title }} <small>{{ packages.length }} 条</small></h2>
    </div>
    <div class="row" style="margin-bottom: 8px">
      <input v-model="filter" placeholder="筛选" style="flex: 1 1 180px" />
      <input v-model="newPkg" placeholder="com.example.foo" style="flex: 2 1 220px" @keyup.enter="add" />
      <button class="primary" @click="add" :disabled="!isLegal(newPkg)">添加</button>
      <button class="ghost" @click="bulkPaste">批量粘贴</button>
      <button class="ghost" @click="dedupe">去重排序</button>
    </div>
    <div class="pkg-list-scroll">
      <table class="table">
        <tbody>
          <tr v-for="(p, i) in filtered" :key="p + i">
            <td class="mono">{{ p }}</td>
            <td style="width: 1px; white-space: nowrap; text-align: right">
              <button class="danger" @click="remove(p)">移除</button>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-if="filtered.length === 0" class="muted tiny" style="padding: 8px">（空）</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { dialog } from '@/state/dialog';

const props = defineProps<{ title: string; packages: string[] }>();
const emit = defineEmits<{ (e: 'update', packages: string[]): void }>();

const filter = ref('');
const newPkg = ref('');

const filtered = computed(() => {
  const f = filter.value.trim().toLowerCase();
  if (!f) return props.packages;
  return props.packages.filter((p) => p.toLowerCase().includes(f));
});

function isLegal(p: string): boolean {
  return /^[a-zA-Z][a-zA-Z0-9_.]+$/.test(p.trim());
}

function add() {
  const p = newPkg.value.trim();
  if (!isLegal(p)) return;
  if (props.packages.includes(p)) return;
  emit('update', [...props.packages, p]);
  newPkg.value = '';
}

function remove(p: string) {
  emit('update', props.packages.filter((x) => x !== p));
}

async function bulkPaste() {
  const text = await dialog.prompt(`批量合并到 ${props.title}`, {
    detail: '用空格、逗号、分号或换行分隔；会去重后与现有包名合并。',
    multiline: true,
    placeholder: 'com.miHoYo.Yuanshen\ncom.miHoYo.hkrpg\n...',
  });
  if (!text) return;
  const fresh = text
    .split(/[\s,;]+/)
    .map((x) => x.trim())
    .filter(isLegal);
  const next = Array.from(new Set([...props.packages, ...fresh])).sort();
  emit('update', next);
}

function dedupe() {
  emit('update', Array.from(new Set(props.packages)).sort());
}
</script>

<style scoped>
.pkg-list-scroll {
  max-height: 48dvh;
  overflow-y: auto;
}

@media (max-width: 720px) {
  .pkg-list-scroll {
    max-height: none;
    overflow-y: visible;
  }
}
</style>
