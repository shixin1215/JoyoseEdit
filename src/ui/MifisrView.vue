<template>
  <div class="stack">
    <div class="panel">
      <h2>MIFISR 画质增强 <small>小米 17 系列（骁龙 8 Elite 2）</small></h2>
      <div class="hint">
        每条配置管一款游戏的帧插值 + 超分。字段中 <span class="mono">-1</span> 代表由驱动自动决定。
      </div>
    </div>

    <div v-if="!mifisrSwitchOn" class="banner error">
      <strong>MIFISR 总开关未开启</strong>
      <span>未开启前，下面的条目都不会生效。</span>
      <div class="banner-actions">
        <button class="primary" @click="enableMifisrSwitch">一键开启</button>
      </div>
    </div>

    <div v-if="visionBlocked" class="banner error">
      <strong>游戏助手不会显示画质增强面板</strong>
      <div class="hint">
        当前 vendor 属性：<span class="mono">frc={{ vision?.frc_support || '空' }}</span>、<span class="mono">sr={{
          vision?.sr_support || '空' }}</span>。两者都需要为 <span class="mono">true</span>，游戏助手才会渲染插帧 / 超分开关。
        本模块不会自动改系统属性，可以用下面的命令临时开启（重启后失效）：
        <pre class="mono"
          style="padding: var(--space-2); background: var(--bg); border-radius: var(--radius-sm); margin-top: var(--space-1); overflow-x: auto">su -c "resetprop ro.vendor.gpp.frc.support true"
