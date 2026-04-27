// MIFISR 支持游戏白名单
//
// 小米 libmigl.so / libmivk.so 只为白名单包名注册 GL/Vulkan hook。包名不
// 在此列表的游戏，即使 Joyose DB 配齐 customize_game_params + fisr_config，
// 策略层激活了（推 event 11 到 binder），libmigl/libmivk 也没对应 Processor
// 响应——画面不会有插帧/超分。
//
// 数据来源：反编译 /system_ext/lib64/libmigl.so + libmivk.so 字符串常量池
// (Xiaomi 17 Pro Max @ 2026-04-27)。小米更新可能变动。
//
// 包名后缀：`.mi` = 小米渠道；`.bilibili` = B 服；`oversea` = 海外发行。

export type Backend = 'gl' | 'vk';

/**
 * 游戏引擎家族。`engine` 字段值的判定证据强度分两档：
 * - **DB 实证**：sample DB 里有对应 `xrender_CheckMainInfo` thread regex
 *   (Unity → `UnityMain.*` / `UnityGfx.*`，UE → `GameThread`)。
 * - **公开资料推断**：DB 里没下发，按公开公告 / 引擎社区 / 反编译可观测的特征
 *   推断；不确定就标 `unknown`。
 */
export type Engine =
  | 'unity-mihoyo'  // 米哈游深度定制 Unity（原神 / 星铁 / 绝区零）
  | 'unity-misc'    // 其他 Unity（王者 / JKChess / 宝可梦大集结 / 蛋仔 / etc.）
  | 'ue4'
  | 'ue5'
  | 'neoxng'        // 网易自研 NeoxNG（永劫无间系；目前只有倩女幽魂确认）
  | 'unknown';

export interface KnownGame {
  /** 项目内部代号。独立 Processor 游戏 = libmigl/libmivk 里的
   * `MiGL/MiVk<Code>Processor`；挂 `MiGLSharedProcessor` 的代号前缀 `Shared/`。 */
  code: string;
  /** 中文名（含发行方）。 */
  name: string;
  /** 支持的渲染后端。 */
  backends: readonly Backend[];
  /** Android 应用包名（含渠道服变种）。 */
  packages: readonly string[];
  /** 引擎家族（取值见 `Engine` 注释的判定标准）。 */
  engine: Engine;
  /**
   * 包名来源：
   * - 'decompiled' = 包名字符串本身在 libmigl/libmivk 反编译里出现
   * - 'inferred'   = 按 Processor 名推测，未在反编译字符串表里找到
   */
  source: 'decompiled' | 'inferred';
}

