// booster_config.params.game_booster.mivk_settings.app_params[*].xrender_config.support_module
// is a list of `name:level` strings:
//
//   ["mifi:0", "misr:7", "vrs:31", "drr:7", "gmem:0"]
//
// Level semantics: 0 = disabled, 1–7 = graded intensity, 31 = forced/max.
//
// migl_settings.game_params[*].xrender_config.support_module uses the same shape.

export const MODULE_LEVELS = [0, 1, 2, 3, 4, 5, 6, 7, 31] as const;
export type ModuleLevel = (typeof MODULE_LEVELS)[number];

export interface ModuleEntry {
  name: string;
  level: number;
}

const KNOWN_MODULES = new Set([
  'mifi',
  'misr',
  'vrs',
  'hsre',
  'alr',
  'sd',
  'drr',
  'gmem',
  'afme',
  'aptssao',
  'mrp',
]);

export function parseSupportModule(raw: string[] | undefined | null): ModuleEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((s) => {
    const idx = s.indexOf(':');
    if (idx < 0) return { name: s, level: 0 };
    return { name: s.slice(0, idx), level: Number(s.slice(idx + 1)) || 0 };
  });
}

export function serializeSupportModule(entries: ModuleEntry[]): string[] {
  return entries.map((e) => `${e.name}:${Number.isFinite(e.level) ? e.level : 0}`);
}

/** Immutably set / remove a module; returns a new array. */
export function withModule(
  entries: ModuleEntry[],
  name: string,
  level: number | null,
): ModuleEntry[] {
  if (level === null) return entries.filter((e) => e.name !== name);
  const next = entries.slice();
  const i = next.findIndex((e) => e.name === name);
  if (i >= 0) next[i] = { name, level };
  else next.push({ name, level });
  return next;
}

export function isKnownModule(name: string): boolean {
  return KNOWN_MODULES.has(name);
}
