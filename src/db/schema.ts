// Typed view of the two Joyose DBs, plus the path-detection logic that drives
// which editor panels the UI should activate.

export interface CloudConfigRow {
  _id?: number;
  config_name: string;
  group_name: string | null;
  enable: number | null;
  version: number | null;
  with_model: number | null;
  model: string | null;
  params: string | null;
  anchor: string | null;
  anchor_percents: string | null;
  anchor_values: string | null;
  value_type: string | null;
  final_value: string | null;
}

export interface RulesRow {
  _id?: number;
  rule_id: number | null;
  rule_version: number | null;
  rule_module: string | null;
  rule_content: string | null;
}

export interface ParsedBoosterConfig {
  header?: {
    version?: string;
    [extra: string]: unknown;
  };
  game_booster?: Record<string, unknown>;
  [extra: string]: unknown;
}

export interface ParsedCommonConfig {
  game_list?: string[];
  support_app?: string[];
  [extra: string]: unknown;
}

export type V3PathId = 'novatek' | 'qualcomm' | 'mifisr' | 'mivk' | 'migl';

export interface V3PathStatus {
  id: V3PathId;
  active: boolean;
  count: number;
  /** Human-readable note the overview should show next to the path. */
  note: string;
}

const AFME_FRC_FSR = new Set(['AFME', 'FRC', 'FSR']);
const MIFISR_STRATEGIES = new Set(['MIFISR']);

/** Which insertion backend this device actually uses. `null` means the device
 * has no Joyose insertion capability we can detect (e.g. freshly-installed
 * module, non-V3 ROM, empty cloud payload). */
export type ActiveBackend = 'mifisr' | 'qualcomm' | 'novatek' | null;

function collectFisrStrategies(fisrConfig: any): Set<string> {
  const out = new Set<string>();
  if (!fisrConfig?.enhance_config) return out;
  for (const group of fisrConfig.enhance_config) {
    for (const p of group.enhance_policy_config ?? []) {
      if (typeof p.strategy === 'string') out.add(p.strategy);
    }
  }
  return out;
}

/** Inspect a parsed booster_config.params tree and report which V3 paths are
 * live on this device. The UI uses this to light up / grey out panels. */
export function detectPaths(booster: ParsedBoosterConfig): V3PathStatus[] {
  const gb = (booster.game_booster ?? {}) as Record<string, any>;

  const novatekParams = Array.isArray(gb.novatek_game_params) ? gb.novatek_game_params : null;
  const frcParams = Array.isArray(gb.frc_game_params) ? gb.frc_game_params : null;
  const mifisrEntries = Array.isArray(gb.customize_game_params?.game_mifisr_config)
    ? gb.customize_game_params.game_mifisr_config
    : null;
  const fisrConfig = gb.fisr_config;
  const mivkApps = gb.mivk_settings?.app_params;
  const miglGames = gb.migl_settings?.game_params;

  const fisrStrategies = collectFisrStrategies(fisrConfig);
  const hasNtStrategy = [...fisrStrategies].some((s) => s.startsWith('NT#'));
  const hasQcomStrategy = [...fisrStrategies].some((s) => AFME_FRC_FSR.has(s));
  const hasMifisrStrategy = [...fisrStrategies].some((s) => MIFISR_STRATEGIES.has(s));
  const mifisrSwitchOn = gb.fisr_mqs_v2 === true;

  const statuses: V3PathStatus[] = [];

  statuses.push({
    id: 'novatek',
    active: Boolean(novatekParams) || hasNtStrategy,
    count: novatekParams?.length ?? 0,
    note: novatekParams
      ? `novatek_game_params: ${novatekParams.length} entries`
      : hasNtStrategy
        ? 'strategy references NT#* but no novatek_game_params'
        : 'not downloaded — Novatek independent display not present',
  });

  statuses.push({
    id: 'qualcomm',
    active: Boolean(frcParams) || hasQcomStrategy,
    count: frcParams?.length ?? 0,
    note: frcParams
      ? `frc_game_params: ${frcParams.length} entries`
      : hasQcomStrategy
        ? 'strategy references AFME/FRC/FSR but no frc_game_params'
        : 'no frc_game_params / fisr_config — ready to create entries',
  });

  statuses.push({
    id: 'mifisr',
    active: Boolean(mifisrEntries) || hasMifisrStrategy || mifisrSwitchOn,
    count: mifisrEntries?.length ?? 0,
    note: mifisrEntries
      ? `customize_game_params.game_mifisr_config: ${mifisrEntries.length} entries`
      : hasMifisrStrategy
        ? 'strategy references MIFISR but no customize_game_params'
        : mifisrSwitchOn
          ? 'fisr_mqs_v2 is true — MIFISR-capable, awaiting entries'
          : 'MIFISR not available on this device',
  });

  statuses.push({
    id: 'mivk',
    active: Array.isArray(mivkApps),
    count: Array.isArray(mivkApps) ? mivkApps.length : 0,
    note: Array.isArray(mivkApps)
      ? `mivk_settings.app_params: ${mivkApps.length} entries`
      : 'mivk_settings missing',
  });

  statuses.push({
    id: 'migl',
    active: Array.isArray(miglGames),
    count: Array.isArray(miglGames) ? miglGames.length : 0,
    note: Array.isArray(miglGames)
      ? `migl_settings.game_params: ${miglGames.length} entries`
      : 'migl_settings missing',
  });

  return statuses;
}