su -c "resetprop ro.vendor.xiaomi.sr.support true"
am force-stop com.miui.securitycenter</pre>
        <span class="muted">永久生效：把 JoyoseEdit 用 <span class="mono">npm run package:prop</span> 重打成带 system.prop 的 zip 重装即可（KSU / Magisk 会在开机阶段 resetprop 写入这两个 vendor flag）。</span>
      </div>
    </div>

    <div v-else-if="visionPartial" class="banner warn">
      <strong>vendor 能力半就绪</strong>
      <span>
        当前 <span class="mono">frc={{ vision?.frc_support || '空' }}</span>、<span class="mono">sr={{ vision?.sr_support ||
          '空' }}</span>。游戏助手只会显示 {{ vision?.frc_support === 'true' ? '"插帧"' : '"超分"' }} 开关。
      </span>
    </div>

    <div v-else-if="visionReady" class="banner" style="background: var(--surface-ok-bg, var(--bg-elevated))">
      <strong>vendor 层 FRC + SR 已就绪</strong>
      <span class="hint">游戏助手会显示画质增强面板，其余条件由本页控制。</span>
    </div>

    <div v-if="mivkStatus?.status === 'ok'" class="banner" style="background: var(--surface-ok-bg, var(--bg-elevated))">
      <strong>渲染通道已启用</strong>
      <span class="hint">
        {{ currentParsed?.pkg }}：<span class="mono">mifi:{{ mivkStatus.mifi }}</span>、<span class="mono">misr:{{
          mivkStatus.misr }}</span>，画面效果会正常生效。
      </span>
    </div>
    <div v-else-if="mivkStatus?.status === 'partial'" class="banner warn">
      <strong>渲染通道仅半启用</strong>
      <span class="hint">
        {{ currentParsed?.pkg }}：<span class="mono">mifi:{{ mivkStatus.mifi }}</span>、<span class="mono">misr:{{
          mivkStatus.misr }}</span>。等级为 0 的那一路画面不生效。
        推荐配置：原神 <span class="mono">31/31</span>、星铁 <span class="mono">31/7</span>。去 MIVK 面板调整即可。
      </span>
    </div>
    <div v-else-if="mivkStatus?.status === 'off'" class="banner error">
      <strong>渲染通道未启用</strong>
      <span class="hint">
        {{ currentParsed?.pkg }} 的 <span class="mono">mifi</span> / <span class="mono">misr</span> 等级都为 0。
        MIFISR 策略可以激活，但画面看不到效果。去 MIVK 面板把两者等级改为 <span class="mono">31</span>。
      </span>
    </div>
    <div v-else-if="mivkStatus?.status === 'missing'" class="banner error">
      <strong>MIVK 面板尚未配置 {{ currentParsed?.pkg }}</strong>
      <span class="hint">
        MIFISR 策略可以激活，但画面不会生效。请先在 MIVK 面板添加该包条目。
      </span>
    </div>

    <div v-if="whitelistMatch" class="banner" style="background: var(--surface-ok-bg, var(--bg-elevated))">
      <strong>该游戏在画面生效白名单内</strong>
      <span class="hint">
        匹配到 <strong>{{ whitelistMatch.name }}</strong>，后端：<span class="mono">{{ whitelistMatch.backends.join(' / ')
        }}</span>。
        <template v-if="whitelistMatch.source === 'inferred'">
          <br>⚠ 识别结果基于公开资料推断，若实机未激活请反馈。
        </template>
      </span>
    </div>
    <div v-else-if="currentParsed?.pkg" class="banner warn">
      <strong>该包不在已知白名单</strong>
      <span class="hint">
        MIFISR 策略可以激活，但画面上不会出现插帧 / 超分效果。若实机有效请反馈，便于后续补充。
      </span>
    </div>

    <div class="twopane">
      <div class="list">
        <div class="row" style="padding: 8px">
          <button class="primary" @click="addBlank">+ 新建条目</button>
          <button class="ghost" @click="addFromPreset">从预设</button>
        </div>
        <button v-for="(s, i) in entries" :key="i" class="item" :class="{ active: selected === i }"
          @click="selected = i">
          <strong>{{ displayPkg(s) }}</strong>
          <span class="sub">{{ s }}</span>
        </button>
        <div v-if="entries.length === 0" class="hint" style="padding: var(--space-3)">
          没有条目。点击"新建条目"添加，或从预设选一款 Ultra 同款游戏。
        </div>
      </div>

      <div v-if="currentParsed" class="detail stack">
        <div class="row">
          <strong class="mono">{{ currentParsed.pkg }}</strong>
          <button class="danger ghost" @click="removeCurrent" style="margin-left: auto">
            删除条目
          </button>
        </div>

        <div class="field">
          <label class="label">包名 pkg</label>
          <input v-model="currentParsed.pkg" @input="rewrite" />
        </div>

        <div class="grid-2">
          <div class="field">
            <label class="label">最小帧率 (-1 为自动)</label>
            <input type="number" step="1" v-model.number="currentParsed.minFps" @input="rewrite" />
          </div>
          <div class="field">
            <label class="label">目标帧率 (-1 为自动)</label>
            <input type="number" step="1" v-model.number="currentParsed.targetFps" @input="rewrite" />
          </div>
        </div>

        <div class="field">
          <label class="label">源帧率（逗号分隔，例 <span class="mono">45,60</span>）</label>
          <input v-model="srcFpsText" @change="rewriteFromSrcText" />
          <div class="hint">
            低于 45fps 的源帧率不被支持（<span class="mono">24</span> / <span class="mono">30</span> 会在校验时告警）。
          </div>
        </div>

        <div class="grid-4">
          <div class="field">
            <label class="label">温控 T1 (℃)</label>
            <input type="number" step="1" v-model.number="currentParsed.t1" @input="rewrite" />
          </div>
          <div class="field">
            <label class="label">温控 T2 (℃)</label>
            <input type="number" step="1" v-model.number="currentParsed.t2" @input="rewrite" />
          </div>
          <div class="field">
            <label class="label">温控 T3 (℃)</label>
            <input type="number" step="1" v-model.number="currentParsed.t3" @input="rewrite" />
          </div>
          <div class="field">
            <label class="label">温控 T4 (℃，最低)</label>
            <input type="number" step="1" v-model.number="currentParsed.t4" @input="rewrite" />
          </div>
        </div>

        <div class="row">
          <button class="ghost" @click="applyThermal(47, 45, 44, 42)">标准温控 47/45/44/42（Ultra 同款）</button>
          <button class="ghost" @click="applyThermal(95, 93, 92, 90)" title="散热充足时才建议；未经社区验证">激进温控
            95/93/92/90（未验证）</button>
        </div>

        <div class="panel" style="margin: 0; background: var(--bg-elevated)">
          <div class="label">序列化结果</div>
          <div class="mono" style="font-size: 12px; word-break: break-all">
            {{ entries[selected] }}
          </div>
          <div v-if="issues.length" class="stack" style="margin-top: var(--space-2)">
            <div v-for="(i, k) in issues" :key="k" class="tiny"
              :style="{ color: i.severity === 'warn' ? 'var(--text-muted)' : 'var(--warn)' }">
              <span v-if="i.severity === 'warn'">ℹ</span><span v-else>⚠</span>
              <span class="mono">{{ i.field }}</span>: {{ i.message }}
            </div>
          </div>
        </div>

        <div class="panel" style="margin: 0">
          <h2 style="font-size: 14px">画质增强策略 <small>按需组合 FI / SR / FISR</small></h2>
          <div class="row">
            <button @click="addFisrFeature('FI')" :disabled="hasFeature('FI')"
              :title="hasFeature('FI') ? '已存在' : '可能出现画面异常/输入延迟'">
              + FI（仅插帧）
            </button>
            <button @click="addFisrFeature('SR')" :disabled="hasFeature('SR')"
              :title="hasFeature('SR') ? '已存在' : '添加仅超分配置（Ultra 同款）'">
              + SR（仅超分）
            </button>
            <button @click="addFisrFeature('FISR')" :disabled="hasFeature('FISR')"
              :title="hasFeature('FISR') ? '已存在' : '插帧 + 超分同时开启，功耗/延迟风险最高'">
              + FISR（合体）
            </button>
            <label class="row" style="margin-left: auto; gap: var(--space-1)">
              <input type="checkbox" v-model="alsoUpdateMqs" />
              <span class="hint">同步写入 <span class="mono">mqs_enhance_list</span></span>
            </label>
          </div>
          <div v-if="routedPolicies && routedPolicies.length" class="stack"
            style="margin-top: var(--space-2); gap: var(--space-3)">
            <div v-for="p in routedPolicies" :key="p.feature" class="policy-card">
              <div class="row" style="justify-content: space-between; margin-bottom: var(--space-2)">
                <strong class="mono" style="font-size: 14px">{{ p.feature }}</strong>
                <button class="danger ghost" @click="removeFisrFeature(String(p.feature))"
                  :title="`移除 ${p.feature}`">删除</button>
              </div>

              <div class="stack" style="gap: var(--space-2)">
                <div class="field-line">
                  <span class="field-name mono">strategy</span>
                  <input type="text" class="mono field-input w-strategy" placeholder="MIFISR"
                    :value="(p.strategy as string) ?? ''"
                    @change="(e: Event) => setStrategy(p, (e.target as HTMLInputElement).value)" />
                  <span class="hint">参考: MIFISR、AFME、FSR、FRC 等</span>
                </div>

                <div class="field-line">
                  <span class="field-name mono">support_game_mode</span>
                  <label style="display: inline-flex; gap: 4px; align-items: center">
                    <input type="checkbox" :checked="gameModeBit(p, 0)"
                      @change="(e: Event) => setGameModeBit(p, 0, (e.target as HTMLInputElement).checked)" />
                    <span class="tiny">均衡</span>
                  </label>
                  <label style="display: inline-flex; gap: 4px; align-items: center; margin-left: var(--space-2)">
                    <input type="checkbox" :checked="gameModeBit(p, 1)"
                      @change="(e: Event) => setGameModeBit(p, 1, (e.target as HTMLInputElement).checked)" />
                    <span class="tiny">性能</span>
                  </label>
                  <span class="tiny muted mono" style="margin-left: var(--space-2)">{{ (p.support_game_mode as string)
                    ??
                    '—' }}</span>
                </div>

                <div v-if="needsMaxRefresh(p)" class="field-line">
                  <span class="field-name mono">support_max_refresh</span>
                  <span class="hint">智能插帧的刷新率上限，默认=60#120</span>
                  <input type="text" class="mono field-input w-refresh" :class="maxRefreshMissing(p) ? 'warn' : ''"
                    :value="(p.support_max_refresh as string) ?? ''"
                    :placeholder="maxRefreshMissing(p) ? 'default=60' : '默认: 60#120'"
                    @change="(e: Event) => setMaxRefresh(p, (e.target as HTMLInputElement).value)" />
                </div>

                <div class="field-line">
                  <span class="field-name mono">disable_scene_list</span>
                  <span class="hint">场景 ID，英文逗号分隔的，留空=不禁用</span>
                  <input type="text" class="mono field-input w-scene" placeholder="参考: 10004,1051"
                    :value="disableSceneText(p)"
                    @change="(e: Event) => setDisableSceneList(p, (e.target as HTMLInputElement).value)" />
                </div>

                <div class="field-line">
                  <span class="field-name mono">support_resolution_leave</span>
                  <span class="hint">分辨率 Level 白名单，留空=允许所有</span>
                  <input type="text" class="mono field-input w-refresh" placeholder="留空: 允许所有"
                    :value="(p.support_resolution_leave as string) ?? ''"
                    @change="(e: Event) => setResolutionLeave(p, (e.target as HTMLInputElement).value)" />
                </div>

                <div class="field-line">
                  <span class="field-name mono">switch_default_status</span>
                  <span class="hint">UI 开关初始位（均衡#性能），留空=0#0</span>
                  <input type="text" class="mono field-input w-flag" placeholder="留空: 0#0"
                    :value="(p.switch_default_status as string) ?? ''"
                    @change="(e: Event) => setSwitchDefaultStatus(p, (e.target as HTMLInputElement).value)" />
                </div>
              </div>
            </div>
          </div>
          <div v-else class="hint">该包还没有画质增强策略。点上面的 + FI / + SR / + FISR 按需添加。</div>

          <div v-if="hasMissingMaxRefresh" class="banner warn">
            <strong>⚠ FI / FISR 未设置最高刷新率</strong>
            <span class="hint">字段缺失时默认为 60Hz，FI 倍帧会被削回 60fps。144Hz 屏请改为 <span class="mono">60#144</span>。</span>
            <div class="banner-actions">
              <button class="primary" @click="fillMaxRefresh('60#120')" :disabled="state.loading">
                一键填 <span class="mono">60#120</span>
              </button>
            </div>
          </div>

          <div v-if="hasNoFiSr" class="banner error">
            <strong>⚠ 缺少 FI / SR 策略，画质增强面板不会显示</strong>
            <span class="hint">只保留 FISR 是无效的，必须至少有 FI 或 SR 之一。</span>
            <div class="banner-actions">
              <button class="primary" @click="addFisrFeature('SR')" :disabled="state.loading">补一条 SR</button>
            </div>
          </div>

          <div v-else-if="hasUselessFisr" class="banner warn">
            <strong>⚠ FISR 需要搭配 {{ missingFisrSibling }} 才能生效</strong>
            <span class="hint">合体模式必须同时存在 FI + SR，仅留 FISR 是无意义的。</span>
            <div class="banner-actions">
              <button class="primary" @click="addFisrFeature(missingFisrSibling as 'FI' | 'SR')"
                :disabled="state.loading">补一条 {{ missingFisrSibling }}</button>
            </div>
          </div>

          <div v-if="resolutionLeavePolicies.length" class="banner">
            <strong>ℹ 该配置限制了分辨率白名单</strong>
            <span class="hint">
              受限策略：<span class="mono">{{ resolutionLeaveSummary }}</span>。
              切换游戏画质档位后若勾选框消失，多半是该字段导致；可在 JSON 编辑页删除或改为当前档位。
            </span>
          </div>

          <div v-if="routedPolicies && routedPolicies.length" class="row"
            style="gap: var(--space-2); align-items: flex-start; border-top: 1px solid var(--border); padding-top: var(--space-3)">
            <label class="row" style="gap: var(--space-1)">
              <input type="checkbox" :checked="currentSupportVk"
                @change="(e: Event) => toggleSupportVk((e.target as HTMLInputElement).checked)" />
              <strong>支持 Vulkan</strong>
            </label>
            <div class="hint" style="flex: 1">
              <span v-if="isHkrpg" style="color: var(--warn)"><strong>★ 星铁必开</strong>：</span>
              该开关目前只对星铁生效。星铁登录进入 Vulkan 模式后若未开启，画质开关会消失；
              其他游戏不受影响，打开也无害。
            </div>
          </div>
        </div>

        <div class="panel" style="margin: 0; background: var(--bg-elevated)">
          <div class="hint">
            本页的策略统一为 MIFISR，与官方下发一致。想让画面真正看到插帧 / 超分效果，
            还需要去 <strong>MIVK 面板</strong>把对应游戏的 <span class="mono">mifi</span> / <span class="mono">misr</span>
            等级改为 <span class="mono">31</span>（Ultra 同款）。
          </div>
        </div>
      </div>

      <div v-else class="detail hint">从列表里选一条，或点击"新建条目"。</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { state, markDirty } from '@/state/session';
