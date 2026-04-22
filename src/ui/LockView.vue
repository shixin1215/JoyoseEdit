<template>
  <div class="stack">
    <div class="panel">
      <h2>冻结 teg 云控（推荐）<br>
        <small>把 teg SDK 的 <span class="mono">pref_local_max_version</span> 刷到 Long.MAX_VALUE，彻底拦住云端下发</small>
      </h2>
      <div class="muted tiny" style="margin-bottom: 12px">
        Joyose 运行时的配置来自 MIUI <span class="mono">teg</span> 云控 SDK
        （<span class="mono">com.xiaomi.teg.config</span>）。它在自己的
        <span class="mono">SharedPreferences</span>（<span class="mono">teg_config_pref.xml</span>）
        里维护一个 <span class="mono">pref_local_max_version</span>，每约 13 分钟（或收到
        <span class="mono">update_miui_cloud_profile</span> 广播）带这个值上报云端；
        云端 <span class="mono">maxVersion</span> 更大就无条件下发规则、覆盖
        <span class="mono">teg_config.db.rules</span>，之后通知 Joyose 重建内存。
        <strong>重点：teg SDK 应用规则时不做 per-rule version 比较，所以锁 DB 里 version 字段对它无效。</strong>
        只有把 <span class="mono">pref_local_max_version</span> 刷到
        <span class="mono">Long.MAX_VALUE</span>，云端才永远比不过，
        <span class="mono">f.a()</span> 走 "data is up to date" 分支直接 no-op。
      </div>

      <div v-if="tegLoading" class="muted tiny">正在读取 teg 状态…</div>
      <div v-else-if="!tegState.exists" class="banner warn">
        <strong>teg SDK 还没初始化过</strong>：<span class="mono">{{ tegState.path }}</span>
        不存在。先点一次顶栏的保存（触发 pushAll 会自动拉起 Joyose + teg SDK），
        然后回来这里冻结。
      </div>
      <div v-else>
        <table class="table">
          <tbody>
            <tr>
              <td><span class="mono">路径</span></td>
              <td class="mono">{{ tegState.path }}</td>
            </tr>
            <tr>
              <td><span class="mono">pref_local_max_version</span></td>
              <td class="mono">
                <span :class="tegState.frozen ? 'pill warn' : ''">{{ tegState.pref_local_max_version }}</span>
              </td>
            </tr>
            <tr>
              <td>当前状态</td>
              <td>
                <span v-if="tegState.frozen" class="pill warn">已冻结（云控永不覆盖）</span>
                <span v-else class="muted tiny">未冻结（云控会按正常周期覆盖）</span>
              </td>
            </tr>
          </tbody>
        </table>

        <div class="btn-row" style="margin-top: 12px">
          <button v-if="!tegState.frozen" class="primary" @click="doFreeze" :disabled="busy">冻结 teg 云控</button>
          <button v-else class="ghost" @click="doUnfreeze" :disabled="busy">解冻（恢复云控）</button>
          <button class="ghost" @click="refresh" :disabled="busy">刷新状态</button>
        </div>
        <p class="muted tiny" style="margin-top: 8px">
          冻结/解冻都会先 <span class="mono">am force-stop com.xiaomi.joyose</span>，
          因为 SharedPreferences 在进程内有缓存，不停掉 Joyose 改 XML 不生效。
          <strong>副作用：</strong>冻结后 teg SDK 管的所有云控模块（不只是 booster_config）都会停下来，
          其他模块的更新也收不到。想恢复正常云控就点解冻。
        </p>
      </div>
    </div>

    <div class="panel">
      <h2>DB 侧 version 字段<br>
        <small>辅助手段：把 <span class="mono">cloud_config.version</span> / <span class="mono">rule_version</span> 刷到 2099 开头</small>
      </h2>
      <div class="muted tiny" style="margin-bottom: 12px">
        <strong>这个面板改的是 DB 文件里的 version 列，不是 teg SDK SP 里的
        <span class="mono">pref_local_max_version</span>。</strong>
        反编译确认 teg SDK 不读这两列，所以单靠这里防不住云控覆盖——<strong>要真正拦，请先用上面的冻结功能</strong>。
        保留这个面板是为了 Joyose 内部万一有旁路仍然读
        <span class="mono">SmartP.cloud_config.version</span> 的情况，以及便于查看当前 version 分布。
      </div>

      <table class="table">
        <thead>
          <tr>
            <th>config_name</th>
            <th>cloud_config.version</th>
            <th>header.version</th>
            <th>rules.rule_version</th>
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

      <div class="btn-row" style="margin-top: 12px">
        <button class="primary" @click="lockAll" :disabled="state.loading">全部锁定</button>
        <button @click="bumpOnly" :disabled="state.loading">仅刷大 version（保留原后 4 位）</button>
      </div>
      <p class="muted tiny" style="margin-top: 8px">
        "全部锁定" 会把所有 <span class="mono">config_name</span> 的 <span class="mono">version</span>
        前 4 位改成 <strong>2099</strong>，保留后 4 位不动。此操作**仅在内存中生效**，
        需要在顶栏点保存把 DB 提交到设备。
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
  toast.warn('已还原 version（待提交）', `${name} → ${restored}；下一次云控下发可能覆盖`);
}

function lockAll() {
  for (const name of Object.keys(state.cloudConfig)) {
    lockCloudVersion(name);
  }
  markDirty();
  toast.success('全部 config_name 的 version 已刷到 2099 开头（待提交）');
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
    toast.error('读取 teg 状态失败', (err as Error).message);
  } finally {
    tegLoading.value = false;
  }
}

async function doFreeze() {
  busy.value = true;
  try {
    await bridge.tegFreeze();
    toast.success('teg 云控已冻结', 'pref_local_max_version = Long.MAX_VALUE；Joyose 已重启');
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
    toast.warn('teg 云控已解冻', 'pref_local_max_version = 0；下一次云控下发可能覆盖');
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
