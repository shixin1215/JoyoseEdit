<template>
  <div class="stack">
    <div class="panel">
      <div class="panel-header">
        <h2>概览</h2>
        <button class="ghost" @click="handleRefresh" :disabled="state.loading">刷新</button>
        <button class="primary" @click="handleBackup" :disabled="state.loading">立即备份</button>
      </div>
      <div class="hint">
        目标包：<span class="mono">{{ state.stat?.pkg ?? 'com.xiaomi.joyose' }}</span><br>
        数据目录：<span class="mono">{{ state.stat?.data_root ?? '/data/adb/joyose-edit' }}</span>
      </div>
      <div class="grid-2" style="margin-top: var(--space-3)">
        <DbStatCard label="SmartP.db" :stat="state.stat?.smartp" />
        <DbStatCard label="teg_config.db" :stat="state.stat?.teg" />
      </div>
    </div>

    <div class="panel">
      <h2>路径识别 <small>按设备实际 DB 自适应</small></h2>
      <table class="table">
        <thead>
          <tr>
            <th>路径</th>
            <th>状态</th>
            <th class="num">条目</th>
            <th>说明</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in state.paths" :key="p.id">
            <td><strong>{{ pathLabel(p.id) }}</strong></td>
            <td>
              <span class="pill" :class="p.active ? 'ok' : 'off'">
                {{ p.active ? '已激活' : '未下发' }}
              </span>
            </td>
            <td class="num mono">{{ p.count }}</td>
            <td class="muted">{{ p.note }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="panel">
      <h2>云控版本</h2>
      <div class="grid-2">
        <div v-for="(cfg, name) in state.cloudConfig" :key="name" class="stack">
          <div class="row">
            <strong class="mono">{{ name }}</strong>
            <span class="pill" :class="isLocked(cfg.meta.version) ? 'warn' : ''">
              version: {{ cfg.meta.version ?? '—' }}
            </span>
          </div>
          <div class="hint">
            参数头版本：<span class="mono">{{ cfg.params?.header?.version ?? '—' }}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="panel">
      <h2>备份</h2>
      <div class="hint">
        已有备份：<strong>{{ state.stat?.backup_count ?? 0 }}</strong> 份　·
        已有历史：<strong>{{ state.stat?.history_count ?? 0 }}</strong> 条
      </div>
      <div class="btn-row" style="margin-top: var(--space-2);">
        <button @click="handleBackup">立即备份</button>
        <button class="danger" @click="handleRevertLatest">回滚到最近备份</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { state, pullAll, refreshStat, recordBackupCheckpoint } from '@/state/session';
import { toast } from '@/state/toast';
import { dialog } from '@/state/dialog';
import * as bridge from '@/root/bridge';
import DbStatCard from './DbStatCard.vue';

function pathLabel(id: string): string {
  switch (id) {
    case 'mifisr': return 'MIFISR'
    case 'qualcomm': return '高通 GPU';
    case 'novatek': return 'Novatek 独显';
    case 'mivk': return 'MIVK (Vulkan)';
    case 'migl': return 'MIGL (OpenGL)';
    default: return id;
  }
}

function isLocked(v: unknown): boolean {
  return typeof v === 'number' && String(v).startsWith('2099');
}

async function handleRefresh() {
  await refreshStat();
  await pullAll();
}

async function handleBackup() {
  try {
    const r = await bridge.backup();
    await recordBackupCheckpoint(r.name).catch(() => null);
    await refreshStat();
    toast.success('已备份', r.name);
  } catch (err) {
    toast.fromError(err, '备份失败');
  }
}

async function handleRevertLatest() {
  const ok = await dialog.confirm('回滚到最近一次备份？', {
    detail: '两份 DB 会被覆盖，但编辑历史记录仍保留（可继续回滚到更早版本）。',
    okText: '回滚',
    destructive: true,
  });
  if (!ok) return;
  try {
    const r = await bridge.revertLatest();
    await bridge.restart().catch(() => null);
    await pullAll();
    toast.success('已回滚到备份', r.from);
  } catch (err) {
    toast.fromError(err, '回滚失败');
  }
}
</script>
