<template>
  <div class="stack">
    <div class="panel">
      <h2>冻结 Joyose 云控（推荐）</h2>
      <div class="hint" style="margin-bottom: var(--space-3)">
        Joyose 的游戏配置来自 MIUI 云控，大约每 13 分钟自动拉取一次并覆盖本地。
        冻结后设备端将永远声称"已是最新版本"，云端不再下发任何规则，本模块改动可长期保留。
      </div>

      <div v-if="tegLoading" class="hint">正在读取云控状态…</div>
      <div v-else-if="!tegState.exists" class="banner warn">
        <strong>云控 SDK 尚未初始化</strong>
        <span class="hint">先在顶栏点一次保存，Joyose 启动后再回来这里冻结即可。</span>
      </div>
      <div v-else>
        <table class="table">
          <tbody>
            <tr>
              <td>配置路径</td>
              <td class="mono">{{ tegState.path }}</td>
            </tr>
            <tr>
              <td>云控基准版本</td>
              <td class="mono">
                <span :class="tegState.frozen ? 'pill warn' : ''">{{ tegState.pref_local_max_version }}</span>
              </td>
            </tr>
            <tr>
              <td>当前状态</td>
              <td>
                <span v-if="tegState.frozen" class="pill warn">已冻结（云控永不覆盖）</span>
                <span v-else class="hint">未冻结（云控会按正常周期覆盖）</span>
              </td>
            </tr>
          </tbody>
        </table>

        <div class="btn-row" style="margin-top: var(--space-3)">
          <button v-if="!tegState.frozen" class="primary" @click="doFreeze" :disabled="busy">冻结云控</button>
          <button v-else class="ghost" @click="doUnfreeze" :disabled="busy">解冻（恢复云控）</button>
          <button class="ghost" @click="refresh" :disabled="busy">刷新状态</button>
        </div>
        <p class="hint" style="margin-top: var(--space-2)">
          冻结 / 解冻会先停掉一次 Joyose 进程以刷新缓存。
          <strong>副作用：</strong>冻结期间所有走 MIUI 云控的模块都不会更新，想恢复请点解冻。
        </p>
      </div>
    </div>

    <div class="panel">
      <h2>DB 版本锁 <small>辅助手段</small></h2>
      <div class="hint" style="margin-bottom: var(--space-3)">
        把 DB 里的版本字段改为 2099 开头。<strong>实测有效的防覆盖方式是上面的冻结云控</strong>；
        此处仅作辅助，便于观察 version 分布和应对少数旁路读取。
      </div>

      <table class="table">
        <thead>
          <tr>
            <th>配置名</th>
            <th>云控版本</th>
            <th>参数头版本</th>
            <th>规则版本</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(cfg, name) in state.cloudConfig" :key="name">
            <td><strong class="mono">{{ name }}</strong></td>
            <td class="mono">
              <span :class="isLocked(cfg.meta.version) ? 'pill warn' : ''">
                {{ cfg.meta.version ?? '—' }}
              </span>
            </td>
            <td class="mono">{{ cfg.params?.header?.version ?? '—' }}</td>
            <td class="mono">{{ ruleVersions(name) }}</td>
            <td>
              <button v-if="!isLocked(cfg.meta.version)" class="primary" @click="lock(String(name))"
                :disabled="state.loading">锁定</button>
              <button v-else class="ghost" @click="unlock(String(name))" :disabled="state.loading">还原 version</button>
            </td>
          </tr>
        </tbody>
      </table>

      <div class="btn-row" style="margin-top: var(--space-3)">
        <button class="primary" @click="lockAll" :disabled="state.loading">全部锁定</button>
        <button @click="bumpOnly" :disabled="state.loading">仅刷大版本（保留后 4 位）</button>
      </div>
      <p class="hint" style="margin-top: var(--space-2)">
        "全部锁定" 会把所有配置的版本前 4 位改成 <strong>2099</strong>，保留后 4 位。
        此操作仅在内存中生效，需在顶栏点保存提交到设备。
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { state, lockCloudVersion, unlockCloudVersion, markDirty } from '@/state/session';
import { toast } from '@/state/toast';
import * as bridge from '@/root/bridge';

function isLocked(v: unknown): boolean {
  return typeof v === 'number' && String(v).startsWith('2099');
}

function ruleVersions(name: string | number): string {
  const rows = state.rulesByModule[String(name)] ?? [];
  if (rows.length === 0) return '（rules 表为空）';
  const vs = rows.map((r) => r.meta.rule_version).filter(Boolean);
  return vs.join(', ') || '—';
}

function lock(name: string) {
  const newV = lockCloudVersion(name);
  markDirty();
  toast.success('已锁定（待提交到设备）', `${name} → version ${newV}`);
}

function unlock(name: string) {
  const cur = Number(state.cloudConfig[name]?.meta.version ?? 0);
  const restored = Number(`2024${String(cur).slice(4)}`);
  unlockCloudVersion(name, restored);
  markDirty();
  toast.warn('已还原版本（待提交）', `${name} → ${restored}；下一次云控下发可能覆盖`);
}

function lockAll() {
  for (const name of Object.keys(state.cloudConfig)) {
    lockCloudVersion(name);
  }
  markDirty();
  toast.success('全部配置版本已刷到 2099 开头（待提交）');
}

function bumpOnly() {
  lockAll();
}

const tegState = reactive<bridge.TegStatus>({ ok: true, exists: false, path: '' });
const tegLoading = ref(true);
const busy = ref(false);

async function refresh() {
  tegLoading.value = true;
  try {
    const s = await bridge.tegStatus();
    Object.assign(tegState, s);
  } catch (err) {
    toast.error('读取云控状态失败', (err as Error).message);
  } finally {
    tegLoading.value = false;
  }
}

async function doFreeze() {
  busy.value = true;
  try {
    await bridge.tegFreeze();
    toast.success('云控已冻结', 'Joyose 已重启，后续云端下发不会覆盖本地改动');
    await refresh();
  } catch (err) {
    toast.error('冻结失败', (err as Error).message);
  } finally {
    busy.value = false;
  }
}

async function doUnfreeze() {
  busy.value = true;
  try {
    await bridge.tegUnfreeze();
    toast.warn('云控已解冻', '下一次云控拉取可能覆盖本地改动');
    await refresh();
  } catch (err) {
    toast.error('解冻失败', (err as Error).message);
  } finally {
    busy.value = false;
  }
}

onMounted(() => {
  if (state.connected) void refresh();
  else tegLoading.value = false;
});
</script>