import * as bridge from '@/root/bridge';
import type { VisionStatus } from '@/root/bridge';
import {
  parseMifisr,
  serializeMifisr,
  blankMifisr,
  validateMifisr,
  type MifisrParams,
} from '@/parsers/mifisr-string';
import {
  STRATEGY_PRESETS,
  emptyFisrConfig,
  findGroupForPkg,
  upsertPkgPolicy,
  removePkg,
  addPolicyForPkg,
  removePolicyForPkg,
  isValidSupportGameMode,
  type FisrConfig,
  type FisrPolicy,
} from '@/parsers/fisr-config';
import { findByCmdline, getEntries, modulesOf } from '@/parsers/mivk-migl';
import { lookupKnownGame } from '@/presets/mifisr/known-games';
import { toast } from '@/state/toast';

import mifisrPresets from '@/presets/mifisr/index.json';
import { dialog } from '@/state/dialog';

const entries = computed<string[]>({
  get: () => {
    const gb = state.cloudConfig.booster_config?.params?.game_booster ?? {};
    return Array.isArray(gb.customize_game_params?.game_mifisr_config)
      ? gb.customize_game_params.game_mifisr_config
      : [];
  },
  set: (val: string[]) => {
    const gb = ensureGameBooster();
    if (!gb.customize_game_params) gb.customize_game_params = {};
    gb.customize_game_params.game_mifisr_config = val;
    markDirty();
  },
});

