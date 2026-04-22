<template>
  <div class="stack">
    <div class="panel">
      <h2>MIFISR<br>
        <small>customize_game_params.game_mifisr_config + fisr_config (strategy=MIFISR)</small>
      </h2>
      <div class="muted tiny">
        适用于骁龙 8 Elite 2 的小米 17 系列（17 / 17 Pro / 17 Pro Max / 17 Ultra）。
        MIFISR = <span class="mono">mifi</span>（小米帧插值）+ <span class="mono">misr</span>（小米超分辨率）的混合后端，
        替代老的 AFME+FSR 组合。每条字符串以
        <span
          class="mono">&lt;pkg&gt;_&lt;min&gt;#&lt;target&gt;#&lt;srcFpsList&gt;#&lt;T1&gt;#&lt;T2&gt;#&lt;T3&gt;#&lt;T4&gt;</span>
        为格式；<span class="mono">-1</span> 表示让驱动自动决定。
      </div>
    </div>

    <div v-if="!mifisrSwitchOn" class="banner error">
      <strong>MIFISR 总开关 <span class="mono">fisr_mqs_v2</span> 未开启</strong>
      <span>必须为 <span class="mono">true</span> 才会让 Joyose 走 MIFISR 后端。否则改再多条目也不会生效。</span>
      <button class="primary" @click="enableMifisrSwitch">一键开启</button>
    </div>

    <div v-if="visionBlocked" class="banner error">
      <strong>游戏助手不会显示画质增强面板</strong>
      <div class="tiny" style="margin-top: 6px; line-height: 1.6">
        本机 vendor 层未声明
        <span class="mono">ro.vendor.gpp.frc.support</span> /
        <span class="mono">ro.vendor.xiaomi.sr.support</span>
        （当前值：<span class="mono">frc={{ vision?.frc_support || '空' }}</span>、<span class="mono">sr={{ vision?.sr_support
          || '空' }}</span>），
        HyperOS <span class="mono">GameBoxVisionEnhanceUtils</span> 的能力检查会返回 false，
        悬浮窗直接不渲染"插帧 / 超分"勾选框 —— 本页配置多完整都不会生效。
        <br><br>
        <strong>修复方法</strong>（需要自己处理，本模块不会自动改系统属性）：
        <pre class="mono"
          style="padding: 8px; background: var(--bg); border-radius: 4px; margin-top: 4px; overflow-x: auto">su -c "resetprop ro.vendor.gpp.frc.support true"
