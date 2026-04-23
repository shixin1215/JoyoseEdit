// MIFISR 支持游戏白名单
//
// 小米的 libmigl.so / libmivk.so 只为白名单里的游戏包名注册 GL/Vulkan hook。
// 包名不在此列表内的游戏，即使在 Joyose DB 里配了 customize_game_params +
// fisr_config，Joyose 策略层仍会激活（推 event 11 到 binder），但
// libmigl / libmivk 里没有对应的 Processor 响应 —— 画面上不会有插帧/超分效果。
//
// 数据来源：反编译 /system_ext/lib64/libmigl.so + libmivk.so 的字符串常量池，
// 时间节点 Xiaomi 17 Pro Max @ 2026-04-22。小米版本更新可能变动白名单。
//
// 包名后缀约定：
//   `.mi`         = 小米应用商店版本（MIUI 渠道 apk）
//   `.bilibili`   = B 服（哔哩哔哩渠道）
//   `oversea` 等  = 海外/国际发行版本

export type Backend = 'gl' | 'vk';

export interface KnownGame {
  /** 项目内部代号。对应独立 Processor 时等于 libmigl/libmivk 里的
   * `MiGL/MiVk<Code>Processor`；挂 `MiGLSharedProcessor` 的游戏代号前缀 `Shared/`。 */
  code: string;
  /** 中文名（含发行方，方便 UI 展示）。 */
  name: string;
  /** 支持的渲染后端：gl / vk / 两者都支持。 */
  backends: readonly Backend[];
  /** Android 应用包名（含渠道服变种）。 */
  packages: readonly string[];
  /**
   * 包名来源（严格定义）：
   * - 'decompiled' = 包名**字符串本身**在 libmigl/libmivk 反编译字符串表里出现
   * - 'inferred'   = 包名是根据 Processor 名猜的，反编译里没找到，实机未必对
   *
   */
  source: 'decompiled' | 'inferred';
}