const alsoUpdateMqs = ref(true);
const selected = ref(0);
const currentParsed = ref<MifisrParams | null>(null);
const srcFpsText = ref('');

const mifisrSwitchOn = computed(
  () => state.cloudConfig.booster_config?.params?.game_booster?.fisr_mqs_v2 === true,
);

// `ro.vendor.gpp.frc.support` / `ro.vendor.xiaomi.sr.support` gate whether
// HyperOS's game-assistant UI will render the FI / SR controls at all. We read
// these once on mount and surface the state as a banner above; if both are
// missing, editing cloud DB is futile and the user must flip them separately.
const vision = ref<VisionStatus | null>(null);

onMounted(async () => {
  try {
    vision.value = await bridge.visionStatus();
  } catch {
    // Bridge unavailable (dev mode) or old module without the subcommand —
    // hide the banner silently in that case.
    vision.value = null;
  }
});

const visionFrcOn = computed(() => vision.value?.frc_support === 'true');
const visionSrOn = computed(() => vision.value?.sr_support === 'true');
const visionBlocked = computed(
  () => vision.value !== null && !visionFrcOn.value && !visionSrOn.value,
);
const visionPartial = computed(
  () => vision.value !== null && visionFrcOn.value !== visionSrOn.value,
);
const visionReady = computed(
  () => vision.value !== null && visionFrcOn.value && visionSrOn.value,
);

// MIFISR strategy (l.i) and MIVK xrender hooks are TWO INDEPENDENT channels:
// l.i.n/f never reads mivk_settings — it only flips strategy state, refresh
// rate, and stops old thermal/pid monitors. The actual on-screen FI/SR
// happens in a separate pipeline where q0.s (SmartPhoneTag_MiGLConfig) reads
// support_module ("mifi:<lvl>"/"misr:<lvl>") and decides which hooks to
// inject. With mifi:0 misr:0 the strategy still activates but the user sees
// no visual effect — surface the state so users don't assume DB edits alone
// are enough. Shape:
//   { status: 'ok' | 'partial' | 'off' | 'missing', mifi: number, misr: number }
// Returns null when no MIFISR entry is selected (so the banner hides cleanly).
// 检查当前包是否在 libmigl / libmivk 已知白名单内（基于反编译字符串表整理）。
// 不在白名单 → Joyose 策略层还会激活，但渲染层不会注册 Processor，画面无效果。
const whitelistMatch = computed(() => {
  const pkg = currentParsed.value?.pkg;
  if (!pkg) return null;
  return lookupKnownGame(pkg);
});

