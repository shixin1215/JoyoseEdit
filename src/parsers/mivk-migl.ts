// Helpers for editing MIVK / MIGL per-app renderer configuration under
// booster_config.params.game_booster.{mivk_settings,migl_settings}.
//
// MIVK is the Vulkan-channel module surface. app_params[] entries look like:
//   {
//     "app": "yuanshen",
//     "app_cmdlines": ["com.miHoYo.Yuanshen", ...],
//     "xrender_config": { "checkMainInfo": "1;1;UnityMain.*", "support_module": [...] },
//     "misr": { "backbuffer_size": "1920x883", "manual_sr_size_config": [...] },
//     "mifi": { "screen_vu_type": 2, ... },
//     "drr_static": { "config": "..." },
//     "gmem": { "image_dimension": "..." }
//   }
// MIGL (GL channel) uses `game` / `game_cmdlines` and similar sub-blocks.
//
// These helpers keep the read/write pattern symmetrical so the UI only
// needs one mental model across both channels.

import type { ModuleEntry } from './support-module';
import { parseSupportModule, serializeSupportModule } from './support-module';

export type Channel = 'mivk' | 'migl';

export interface XRenderConfig {
  checkMainInfo?: string;
  support_module?: string[];
  supoport_common_module?: unknown[]; // (sic — typo is in Joyose itself)
  [extra: string]: unknown;
}

export interface MivkAppParams {
  app: string;
  app_cmdlines: string[];
  xrender_config: XRenderConfig;
  [moduleBlock: string]: unknown;
}

export interface MiglGameParams {
  game: string;
  game_cmdlines: string[];
  params?: Record<string, unknown>;
  xrender_config: XRenderConfig;
  [moduleBlock: string]: unknown;
}

export type ChannelEntry = MivkAppParams | MiglGameParams;

export function nameKey(channel: Channel): 'app' | 'game' {
  return channel === 'mivk' ? 'app' : 'game';
}

export function cmdlinesKey(channel: Channel): 'app_cmdlines' | 'game_cmdlines' {
  return channel === 'mivk' ? 'app_cmdlines' : 'game_cmdlines';
}

export function getEntries(gameBooster: any, channel: Channel): ChannelEntry[] {
  if (channel === 'mivk') return gameBooster?.mivk_settings?.app_params ?? [];
  return gameBooster?.migl_settings?.game_params ?? [];
}

export function setEntries(gameBooster: any, channel: Channel, next: ChannelEntry[]): void {
  if (channel === 'mivk') {
    if (!gameBooster.mivk_settings) gameBooster.mivk_settings = { enable: true, app_params: [] };
    gameBooster.mivk_settings.app_params = next;
  } else {
    if (!gameBooster.migl_settings) gameBooster.migl_settings = { enable: true, game_params: [] };
    gameBooster.migl_settings.game_params = next;
  }
}

export function findByCmdline(entries: ChannelEntry[], channel: Channel, pkg: string): ChannelEntry | undefined {
  const ck = cmdlinesKey(channel);
  return entries.find((e) => ((e as any)[ck] as string[] | undefined)?.includes(pkg));
}

export function modulesOf(entry: ChannelEntry): ModuleEntry[] {
  return parseSupportModule(entry.xrender_config?.support_module);
}

export function setModules(entry: ChannelEntry, modules: ModuleEntry[]): void {
  if (!entry.xrender_config) entry.xrender_config = {};
  entry.xrender_config.support_module = serializeSupportModule(modules);
}

/** A fresh MIVK entry. Inherits a sensible default `checkMainInfo`. */
export function newMivkEntry(app: string, cmdlines: string[]): MivkAppParams {
  return {
    app,
    app_cmdlines: cmdlines.slice(),
    xrender_config: { checkMainInfo: '1;1;UnityMain.*', support_module: [] },
  };
}

export function newMiglEntry(game: string, cmdlines: string[]): MiglGameParams {
  return {
    game,
    game_cmdlines: cmdlines.slice(),
    params: {},
    xrender_config: { checkMainInfo: '1;UnityGfx.*', support_module: [] },
  };
}

/** Strip module sub-blocks whose name no longer appears in support_module. Used
 * when the user disables (removes) a module — we avoid leaving dead config. */
export function pruneOrphanedModuleBlocks(entry: ChannelEntry): void {
  const active = new Set(modulesOf(entry).map((m) => m.name));
  // retain a fixed allow-list of top-level structural keys
  const STRUCTURAL = new Set([
    'app',
    'game',
    'app_cmdlines',
    'game_cmdlines',
    'params',
    'xrender_config',
  ]);
  for (const key of Object.keys(entry)) {
    if (STRUCTURAL.has(key)) continue;
    // orphaned module block — delete only if the key looks like a known module slot
    if (!active.has(key) && isLikelyModuleBlock(key)) {
      delete (entry as any)[key];
    }
  }
}

function isLikelyModuleBlock(key: string): boolean {
  // mifi / misr / drr / drr_static / gmem / vrs / aptssao / hsre / alr / afme / sd / mrp
  return /^(mifi|misr|drr(_static)?|gmem|vrs|aptssao|hsre|alr|afme|sd|mrp)$/.test(key);
}