su -c "resetprop ro.vendor.xiaomi.sr.support true"
am force-stop com.miui.securitycenter</pre>
        <span class="muted">临时验证（重启失效）用上面；永久方案需要专门的 KSU / magisk 模块在 <span class="mono">post-fs-data.sh</span> 做同样
          resetprop，或改 <span class="mono">/vendor/build.prop</span>。</span>
      </div>
    </div>

    <div v-else-if="visionPartial" class="banner warn">
      <strong>vendor 能力半就绪</strong>
      <span>
        <span class="mono">frc={{ vision?.frc_support || '空' }}</span>、<span class="mono">sr={{ vision?.sr_support ||
          '空' }}</span>
        —— 悬浮窗只会出现 {{ vision?.frc_support === 'true' ? '"插帧"' : '"超分"' }} 勾选框，另一个依然不会渲染。
      </span>
    </div>

    <div v-else-if="visionReady" class="banner" style="background: var(--surface-ok-bg, var(--bg-elevated))">
      <strong>vendor 层 FRC + SR 已就绪</strong>
      <span class="tiny muted">
        <span class="mono">ro.vendor.gpp.frc.support=true</span>、<span
          class="mono">ro.vendor.xiaomi.sr.support=true</span><br>
        —— HyperOS 游戏助手会渲染画质增强面板，剩余条件由本页控制。
      </span>
    </div>

    <div v-if="mivkStatus?.status === 'ok'" class="banner" style="background: var(--surface-ok-bg, var(--bg-elevated))">
      <strong>渲染通道 mifi / misr 已启用</strong>
      <span class="tiny muted">
        当前包 <span class="mono">{{ currentParsed?.pkg }}</span>：
        <span class="mono">mifi:{{ mivkStatus.mifi }}</span>、<span class="mono">misr:{{ mivkStatus.misr }}</span>
        —— 画面侧的帧插值 / 超分 hook 会注入；与策略层配合后效果完整。level 调整请去 MIVK 面板。
      </span>
    </div>
    <div v-else-if="mivkStatus?.status === 'partial'" class="banner warn">
      <strong>渲染通道仅半启用</strong>
      <span class="tiny">
        当前包 <span class="mono">{{ currentParsed?.pkg }}</span>：
        <span class="mono">mifi:{{ mivkStatus.mifi }}</span>、<span class="mono">misr:{{ mivkStatus.misr }}</span>
        —— level 为 0 的那一路的渲染 hook 不注入（但 MIFISR 策略能正常激活）。想看到完整的插帧 + 超分效果，
        需要两者都 &gt; 0（17 Ultra 原神 <span class="mono">31/31</span>、星铁 <span class="mono">31/7</span>）。
        前往 MIVK 面板把 0 的那个改为 <span class="mono">31</span>。
      </span>
    </div>
    <div v-else-if="mivkStatus?.status === 'off'" class="banner error">
      <strong>渲染通道 mifi / misr 都为 0</strong>
      <span class="tiny">
        当前包 <span class="mono">{{ currentParsed?.pkg }}</span> 在 <span class="mono">mivk_settings</span> 里存在、
        但 <span class="mono">support_module</span> 没激活 <span class="mono">mifi</span> / <span class="mono">misr</span>。
        <strong>MIFISR 策略仍会激活</strong>（Joyose 策略层不依赖这个配置），
        但渲染层 hook 不注入，画面上看不到插帧 / 超分效果。去 MIVK 面板把两者 level 改为
        <span class="mono">31</span> 才能让"策略 + 画面"双到位。
      </span>
    </div>
    <div v-else-if="mivkStatus?.status === 'missing'" class="banner error">
      <strong>MIVK 里没有 <span class="mono">{{ currentParsed?.pkg }}</span> 条目</strong>
      <span class="tiny">
        <span class="mono">mivk_settings.app_params</span> 里找不到该包的 <span class="mono">app_cmdlines</span>，
        渲染 hook 注入该进程时没有对应 <span class="mono">support_module</span> 可读，mifi / misr module 不会启用。
        MIFISR 策略仍可激活，但画面上不会出现插帧 / 超分效果。请先在 MIVK 面板添加该包条目。
      </span>
    </div>

    <div v-if="whitelistMatch" class="banner" style="background: var(--surface-ok-bg, var(--bg-elevated))">
      <strong>该游戏在 libmigl / libmivk 白名单内</strong>
      <span class="tiny muted">
        匹配到 <strong>{{ whitelistMatch.name }}</strong>（代号 <span class="mono">{{ whitelistMatch.code }}</span>，
        后端：<span class="mono">{{ whitelistMatch.backends.join(' / ') }}</span>）。
        <template v-if="whitelistMatch.source === 'inferred'">
          <br>⚠ 此游戏的包名未从反编译字符串表直接确认（基于公开资料推断），若实机未激活请反馈。
        </template>
      </span>
    </div>
    <div v-else-if="currentParsed?.pkg" class="banner warn">
      <strong>该包不在已知白名单</strong>
      <span class="tiny">
        <span class="mono">{{ currentParsed.pkg }}</span> 没出现在 libmigl / libmivk 的已知游戏列表里。
        Joyose 策略层仍会接受配置并推 event 11，但**渲染层 hook 不会为该包注册 Processor** ——
        画面上不会出现插帧 / 超分效果。已知白名单见
        <span class="mono">src/presets/mifisr/known-games.ts</span>；若该游戏实机确实有效，请反馈补充。
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
        <div v-if="entries.length === 0" class="muted tiny" style="padding: 12px">
          没有条目 —— 点击 "新建条目" 添加第一个，或 "从预设" 选一款 Ultra 同款游戏。
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
            <label class="label">minFps（-1 = 驱动自动）</label>
            <input type="number" step="1" v-model.number="currentParsed.minFps" @input="rewrite" />
          </div>
          <div class="field">
            <label class="label">targetFps（-1 = 驱动自动）</label>
            <input type="number" step="1" v-model.number="currentParsed.targetFps" @input="rewrite" />
          </div>
        </div>

        <div class="field">
          <label class="label">srcFps 列表（逗号分隔，原神 <span class="mono">45,60</span> / 星铁 <span
              class="mono">60</span>）</label>
          <input v-model="srcFpsText" @change="rewriteFromSrcText" />
          <div class="tiny muted" style="margin-top: 4px">
            MIFISR 不接受低于 45fps 的源帧率（<span class="mono">24</span> / <span class="mono">30</span> 会在校验时告警）。
          </div>
        </div>

        <div class="grid-4">
          <div class="field">
            <label class="label">T1 (降档阈值)</label>
            <input type="number" step="1" v-model.number="currentParsed.t1" @input="rewrite" />
          </div>
          <div class="field">
            <label class="label">T2</label>
            <input type="number" step="1" v-model.number="currentParsed.t2" @input="rewrite" />
          </div>
          <div class="field">
            <label class="label">T3</label>
            <input type="number" step="1" v-model.number="currentParsed.t3" @input="rewrite" />
          </div>
          <div class="field">
            <label class="label">T4 (最低)</label>
            <input type="number" step="1" v-model.number="currentParsed.t4" @input="rewrite" />
          </div>
        </div>

        <div class="row">
          <button class="ghost" @click="applyThermal(47, 45, 44, 42)">标准温控 47/45/44/42 (Ultra 同款)</button>
          <button class="ghost" @click="applyThermal(95, 93, 92, 90)" title="社区未验证；散热足够激进时才建议">激进温控
            95/93/92/90（未验证）</button>
        </div>

        <div class="panel" style="margin: 0; background: var(--bg-elevated)">
          <div class="label">序列化结果</div>
          <div class="mono" style="font-size: 12px; word-break: break-all">
            {{ entries[selected] }}
          </div>
          <div v-if="issues.length" class="stack" style="margin-top: 8px">
            <div v-for="(i, k) in issues" :key="k" class="tiny"
              :style="{ color: i.severity === 'warn' ? 'var(--text-muted)' : 'var(--warn)' }">
              <span v-if="i.severity === 'warn'">ℹ</span><span v-else>⚠</span>
              <span class="mono">{{ i.field }}</span>: {{ i.message }}
            </div>
          </div>
        </div>

        <div class="panel" style="margin: 0">
          <h2 style="font-size: 14px">fisr_config 路由<br>
            <small>逐条添加 FI / SR / FISR，按需组合</small>
          </h2>
          <div class="row">
            <button @click="addFisrFeature('FI')" :disabled="hasFeature('FI')"
              :title="hasFeature('FI') ? '已存在，重复添加被阻止' : '⚠ 实验：Ultra 云控未下发此 feature（status=1），官方未验证；可能出现 artifact / 输入延迟 / 功耗升高'">
              + FI（仅插帧）⚠
            </button>
            <button @click="addFisrFeature('SR')" :disabled="hasFeature('SR')"
              :title="hasFeature('SR') ? '已存在，重复添加被阻止' : '添加仅超分 policy（Ultra 云控原厂下发的唯一配置，strategy=MIFISR）'">
              + SR（仅超分）
            </button>
            <button @click="addFisrFeature('FISR')" :disabled="hasFeature('FISR')"
              :title="hasFeature('FISR') ? '已存在，重复添加被阻止' : '⚠ 实验：Ultra 云控未下发合体模式（status=4），官方未验证；插帧+超分叠加的功耗 / 延迟风险最高'">
              + FISR（合体）⚠
            </button>
            <label class="row" style="margin-left: auto; gap: 6px">
              <input type="checkbox" v-model="alsoUpdateMqs" />
              <span class="tiny muted">添加时同步写入 <span class="mono">mqs_enhance_list</span></span>
            </label>
          </div>
          <div class="tiny muted" style="margin-top: 4px">
            每条 <span class="mono">feature</span> 都推荐绑 <span class="mono">strategy=MIFISR</span>。Joyose 在
            <span class="mono">setEnhanceStatus</span> 时会把 MIFISR 实例按 status 码（FI=1 / SR=2 / FISR=4）
            动态校准，一个 MIFISR 能扮演三种 feature，无需按 feature 区分 strategy；17 Ultra 云控原厂
            下发的就是 <span class="mono">SR + MIFISR</span>。
          </div>
          <table class="table" v-if="routedPolicies && routedPolicies.length" style="margin-top: 8px">
            <thead>
              <tr>
                <th>feature</th>
                <th>strategy</th>
                <th style="white-space: nowrap">均衡 / 性能 <small class="muted">(bitmap)</small></th>
                <th style="white-space: nowrap">support_max_refresh <small class="muted">(MGAME#TGAME)</small></th>
                <th>disable_scene_list</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="p in routedPolicies" :key="p.feature">
                <td><strong class="mono">{{ p.feature }}</strong></td>
                <td class="mono">{{ p.strategy }}</td>
                <td style="white-space: nowrap">
                  <label class="row" style="gap: 4px; display: inline-flex">
                    <input type="checkbox" :checked="gameModeBit(p, 0)"
                      @change="(e: Event) => setGameModeBit(p, 0, (e.target as HTMLInputElement).checked)" />
                    <span class="tiny">均衡</span>
                  </label>
                  <label class="row" style="gap: 4px; display: inline-flex; margin-left: 8px">
                    <input type="checkbox" :checked="gameModeBit(p, 1)"
                      @change="(e: Event) => setGameModeBit(p, 1, (e.target as HTMLInputElement).checked)" />
                    <span class="tiny">性能</span>
                  </label>
                  <span class="tiny muted mono" style="margin-left: 8px">{{ (p.support_game_mode as string) ?? '—'
                    }}</span>
                </td>
                <td>
                  <input v-if="needsMaxRefresh(p)" type="text" class="mono"
                    :class="maxRefreshMissing(p) ? 'warn' : ''"
                    style="width: 92px; padding: 2px 6px; font-size: 12px"
                    :value="(p.support_max_refresh as string) ?? ''"
                    :placeholder="maxRefreshMissing(p) ? 'default=60 ⚠' : '120#120'"
                    @change="(e: Event) => setMaxRefresh(p, (e.target as HTMLInputElement).value)" />
                  <span v-else class="tiny muted" title="SR 是空间超分，Joyose l.i.n() 的 SR 分支不读此字段">—</span>
                </td>
                <td class="mono tiny">{{ disableSceneText(p) || '—' }}</td>
                <td>
                  <button class="danger ghost" @click="removeFisrFeature(String(p.feature))"
                    :title="`移除 ${p.feature} policy`">删除</button>
                </td>
              </tr>
            </tbody>
          </table>
          <div v-else class="muted tiny">该包还没有 fisr_config 路由 —— 点上面的 + FI / + SR / + FISR 按钮按需添加。</div>

          <div v-if="hasMissingMaxRefresh" class="banner warn" style="margin-top: 8px">
            <strong>⚠ FI / FISR policy 缺 <span class="mono">support_max_refresh</span> 字段。</strong>
            Joyose 的 <span class="mono">l.i.r()</span> 会用此字段 clamp FI 倍帧目标刷新率，字段缺失时**默认 60Hz** ——
            意味着 FI 策略激活了但实际没倍帧（60fps 源 × 2 = 120fps 被 <span class="mono">min(120, 60) = 60</span> 削回去）。
            <button class="primary" style="margin-left: 8px" @click="fillMaxRefresh('120#120')" :disabled="state.loading">
              一键填 <span class="mono">120#120</span>
            </button>
            <span class="tiny muted" style="margin-left: 6px">（144Hz 屏可手动改 144#144）</span>
          </div>

          <div v-if="hasNoFiSr" class="banner error" style="margin-top: 8px">
            <strong>⚠ FI 和 SR policy 都缺失 —— 游戏助手整个画质增强面板会消失。</strong>
            反编译 <span class="mono">k.b.isSupportEnhance</span> 里 <span class="mono">k.e.s(pkg) = o(pkg,false) || p(pkg,false)</span>
            只查 FI 或 SR feature 是否在列表里，**完全不看 FISR**。列表里只剩 FISR 时 <span class="mono">s()</span> 返回 false，
            <span class="mono">isSupportEnhance</span> 返回 0，securitycenter 端 <span class="mono">f25826d = false</span>，面板不渲染。
            <button class="primary" style="margin-left: 8px" @click="addFisrFeature('SR')" :disabled="state.loading">
              补一条 SR policy
            </button>
          </div>

          <div v-else-if="hasUselessFisr" class="banner warn" style="margin-top: 8px">
            <strong>⚠ FISR policy 存在但缺 {{ missingFisrSibling }}，等于没效。</strong>
            securitycenter UI 只渲染"智能插帧 / 超级分辨率"两个勾选框（反编译 <span class="mono">GameBoxVisionEnhanceUtils.s()</span>
            返回的 list 固定就这两项，没有独立"FISR"按钮）。FISR 激活的唯一路径是"同时勾 FI + SR"触发
            <span class="mono">t0(fi=true, sr=true, 4)</span>。{{ missingFisrSibling }} policy 缺失时 UI 压根不显示
            那个勾选框，合体条件永远不满足 —— FISR policy 白存。
            <button class="primary" style="margin-left: 8px"
              @click="addFisrFeature(missingFisrSibling as 'FI' | 'SR')" :disabled="state.loading">
              补一条 {{ missingFisrSibling }} policy
            </button>
          </div>

          <div v-if="resolutionLeavePolicies.length" class="banner" style="margin-top: 8px">
            <strong>ℹ <span class="mono">support_resolution_leave</span> 限制分辨率白名单</strong>
            — 下列 policy 填了这个字段：<span class="mono">{{ resolutionLeaveSummary }}</span>。
            反编译 <span class="mono">l.i.t(pkg, status)</span> 在激活前会把当前游戏渲染分辨率 level 和这份逗号列表对比，
            不命中就打 <span class="mono">"invalid render resolution, ... ignore"</span> warning 并**静默拒绝激活**。
            Ultra 原厂 hkrpg SR policy 写的就是 <span class="mono">"4"</span>（只允许最高档）。
            <strong>如果你在游戏里切了画质档位后发现勾选框消失，先怀疑这个字段</strong> —
            去 JsonEditorView 把它删掉就无限制，或者填进当前用的 level。
          </div>

          <div v-if="hasFisrBreaksFi" class="banner warn" style="margin-top: 8px">
            <strong>⚠ 存在 <span class="mono">FISR</span> policy 会导致 FI（智能插帧）画面异常，不建议添加。</strong>
            实机测试（2026-04-23，星铁）确认：<span class="mono">fisr_config</span> 同时含
            <span class="mono">FI + SR + FISR</span> 三条 policy 时，libmivk 的
            <span class="mono">MiVkStarRailMIFIModule</span> 会走"合体共享分支"注册 FI hook，
            motion vector 采样按 SR 升采样后的坐标系对齐。此时无论单开 FI 还是 FI+SR 合体，
            FI 部分都会出 artifact；SR 单开不受影响。
            只保留 <span class="mono">FI + SR</span> 两条（无 FISR）则 FI 和 SR 分别单开都正常。
            Ultra 云控原厂对每款游戏只下发 <span class="mono">feature: SR</span>
            正是规避此问题。
            <button class="primary" style="margin-left: 8px"
              @click="removeFisrFeature('FISR')" :disabled="state.loading">
              删除 FISR policy
            </button>
          </div>

          <div v-if="routedPolicies && routedPolicies.length" class="row"
            style="margin-top: 10px; gap: 8px; align-items: flex-start; border-top: 1px solid var(--border); padding-top: 10px">
            <label class="row" style="gap: 6px">
              <input type="checkbox" :checked="currentSupportVk"
                @change="(e: Event) => toggleSupportVk((e.target as HTMLInputElement).checked)" />
              <strong class="mono">support_vk</strong>
            </label>
            <div class="tiny muted" style="flex: 1">
              <span v-if="isHkrpg" style="color: var(--warn)"><strong>★ 星铁必开</strong>：</span>
              本 group 级别的开关，反编译 <span class="mono">k.b.isSupportEnhance</span>
              显示 Joyose **只对 <span class="mono">com.miHoYo.hkrpg</span>** 做了"是否 VK 模式 + support_vk"
              的联合守卫：游戏启动在 GL 菜单时勾选框会显示，登录进入 Vulkan pipeline 后
              如果 <span class="mono">support_vk != true</span>，日志打印
              <span class="mono">"hkrpg in vk mode but not support vk"</span> 并把勾选框隐藏。
              其他游戏没这个守卫，开不开都一样，但打开也无害。
            </div>
          </div>
        </div>

        <div class="panel" style="margin: 0; background: var(--bg-elevated)">
          <div class="tiny muted">
            提示：本页所有 policy 默认绑 <span class="mono">strategy=MIFISR</span>（对齐 17 Ultra 云控原厂下发），
            MIFISR 不读 <span class="mono">dp_fi_config</span> —— 本页不会自动写它。如果在 JsonEditorView 里手动
            把某条 policy 的 strategy 改成 <span class="mono">DMI</span>，记得同步维护 <span class="mono">customize_game_params.dp_fi_config</span>
            里对应包名的 <span class="mono">&lt;pkg&gt;_&lt;srcFps,targetFps&gt;</span> 条目，否则 DMI 激活时会静默中止。
            <br><br>
            另外，Joyose 的 MIFISR 策略层本身不依赖 MIVK —— 本页配齐
            <span class="mono">customize_game_params</span> + <span class="mono">fisr_config</span> 就能让策略激活。
            但画面上真正看到帧插值 / 超分效果还需要 <strong>MIVK / MIGL</strong> 面板里把对应 app 的
            <span class="mono">support_module</span> 中 <span class="mono">mifi</span> 和 <span class="mono">misr</span>
            的 level 从 <span class="mono">0</span> 改成 <span class="mono">31</span>（17 Ultra 同款）—— 那是独立的渲染
            hook 注入通道，和策略层是两条并列开关。
          </div>
        </div>
      </div>

      <div v-else class="detail muted tiny">在左侧选一条，或点击"新建条目"。</div>
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

// FISR policy 的存在会让 libmivk MiVkStarRailMIFIModule 分叉 FI hook 到"合体共享
// 分支",导致开 FI 画面异常(2026-04-23 星铁实测)。只保留 FI+SR 两条时
// FI 和 SR 单开都正常。和 hasUselessFisr 互斥 — 只在三条都在时提示。
const hasFisrBreaksFi = computed(() => {
  const list = routedPolicies.value ?? [];
  const hasFi = list.some((p) => p.feature === 'FI');
  const hasSr = list.some((p) => p.feature === 'SR');
  const hasFisr = list.some((p) => p.feature === 'FISR');
  return hasFi && hasSr && hasFisr;
});

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