const mivkStatus = computed(() => {
  const pkg = currentParsed.value?.pkg;
  if (!pkg) return null;
  const gb = state.cloudConfig.booster_config?.params?.game_booster;
  if (!gb) return null;
  const mivkEntries = getEntries(gb, 'mivk');
  const entry = findByCmdline(mivkEntries, 'mivk', pkg);
  if (!entry) return { status: 'missing' as const, mifi: 0, misr: 0 };
  const modules = modulesOf(entry);
  const mifi = modules.find((m) => m.name === 'mifi')?.level ?? 0;
  const misr = modules.find((m) => m.name === 'misr')?.level ?? 0;
  let status: 'ok' | 'partial' | 'off';
  if (mifi > 0 && misr > 0) status = 'ok';
  else if (mifi > 0 || misr > 0) status = 'partial';
  else status = 'off';
  return { status, mifi, misr };
});

// Re-parse the current list entry when the list identity changes (add / remove)
// or when the user switches selection. Do NOT use deep watch: rewrite() mutates
// list[selected] in-place on every keystroke, and re-parsing transient NaN
// states would wipe currentParsed, destroying the form under the user's cursor.
watch(
  [() => entries.value.length, selected],
  () => {
    const e = entries.value;
    if (e.length === 0) {
      currentParsed.value = null;
      srcFpsText.value = '';
      return;
    }
    if (selected.value >= e.length) selected.value = 0;
    try {
      const parsed = parseMifisr(e[selected.value]);
      currentParsed.value = parsed;
      srcFpsText.value = parsed.srcFps.join(',');
    } catch {
      currentParsed.value = null;
      srcFpsText.value = '';
    }
  },
  { immediate: true },
);

const issues = computed(() =>
  currentParsed.value ? validateMifisr(currentParsed.value) : [],
);

const routedPolicies = computed(() => {
  if (!currentParsed.value) return null;
  const cfg = state.cloudConfig.booster_config?.params?.game_booster?.fisr_config as
    | FisrConfig
    | undefined;
  if (!cfg) return null;
  const group = findGroupForPkg(cfg, currentParsed.value.pkg);
  return group?.enhance_policy_config ?? null;
});

// support_vk is a group-level boolean on fisr_config.enhance_config[].
// Reverse-engineered: k.b.isSupportEnhance (and q.i.isSupportEnhance) only
// consults this flag when pkg == "com.miHoYo.hkrpg" AND VulkanModeRecognizer
// reports true. For every other package Joyose never even reads support_vk,
// so flipping it is harmless but pointless. That's why we surface the toggle
// for all packages (keeps the UI uniform / lets curious users experiment)
// but highlight it only for hkrpg.
const isHkrpg = computed(() => currentParsed.value?.pkg === 'com.miHoYo.hkrpg');

const currentSupportVk = computed(() => {
  if (!currentParsed.value) return false;
  const cfg = state.cloudConfig.booster_config?.params?.game_booster?.fisr_config as
    | FisrConfig
    | undefined;
  if (!cfg) return false;
  const group = findGroupForPkg(cfg, currentParsed.value.pkg);
  return group?.support_vk === true;
});

function toggleSupportVk(on: boolean) {
  if (!currentParsed.value) return;
  const cfg = state.cloudConfig.booster_config?.params?.game_booster?.fisr_config as
    | FisrConfig
    | undefined;
  if (!cfg) return;
  const group = findGroupForPkg(cfg, currentParsed.value.pkg);
  if (!group) return;
  group.support_vk = on;
  markDirty();
}

// support_max_refresh caps the FI output (l.i.r: min(gameFps*2, supportMaxFps)).
// It only matters for FI / FISR — SR doesn't double frames. A missing field
// defaults to 60 inside Joyose, silently negating FI even after activation.
function needsMaxRefresh(p: FisrPolicy): boolean {
  return p.feature === 'FI' || p.feature === 'FISR';
}

function maxRefreshMissing(p: FisrPolicy): boolean {
  if (!needsMaxRefresh(p)) return false;
  return typeof p.support_max_refresh !== 'string' || p.support_max_refresh.length === 0;
}

const hasMissingMaxRefresh = computed(() => {
  const list = routedPolicies.value ?? [];
  return list.some((p) => maxRefreshMissing(p as FisrPolicy));
});

function setMaxRefresh(p: FisrPolicy, value: string) {
  const v = value.trim();
  if (v === '') {
    delete p.support_max_refresh;
  } else {
    p.support_max_refresh = v;
  }
  markDirty();
}

function fillMaxRefresh(value: string) {
  const list = routedPolicies.value;
  if (!list) return;
  for (const p of list) {
    if (maxRefreshMissing(p as FisrPolicy)) {
      (p as FisrPolicy).support_max_refresh = value;
    }
  }
  markDirty();
  toast.success('已补齐 support_max_refresh', `所有缺字段的 FI/FISR policy → ${value}`);
}

