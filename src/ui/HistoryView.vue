<template>
  <div class="stack">
    <div class="panel">
      <h2>编辑历史 <small>每次提交都是一条新记录</small></h2>
      <div class="hint">
        历史保存在 <span class="mono">/data/adb/joyose-edit/history/</span>。
        回滚会把所选记录加载到内存，由你决定是否提交到设备；回滚<strong>不会</strong>删除任何历史。
      </div>
      <div class="row" style="margin-top: var(--space-2)">
        <button class="ghost" @click="refresh" :disabled="loading">刷新</button>
        <button class="danger" @click="handleClear" :disabled="loading">清理旧历史（保留最近 N 条）</button>
      </div>
    </div>

    <div class="twopane">
      <div class="list">
        <button v-for="item in listing" :key="item.name" class="item" :class="{ active: selected?.name === item.name }"
          @click="select(item.name)">
          <strong>{{ formatTime(item.timestamp) }}</strong>
          <span class="sub">seq {{ item.seq }}</span>
          <span v-if="selected?.name === item.name" class="sub">加载中…</span>
        </button>
        <div v-if="listing.length === 0" class="muted tiny" style="padding: 12px">
          （暂无历史）
        </div>
      </div>

      <div v-if="record" class="detail stack">
        <div class="row">
          <strong>seq {{ record.seq }}</strong>
          <span class="pill">{{ record.source }}</span>
          <span class="pill">{{ formatTime(record.timestamp) }}</span>
          <button class="ghost" @click="loadInto('before')" style="margin-left: auto"
            title="把内存状态恢复到此次提交之前；还需点顶栏「提交到设备」才真正生效">
            撤销此提交
          </button>
          <button class="primary" @click="loadInto('after')"
            title="重新应用此次提交的结果到内存；还需点顶栏「提交到设备」才真正生效">
            重做此提交
          </button>
        </div>
        <div v-if="record.note" class="muted tiny">note: {{ record.note }}</div>
        <div class="panel" style="margin: 0; background: var(--bg-elevated)">
          <h2 style="font-size: 14px">diff 摘要 <small>{{ record.diff_summary.length }} 条</small></h2>
          <div style="max-height: 300px; overflow-y: auto">
            <div v-for="(r, i) in record.diff_summary.slice(0, 500)" :key="i" class="diff-line" :class="r.kind">{{
              summarize(r) }}</div>
          </div>
          <div v-if="record.diff_summary.length > 500" class="hint" style="margin-top: var(--space-2)">
            仅显示前 500 条。完整 diff 请看下方原始 JSON。
          </div>
        </div>
        <details>
          <summary class="muted tiny">完整 before / after JSON</summary>
          <pre class="mono"
            style="background: var(--bg); padding: 10px; border-radius: 6px; max-height: 300px; overflow: auto">{{ JSON.stringify(record.before, null, 2) }}</pre>
          <pre class="mono"
            style="background: var(--bg); padding: 10px; border-radius: 6px; max-height: 300px; overflow: auto">{{ JSON.stringify(record.after, null, 2) }}</pre>
        </details>
      </div>
      <div v-else class="detail muted tiny">从列表里选一条。</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import {
  listHistory,
  readHistory,
  loadFromRecord,
  markDirty,
} from '@/state/session';
import * as bridge from '@/root/bridge';
import { toast } from '@/state/toast';
import { dialog } from '@/state/dialog';
import type { HistoryFileMeta, HistoryRecord } from '@/history/store';
import { summarizeRecord } from '@/history/diff';

const listing = ref<HistoryFileMeta[]>([]);
const selected = ref<HistoryFileMeta | null>(null);
const record = ref<HistoryRecord | null>(null);
const loading = ref(false);

onMounted(() => refresh());

async function refresh() {
  loading.value = true;
  try {
    listing.value = await listHistory();
    selected.value = null;
    record.value = null;
  } catch (err) {
    toast.fromError(err, '读取历史列表失败');
  } finally {
    loading.value = false;
  }
}

async function select(name: string) {
  selected.value = listing.value.find((l) => l.name === name) ?? null;
  record.value = null;
  try {
    record.value = await readHistory(name);
  } catch (err) {
    toast.fromError(err, '读取历史记录失败');
  }
}

function loadInto(which: 'before' | 'after') {
  if (!record.value) return;
  loadFromRecord(record.value, which);
  markDirty();
  const title = which === 'before' ? '已加载"撤销此提交"到内存' : '已加载"重做此提交"到内存';
  toast.info(title, '点顶栏「提交到设备」才会真正写入 DB，并生成一条新的历史记录');
}

async function handleClear() {
  const v = await dialog.prompt('清理历史记录', {
    detail: '保留最近 N 条，其余删除（不可撤销）。',
    initialValue: '100',
    placeholder: '非负整数',
  });
  if (v === null) return;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0) {
    toast.warn('输入无效', '请输入非负整数');
    return;
  }
  try {
    const r = await bridge.historyClear(n);
    await refresh();
    toast.success(`已保留最近 ${r.kept} 条历史`);
  } catch (err) {
    toast.fromError(err, '清理失败');
  }
}

function summarize(r: Parameters<typeof summarizeRecord>[0]): string {
  return summarizeRecord(r);
}

function formatTime(epoch: number): string {
  try {
    const d = new Date(epoch * 1000);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} `
      + `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  } catch {
    return String(epoch);
  }
}
</script>
