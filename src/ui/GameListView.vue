<template>
  <div class="stack">
    <div class="panel">
      <h2>游戏列表 <small>纳入优化 / 支持</small></h2>
      <div class="hint">
        Joyose 根据这两个列表决定是否应用游戏策略。
        <span class="mono">game_list</span>：正式纳入优化；
        <span class="mono">support_app</span>：更宽泛的支持列表。
      </div>
    </div>

    <div class="grid-2">
      <PackageListEditor title="game_list" :packages="gameList" @update="(v: string[]) => update('game_list', v)" />
      <PackageListEditor title="support_app" :packages="supportApp"
        @update="(v: string[]) => update('support_app', v)" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { state, markDirty } from '@/state/session';
import PackageListEditor from './PackageListEditor.vue';

const gameList = computed<string[]>(() => {
  return state.cloudConfig.common_config?.params?.game_list ?? [];
});
const supportApp = computed<string[]>(() => {
  return state.cloudConfig.common_config?.params?.support_app ?? [];
});

function update(key: 'game_list' | 'support_app', next: string[]) {
  const cc = state.cloudConfig.common_config;
  if (!cc) return;
  if (!cc.params) cc.params = {};
  cc.params[key] = next;
  markDirty();
}
</script>