// Combination guards. UI 只渲染 FI 和 SR 两个勾选框 (GameBoxVisionEnhanceUtils.s()),
// FISR 是"同时勾 FI+SR 时的合体升级",不是独立按钮。
// 整体面板是否显示,由 k.b.isSupportEnhance 决定,它只看 k.e.s(pkg) = FI 或 SR 命中,
// 完全不看 FISR —— 所以只有 FISR 没 FI/SR 会导致整个面板消失。
const hasNoFiSr = computed(() => {
  const list = routedPolicies.value;
  if (!list || list.length === 0) return false;
  return !list.some((p) => p.feature === 'FI') && !list.some((p) => p.feature === 'SR');
});

const missingFisrSibling = computed<'FI' | 'SR' | null>(() => {
  const list = routedPolicies.value;
  if (!list) return null;
  const hasFisr = list.some((p) => p.feature === 'FISR');
  if (!hasFisr) return null;
  const hasFi = list.some((p) => p.feature === 'FI');
  const hasSr = list.some((p) => p.feature === 'SR');
  if (hasFi && hasSr) return null;
  if (!hasFi && hasSr) return 'FI';
  if (hasFi && !hasSr) return 'SR';
  return null;
});

const hasUselessFisr = computed(() => missingFisrSibling.value !== null);

// support_resolution_leave is a comma-separated render-level whitelist; l.i.t()
// checks the current level against it BEFORE activation and silently bails on
// miss. Surface which policies carry this gate so users can match their game's
// current quality tier (or delete the field to allow all).
const resolutionLeavePolicies = computed(() => {
  const list = routedPolicies.value ?? [];
  return list.filter(
    (p) => typeof p.support_resolution_leave === 'string' && p.support_resolution_leave.length > 0,
  );
});

const resolutionLeaveSummary = computed(() =>
  resolutionLeavePolicies.value
    .map((p) => `${p.feature}=${p.support_resolution_leave}`)
    .join(', '),
);

function ensureGameBooster(): any {
  const cc = state.cloudConfig.booster_config;
  if (!cc) throw new Error('booster_config missing');
  if (!cc.params) cc.params = {};
  if (!cc.params.game_booster) cc.params.game_booster = {};
  return cc.params.game_booster;
}

function ensureMifisrList(): string[] {
  const gb = ensureGameBooster();
  if (!gb.customize_game_params) gb.customize_game_params = {};
  if (!Array.isArray(gb.customize_game_params.game_mifisr_config)) {
    gb.customize_game_params.game_mifisr_config = [];
  }
  return gb.customize_game_params.game_mifisr_config;
}

function displayPkg(s: string): string {
  const idx = s.indexOf('_');
  return idx < 0 ? s : s.slice(0, idx);
}

function disableSceneText(p: any): string {
  const list = Array.isArray(p?.disable_scene_list) ? p.disable_scene_list : [];
  return list.join(', ');
}

// support_game_mode is a 2-position bitmap "X#Y" where X = MGAME (均衡), Y = TGAME (性能).
// Parse the current bit at `idx` (0 = 均衡, 1 = 性能) as a boolean for the checkbox.
function gameModeBit(p: any, idx: 0 | 1): boolean {
  const raw = typeof p?.support_game_mode === 'string' ? p.support_game_mode : '';
  const parts = raw.split('#');
  if (parts.length !== 2) return false;
  return parts[idx] === '1';
}

// Write back one bit of support_game_mode. Mutates the policy in place and
// calls markDirty so pushAll sees the change. If the incoming raw value is
// malformed (not "X#Y" with X/Y ∈ {0,1}), Joyose's k.e.u() silently drops the
// per-mode check — we'd rather loudly re-normalize here than inherit a stale
// bad value. One toast per occurrence so the user knows it was repaired.
function setGameModeBit(p: any, idx: 0 | 1, on: boolean): void {
  const raw = p?.support_game_mode;
  if (raw != null && !isValidSupportGameMode(raw)) {
    toast.warn(
      'support_game_mode 格式非法，已重置',
      `原值 "${String(raw)}" 不是 X#Y（X/Y ∈ {0,1}）；Joyose 在非法格式下会静默忽略 mode 限制，已按当前勾选重建。`,
    );
  }
  const base: [string, string] = isValidSupportGameMode(raw) ? (raw.split('#') as [string, string]) : ['0', '0'];
  base[idx] = on ? '1' : '0';
  p.support_game_mode = `${base[0]}#${base[1]}`;
  markDirty();
}

// Allow editing `strategy` directly. Empty input falls back to MIFISR since
// every UI-driven policy on 17 series binds to it by default.
function setStrategy(p: FisrPolicy, value: string): void {
  const v = value.trim();
  p.strategy = v || 'MIFISR';
  markDirty();
}

// `disable_scene_list` is an integer array. Parse comma / whitespace separated
// input; drop empty tokens and non-integers silently rather than rejecting
// mid-edit. Empty input removes the field entirely.
function setDisableSceneList(p: FisrPolicy, value: string): void {
  const v = value.trim();
  if (v === '') {
    delete p.disable_scene_list;
  } else {
    const ids = v.split(/[,\s]+/)
      .map((s) => Number(s))
      .filter((n) => Number.isInteger(n));
    p.disable_scene_list = ids;
  }
  markDirty();
}