export const KNOWN_GAMES: readonly KnownGame[] = [
  // === 独立 Processor 游戏（各自有 MiGL<Code>Processor / MiVk<Code>Processor）===
  {
    code: 'Yuanshen',
    name: '原神 / Genshin Impact（米哈游）',
    backends: ['gl', 'vk'],
    packages: [
      'com.miHoYo.Yuanshen',
      'com.miHoYo.GenshinImpact',
      'com.miHoYo.ys.mi',
      'com.miHoYo.ys.bilibili',
      'com.miHoYo.yuanshencb',
    ],
    source: 'decompiled',
  },
  {
    code: 'Hkrpg/StarRail',
    name: '崩坏：星穹铁道 / Honkai: Star Rail（米哈游）',
    backends: ['gl', 'vk'],
    packages: [
      'com.miHoYo.hkrpg',
      'com.miHoYo.hkrpg.bilibili',
      'com.HoYoverse.hkrpgoversea',
    ],
    source: 'decompiled',
  },
  {
    code: 'ZZZ',
    name: '绝区零（米哈游）',
    backends: ['vk'],
    packages: ['com.miHoYo.Nap', 'com.miHoYo.Nap.bilibili'],
    source: 'decompiled',
  },
  {
    code: 'MingChao',
    name: '鸣潮（库洛）',
    backends: ['vk'],
    // libmivk 里有 MiVkMingChaoProcessor 符号但反编译字符串表里**没有**发现包名。
    packages: ['com.kurogame.mingchao'],
    source: 'inferred',
  },
  {
    code: 'SGame',
    name: '王者荣耀（腾讯）',
    backends: ['gl', 'vk'],
    packages: ['com.tencent.tmgp.sgame', 'com.tencent.tmgp.sgamece'],
    source: 'decompiled',
  },
  {
    code: 'PUBG',
    name: '和平精英（腾讯）',
    backends: ['gl'],
    packages: ['com.tencent.tmgp.pubgmhd'],
    source: 'decompiled',
  },
  {
    code: 'Deltaforce',
    name: '三角洲行动（腾讯）',
    backends: ['vk'],
    packages: ['com.tencent.tmgp.dfm'],
    source: 'decompiled',
  },
  {
    code: 'LOLM',
    name: '英雄联盟手游 / LoL: Wild Rift（腾讯 / Riot）',
    backends: ['gl'],
    packages: ['com.tencent.lolm', 'com.riotgames.league.wildrift'],
    source: 'decompiled',
  },
  {
    code: 'JKChess',
    name: '金铲铲之战（腾讯）',
    backends: ['gl'],
    packages: ['com.tencent.jkchess'],
    source: 'decompiled',
  },
  {
    code: 'YuanMeng',
    name: '元梦之星（腾讯）',
    backends: ['gl'],
    packages: ['com.tencent.letsgo'],
    source: 'decompiled',
  },
  {
    code: 'Pokemon',
    name: '宝可梦大集结（腾讯）',
    backends: ['gl'],
    packages: ['com.tencent.pokemonunite.cn'],
    source: 'decompiled',
  },
  {
    code: 'DanZai',
    name: '蛋仔派对（网易）',
    backends: ['gl'],
    packages: ['com.netease.party', 'com.netease.party.mi'],
    source: 'decompiled',
  },
  {
    code: 'WPJS',
    name: '王牌竞速（网易）',
    backends: ['gl'],
    packages: ['com.netease.aceracer', 'com.netease.aceracer.mi'],
    source: 'decompiled',
  },
  {
    code: 'QNYH',
    name: '倩女幽魂（网易）',
    backends: ['gl'],
    packages: ['com.netease.l10', 'com.netease.l10.mi'],
    source: 'decompiled',
  },
  {
    code: 'PAJ',
    name: '决战平安京（网易）',
    backends: ['gl'],
    packages: ['com.netease.moba', 'com.netease.moba.mi'],
    source: 'decompiled',
  },
  {
    code: 'Antutu',
    name: '安兔兔',
    backends: ['vk'],
    // 安兔兔 3D 性能测试的 UE/Unreal 子进程。
    packages: [
      'com.antutu.benchmark.full:ue',
      'com.antutu.benchmark.full:unreal',
    ],
    source: 'decompiled',
  },

  // === 无独立 Processor 的游戏（挂 MiGLSharedProcessor）===
  {
    code: 'Shared/HarryPotter',
    name: '哈利波特：魔法觉醒（网易）',
    backends: ['gl'],
    packages: ['com.netease.harrypotter', 'com.netease.harrypotter.mi'],
    source: 'decompiled',
  },
  {
    code: 'Shared/HLDDZ',
    name: '欢乐斗地主（腾讯）',
    backends: ['gl'],
    packages: ['com.qqgame.hlddz'],
    source: 'decompiled',
  },
  {
    code: 'Shared/HappyMJ',
    name: '欢乐麻将（腾讯）',
    backends: ['gl'],
    packages: ['com.qqgame.happymj'],
    source: 'decompiled',
  },
  {
    code: 'Shared/TTXiangQi',
    name: '天天象棋（腾讯）',
    backends: ['gl'],
    packages: ['com.tencent.qqgame.xq'],
    source: 'decompiled',
  },
  {
    code: 'Shared/SGS',
    name: '三国杀（小米版）',
    backends: ['gl'],
    packages: ['com.bf.sgs.hdexp.mi'],
    source: 'decompiled',
  },
  {
    code: 'Shared/GuanDan',
    name: '掼蛋（小米版）',
    backends: ['gl'],
    packages: ['com.guandan.mi'],
    source: 'decompiled',
  },
  {
    code: 'Shared/XiDDZ',
    name: '欢喜斗地主（小米版）',
    backends: ['gl'],
    packages: ['com.qileyx.ddz.mi'],
    source: 'decompiled',
  },
  {
    code: 'Shared/XMXiangQi',
    name: '象棋（小米版）',
    backends: ['gl'],
    packages: ['com.wedobest.xiangqi.mi'],
    source: 'decompiled',
  },

  // === 非游戏（视频 app，可能做视频帧插值）===
  {
    code: 'Shared/QQLive',
    name: '腾讯视频（腾讯）',
    backends: ['gl'],
    // 非游戏——白名单里出现说明 MiGL hook 可能也做视频帧插值
    packages: ['com.tencent.qqlive'],
    source: 'decompiled',
  },
  {
    code: 'Shared/Aweme',
    name: '抖音（字节跳动）',
    backends: ['gl'],
    packages: ['com.ss.android.ugc.aweme'],
    source: 'decompiled',
  },
];

// 所有已知包名 → Game 的快速查找表。
const PACKAGE_INDEX = new Map<string, KnownGame>();
for (const g of KNOWN_GAMES) {
  for (const pkg of g.packages) PACKAGE_INDEX.set(pkg, g);
}

/** 按包名查对应游戏。未命中返回 null。 */
export function lookupKnownGame(pkg: string): KnownGame | null {
  return PACKAGE_INDEX.get(pkg) ?? null;
}