export const KNOWN_GAMES: readonly KnownGame[] = [
  // === 独立 Processor 游戏 ===
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
    engine: 'unity-mihoyo',
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
    engine: 'unity-mihoyo',
    source: 'decompiled',
  },
  {
    code: 'ZZZ',
    name: '绝区零（米哈游）',
    backends: ['vk'],
    packages: ['com.miHoYo.Nap', 'com.miHoYo.Nap.bilibili'],
    engine: 'unity-mihoyo',
    source: 'decompiled',
  },
  {
    code: 'MingChao',
    name: '鸣潮（库洛）',
    backends: ['vk'],
    // libmivk 里有 MiVkMingChaoProcessor 符号但反编译字符串表里**没有**发现包名。
    packages: ['com.kurogame.mingchao'],
    engine: 'ue4', // 库洛公开声明 UE4
    source: 'inferred',
  },
  {
    code: 'SGame',
    name: '王者荣耀（腾讯）',
    backends: ['gl', 'vk'],
    packages: ['com.tencent.tmgp.sgame', 'com.tencent.tmgp.sgamece'],
    // sample DB MIGL thread regex `4;UnityGfx.*|ShaderCompileWo` 直接证明 Unity。
    engine: 'unity-misc',
    source: 'decompiled',
  },
  {
    code: 'PUBG',
    name: '和平精英（腾讯）',
    backends: ['gl'],
    packages: ['com.tencent.tmgp.pubgmhd'],
    engine: 'ue4',
    source: 'decompiled',
  },
  {
    code: 'Deltaforce',
    name: '三角洲行动（腾讯）',
    backends: ['vk'],
    packages: ['com.tencent.tmgp.dfm'],
    engine: 'ue5', // 腾讯官宣 UE5
    source: 'decompiled',
  },
  {
    code: 'LOLM',
    name: '英雄联盟手游 / LoL: Wild Rift（腾讯 / Riot）',
    backends: ['gl'],
    packages: ['com.tencent.lolm', 'com.riotgames.league.wildrift'],
    engine: 'ue4',
    source: 'decompiled',
  },
  {
    code: 'JKChess',
    name: '金铲铲之战（腾讯）',
    backends: ['gl'],
    packages: ['com.tencent.jkchess'],
    // sample DB MIGL thread regex `1;UnityGfx.*` 证明 Unity。
    engine: 'unity-misc',
    source: 'decompiled',
  },
  {
    code: 'YuanMeng',
    name: '元梦之星（腾讯）',
    backends: ['gl'],
    packages: ['com.tencent.letsgo'],
    // 公开资料矛盾：部分来源称 Unity，部分称 UE。无 DB 实证，标 unknown。
    engine: 'unknown',
    source: 'decompiled',
  },
  {
    code: 'Pokemon',
    name: '宝可梦大集结（腾讯）',
    backends: ['gl'],
    packages: ['com.tencent.pokemonunite.cn'],
    engine: 'unity-misc', // Pokemon Unite 公开使用 Unity (TiMi)
    source: 'decompiled',
  },
  {
    code: 'DanZai',
    name: '蛋仔派对（网易）',
    backends: ['gl'],
    packages: ['com.netease.party', 'com.netease.party.mi'],
    engine: 'unity-misc', // 公开资料一致：Unity
    source: 'decompiled',
  },
  {
    code: 'WPJS',
    name: '王牌竞速（网易）',
    backends: ['gl'],
    packages: ['com.netease.aceracer', 'com.netease.aceracer.mi'],
    // NetEase Messiah（Unity 派生）or Unity 直接？无 DB 实证，标 unknown。
    engine: 'unknown',
    source: 'decompiled',
  },
  {
    code: 'QNYH',
    name: '倩女幽魂（网易）',
    backends: ['gl'],
    packages: ['com.netease.l10', 'com.netease.l10.mi'],
    engine: 'neoxng', // NetEase 自研 NeoxNG
    source: 'decompiled',
  },
  {
    code: 'PAJ',
    name: '决战平安京（网易）',
    backends: ['gl'],
    packages: ['com.netease.moba', 'com.netease.moba.mi'],
    engine: 'unity-misc', // 阴阳师系列均为 Unity
    source: 'decompiled',
  },
  {
    code: 'Antutu',
    name: '安兔兔',
    backends: ['vk'],
    // 安兔兔 3D 性能测试的 UE/Unreal 子进程；DB MIVK thread regex `GameThread` 实证。
    packages: [
      'com.antutu.benchmark.full:ue',
      'com.antutu.benchmark.full:unreal',
    ],
    engine: 'ue4',
    source: 'decompiled',
  },

  // === 无独立 Processor，挂 MiGLSharedProcessor ===
  {
    code: 'Shared/HarryPotter',
    name: '哈利波特：魔法觉醒（网易）',
    backends: ['gl'],
    packages: ['com.netease.harrypotter', 'com.netease.harrypotter.mi'],
    engine: 'unity-misc',
    source: 'decompiled',
  },
  {
    code: 'Shared/HLDDZ',
    name: '欢乐斗地主（腾讯）',
    backends: ['gl'],
    packages: ['com.qqgame.hlddz'],
    engine: 'unknown',
    source: 'decompiled',
  },
  {
    code: 'Shared/HappyMJ',
    name: '欢乐麻将（腾讯）',
    backends: ['gl'],
    packages: ['com.qqgame.happymj'],
    engine: 'unknown',
    source: 'decompiled',
  },
  {
    code: 'Shared/TTXiangQi',
    name: '天天象棋（腾讯）',
    backends: ['gl'],
    packages: ['com.tencent.qqgame.xq'],
    engine: 'unknown',
    source: 'decompiled',
  },
  {
    code: 'Shared/SGS',
    name: '三国杀（小米版）',
    backends: ['gl'],
    packages: ['com.bf.sgs.hdexp.mi'],
    engine: 'unknown',
    source: 'decompiled',
  },
  {
    code: 'Shared/GuanDan',
    name: '掼蛋（小米版）',
    backends: ['gl'],
    packages: ['com.guandan.mi'],
    engine: 'unknown',
    source: 'decompiled',
  },
  {
    code: 'Shared/XiDDZ',
    name: '欢喜斗地主（小米版）',
    backends: ['gl'],
    packages: ['com.qileyx.ddz.mi'],
    engine: 'unknown',
    source: 'decompiled',
  },
  {
    code: 'Shared/XMXiangQi',
    name: '象棋（小米版）',
    backends: ['gl'],
    packages: ['com.wedobest.xiangqi.mi'],
    engine: 'unknown',
    source: 'decompiled',
  },

  // === 非游戏：视频 app（白名单里出现说明 MiGL hook 也做视频帧插值）===
  {
    code: 'Shared/QQLive',
    name: '腾讯视频（腾讯）',
    backends: ['gl'],
    packages: ['com.tencent.qqlive'],
    engine: 'unknown',
    source: 'decompiled',
  },
  {
    code: 'Shared/Aweme',
    name: '抖音（字节跳动）',
    backends: ['gl'],
    packages: ['com.ss.android.ugc.aweme'],
    engine: 'unknown',
    source: 'decompiled',
  },
];

// 包名 → Game 快速查找。
const PACKAGE_INDEX = new Map<string, KnownGame>();
for (const g of KNOWN_GAMES) {
  for (const pkg of g.packages) PACKAGE_INDEX.set(pkg, g);
}

/** 按包名查对应游戏。未命中返回 null。 */
export function lookupKnownGame(pkg: string): KnownGame | null {
  return PACKAGE_INDEX.get(pkg) ?? null;
}