// `support_resolution_leave` is a comma-separated string of render levels.
// Keep it as the raw string — Joyose parses it itself. Empty removes the field.
function setResolutionLeave(p: FisrPolicy, value: string): void {
  const v = value.trim();
  if (v === '') {
    delete p.support_resolution_leave;
  } else {
    p.support_resolution_leave = v;
  }
  markDirty();
}

// `switch_default_status` is `X#Y` bitmap for the initial switch state.
// We don't strictly validate here — users may legitimately want values like
// `1#0`. Empty clears the field.
function setSwitchDefaultStatus(p: FisrPolicy, value: string): void {
  const v = value.trim();
  if (v === '') {
    delete p.switch_default_status;
  } else {
    p.switch_default_status = v;
  }
  markDirty();
}

function rewrite() {
  const p = currentParsed.value;
  if (!p) return;
  // Skip while the user is mid-edit (cleared a numeric field → NaN). Writing
  // "NaN" into the on-disk string would corrupt the list. We keep the last
  // valid serialized value there until the user types a finite number.
  const nums: number[] = [p.minFps, p.targetFps, p.t1, p.t2, p.t3, p.t4, ...p.srcFps];
  if (nums.some((n) => !Number.isFinite(n))) return;
  try {
    const serialized = serializeMifisr(p);
    const list = ensureMifisrList();
    list[selected.value] = serialized;
    markDirty();
  } catch (err) {
    console.warn('mifisr serialize failed:', err);
  }
}

function rewriteFromSrcText() {
  if (!currentParsed.value) return;
  const parts = srcFpsText.value
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const nums = parts.map(Number);
  if (nums.some((n) => !Number.isFinite(n))) {
    toast.error('srcFps 格式错误', '逗号分隔的正整数，如 60 或 45,60');
    return;
  }
  currentParsed.value.srcFps = nums;
  rewrite();
}

function addBlank() {
  const list = ensureMifisrList();
  const template = blankMifisr('com.example.newgame');
  list.push(serializeMifisr(template));
  selected.value = list.length - 1;
  markDirty();
}

async function addFromPreset() {
  if (mifisrPresets.length === 0) return;
  const value = await dialog.select(
    '从预设添加 MIFISR 条目',
    mifisrPresets.map((p, i) => ({
      label: p.label,
      value: String(i),
      detail: p.string,
    })),
    { detail: '选一款游戏：会追加一条 game_mifisr_config 并自动应用 MIFISR 路由。' },
  );
  if (value === null) return;
  const preset = mifisrPresets[Number(value)];
  if (!preset) return;
  const list = ensureMifisrList();
  list.push(preset.string);
  selected.value = list.length - 1;
  if (preset.route === 'mifisrStandard') {
    applyFisrPreset(preset.pkg);
  }
  markDirty();
}

function removeCurrent() {
  if (!currentParsed.value) return;
  const pkg = currentParsed.value.pkg;
  const gb = ensureGameBooster();
  const list = ensureMifisrList();
  list.splice(selected.value, 1);
  if (list.length === 0) {
    selected.value = 0;
  } else if (selected.value >= list.length) {
    selected.value = list.length - 1;
  }
  if (gb.fisr_config) removePkg(gb.fisr_config, pkg);
  removeFromMqs(pkg);
  removeFromDpFiConfig(pkg);
  markDirty();
}

// Feature→strategy is hardcoded by Joyose (see status code dispatch). We pull
// the 3 canonical policies out of mifisrStandard() so there's a single source
// of truth between "add one feature" (this file) and "apply whole preset"
// (addFromPreset path).
function policyForFeature(feature: 'FI' | 'SR' | 'FISR'): FisrPolicy {
  const found = STRATEGY_PRESETS.mifisrStandard().find((p) => p.feature === feature);
  if (!found) throw new Error(`no preset policy for ${feature}`);
  return found;
}

function hasFeature(feature: string): boolean {
  return routedPolicies.value?.some((p) => p.feature === feature) ?? false;
}

function addFisrFeature(feature: 'FI' | 'SR' | 'FISR') {
  if (!currentParsed.value) return;
  const pkg = currentParsed.value.pkg;
  const gb = ensureGameBooster();
  if (!gb.fisr_config) gb.fisr_config = emptyFisrConfig();
  const policy = policyForFeature(feature);
  const added = addPolicyForPkg(gb.fisr_config as FisrConfig, pkg, policy);
  if (!added) {
    toast.warn(`${feature} 已存在`, `${pkg} 的 fisr_config 里已有 ${feature} policy，未重复添加`);
    return;
  }
  // MIFISR doesn't read dp_fi_config (that's DMI's concern), so adding a
  // feature in the default preset flow doesn't need to touch it. dp_fi_config
  // sync is still available for expert users who manually switch a feature's
  // strategy to DMI in JsonEditorView.
  if (alsoUpdateMqs.value) addToMqs(pkg);
  markDirty();
  toast.success(`已添加 ${feature}`, `strategy=${policy.strategy}`);
}