/** Decide the single insertion backend that should be exposed to the user on
 * this device. Priority: Novatek (independent-display hardware) > MIFISR
 * (8 Elite 2 / 17 series) > Qualcomm legacy (8 Elite / 15 series).
 *
 * Detection uses *data signals*, not hardware SoC, because users care about
 * what Joyose can currently use, and the cloud payload is the authoritative
 * source for that. Notably, `fisr_mqs_v2 === true` alone is enough to classify
 * as MIFISR even when the cloud hasn't shipped actual entries yet — this is
 * the "17 Pro Max awaiting data" case where the user still wants the MIFISR
 * panel open for from-scratch authoring.
 *
 * Intentional non-signals (both proven false by cross-device comparison):
 *   - `key_mivk_gputuner_select_enable`: true on 17 PM, absent on 17 Ultra
 *     despite Ultra MIFISR working fine; therefore not a MIFISR marker.
 *   - `vrs_soc`: describes the SoC family, not Joyose config state.
 */
export function detectActiveBackend(booster: ParsedBoosterConfig): ActiveBackend {
  const gb = (booster.game_booster ?? {}) as Record<string, any>;
  const fisrStrategies = collectFisrStrategies(gb.fisr_config);

  const hasNovatekData =
    Array.isArray(gb.novatek_game_params) ||
    Array.isArray(gb.novatek_extend_config?.novatek_game_params_ext) ||
    Array.isArray(gb.novatek_black_app) ||
    [...fisrStrategies].some((s) => s.startsWith('NT#'));
  if (hasNovatekData) return 'novatek';

  const hasMifisrData =
    gb.fisr_mqs_v2 === true ||
    Array.isArray(gb.customize_game_params?.game_mifisr_config) ||
    [...fisrStrategies].some((s) => MIFISR_STRATEGIES.has(s));
  if (hasMifisrData) return 'mifisr';

  const hasQualcommData =
    Array.isArray(gb.frc_game_params) ||
    [...fisrStrategies].some((s) => AFME_FRC_FSR.has(s));
  if (hasQualcommData) return 'qualcomm';

  return null;
}

/** Safely parse the `params` column of a cloud_config row; treats empty
 * string / null as an empty object. */
export function parseParams<T = unknown>(raw: string | null | undefined): T {
  if (!raw) return {} as T;
  return JSON.parse(raw) as T;
}

export function stringifyParams(obj: unknown): string {
  return JSON.stringify(obj);
}

/** Canonical fingerprint of a DB file: "mtime#size". Used by the WebUI to
 * detect concurrent modification between pull and push. */
export function fingerprint(mtime: number, size: number): string {
  return `${mtime}#${size}`;
}