function removeFisrFeature(feature: string) {
  if (!currentParsed.value) return;
  const pkg = currentParsed.value.pkg;
  const gb = ensureGameBooster();
  if (!gb.fisr_config) return;
  const removed = removePolicyForPkg(gb.fisr_config as FisrConfig, pkg, feature);
  if (!removed) return;
  markDirty();
  toast.success(`已移除 ${feature}`);
}

function applyFisrPreset(pkg: string) {
  const gb = ensureGameBooster();
  if (!gb.fisr_config) gb.fisr_config = emptyFisrConfig();
  upsertPkgPolicy(gb.fisr_config, pkg, STRATEGY_PRESETS.mifisrStandard());
  // MIFISR (the strategy all three policies bind to) doesn't read
  // dp_fi_config, so no sync here. dp_fi_config stays a manual / expert
  // concern via JsonEditorView when someone switches a feature to DMI.
  if (alsoUpdateMqs.value) addToMqs(pkg);
  markDirty();
}

function addToMqs(pkg: string) {
  const gb = ensureGameBooster();
  if (!Array.isArray(gb.mqs_enhance_list)) gb.mqs_enhance_list = [];
  const entry = `${pkg}:60#default`;
  if (!gb.mqs_enhance_list.some((s: string) => s === entry || s.startsWith(`${pkg}:`))) {
    gb.mqs_enhance_list.push(entry);
  }
}

function removeFromMqs(pkg: string) {
  const gb = ensureGameBooster();
  if (Array.isArray(gb.mqs_enhance_list)) {
    gb.mqs_enhance_list = gb.mqs_enhance_list.filter((s: string) => !s.startsWith(`${pkg}:`));
  }
}

// DMI (feature: "FI" strategy) reads `customize_game_params.dp_fi_config` at
// activation time to find a srcFps→targetFps mapping for the current game
// fps. No matching entry = l.b.q() returns -1 = "invaild targetFps" = FI
// aborts silently even though the UI checkbox is visible. So whenever the
// user applies the MIFISR preset, we derive a dp_fi_config entry from the
// current MifisrParams.srcFps list.
//
// Entry format: "<pkg>_<srcFps1,targetFps1>;<srcFps2,targetFps2>" — segments
// joined by ';' inside the value; the outer array holds one such string per
// package. l.b.q() also accepts 3-tuples (render,srcFps,targetFps) but we
// don't need them — leave that to JsonEditorView power users.
function deriveDpFiValue(srcFps: number[]): string {
  // Common interpolation targets on 120Hz panels. Cap at 120 so insertion
  // stays within device native refresh rates.
  return srcFps
    .filter((s) => Number.isFinite(s) && s > 0)
    .map((s) => {
      const target = s * 2 <= 120 ? s * 2 : 120;
      return `${s},${target}`;
    })
    .join(';');
}

function syncDpFiConfig(pkg: string, srcFpsOverride?: number[]): void {
  // Prefer the override (passed right after a list.push() when the watch
  // hasn't re-parsed currentParsed yet); otherwise fall back to currentParsed.
  const srcFps = srcFpsOverride
    ?? (currentParsed.value?.pkg === pkg ? currentParsed.value.srcFps : null);
  if (!srcFps) return;
  const gb = ensureGameBooster();
  if (!gb.customize_game_params) gb.customize_game_params = {};
  if (!Array.isArray(gb.customize_game_params.dp_fi_config)) {
    gb.customize_game_params.dp_fi_config = [];
  }
  const value = deriveDpFiValue(srcFps);
  if (!value) return;
  const entry = `${pkg}_${value}`;
  const list = gb.customize_game_params.dp_fi_config as string[];
  // Replace any existing entry for this pkg (prefix match split by '_').
  const idx = list.findIndex((s) => s.startsWith(`${pkg}_`));
  if (idx >= 0) list[idx] = entry;
  else list.push(entry);
}

function removeFromDpFiConfig(pkg: string): void {
  const gb = ensureGameBooster();
  const list = gb.customize_game_params?.dp_fi_config;
  if (!Array.isArray(list)) return;
  gb.customize_game_params.dp_fi_config = list.filter((s: string) => !s.startsWith(`${pkg}_`));
}

function applyThermal(t1: number, t2: number, t3: number, t4: number) {
  if (!currentParsed.value) return;
  currentParsed.value.t1 = t1;
  currentParsed.value.t2 = t2;
  currentParsed.value.t3 = t3;
  currentParsed.value.t4 = t4;
  rewrite();
}

function enableMifisrSwitch() {
  const gb = ensureGameBooster();
  gb.fisr_mqs_v2 = true;
  markDirty();
  toast.success('已开启 MIFISR 总开关', 'fisr_mqs_v2 = true');
}
</script>

<style scoped>
.policy-card {
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: var(--space-3);
}

.field-line {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.field-name {
  min-width: 180px;
  color: var(--text-muted);
  font-size: 12px;
}

.field-input.w-strategy {
  width: 140px;
}

.field-input.w-refresh {
  width: 120px;
}

.field-input.w-scene {
  width: 200px;
}

.field-input.w-flag {
  width: 80px;
}

@media (max-width: 480px) {
  .field-name {
    min-width: 100%;
  }

  .field-input {
    flex: 1 1 100%;
    width: 100%;
  }
}
</style>
