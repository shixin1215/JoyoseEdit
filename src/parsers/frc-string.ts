// Parser / serializer for the Qualcomm-GPU (AFME+FRC+FSR) per-game frame-insertion
// string format, as observed in booster_config.params.game_booster.frc_game_params
// on Mi 15 / Mi 15 Pro:
//
//   <pkg>_<minFps>_<targetFps>_<srcFps>_<modeFps>_<T1>_<T2>_<T3>_<T4>_<resolution>_<fi>_<sr>
//
// Example: com.miHoYo.hkrpg_45_90_30_60_47_46.5_43_41_1080x2400_1_1
//
// Underscore is the ONLY delimiter. The package name must therefore not contain
// underscores — in practice this holds for the packages that ship with frame
// insertion support, but we still guard against it explicitly.

export interface FrcParams {
  pkg: string;
  minFps: number;
  targetFps: number;
  srcFps: number;
  modeFps: number;
  t1: number;
  t2: number;
  t3: number;
  t4: number;
  /** `1080x2400` style, or `0x0` to mean "not constrained". */
  resolution: string;
  /** 0 = off, 1 = on */
  fi: 0 | 1;
  /** 0 = off, 1 = on */
  sr: 0 | 1;
}

const RES_RE = /^\d+x\d+$/i;

/** Parse a single frc string into its 12 fields. Throws on malformed input. */
export function parseFrc(raw: string): FrcParams {
  if (typeof raw !== 'string') throw new TypeError('frc: not a string');
  const parts = raw.split('_');
  if (parts.length !== 12) {
    throw new Error(`frc: expected 12 underscore-delimited fields, got ${parts.length}: ${raw}`);
  }
  const [pkg, minFps, targetFps, srcFps, modeFps, t1, t2, t3, t4, resolution, fi, sr] = parts;
  if (!pkg) throw new Error('frc: empty package');
  if (!RES_RE.test(resolution)) {
    throw new Error(`frc: invalid resolution "${resolution}" — must be NxN (e.g. 1080x2400 or 0x0)`);
  }
  if (fi !== '0' && fi !== '1') throw new Error(`frc: fi must be 0|1, got "${fi}"`);
  if (sr !== '0' && sr !== '1') throw new Error(`frc: sr must be 0|1, got "${sr}"`);
  return {
    pkg,
    minFps: num(minFps, 'minFps'),
    targetFps: num(targetFps, 'targetFps'),
    srcFps: num(srcFps, 'srcFps'),
    modeFps: num(modeFps, 'modeFps'),
    t1: num(t1, 't1'),
    t2: num(t2, 't2'),
    t3: num(t3, 't3'),
    t4: num(t4, 't4'),
    resolution,
    fi: fi === '1' ? 1 : 0,
    sr: sr === '1' ? 1 : 0,
  };
}

/** Round-trip to the canonical on-disk form. Preserves the original decimal
 * representation for temperatures (so `46.5` stays `46.5`, not `46.5000001`). */
export function serializeFrc(p: FrcParams): string {
  if (p.pkg.includes('_')) {
    throw new Error(`frc: package "${p.pkg}" contains underscore — format uses _ as delimiter`);
  }
  if (!RES_RE.test(p.resolution)) {
    throw new Error(`frc: invalid resolution "${p.resolution}"`);
  }
  return [
    p.pkg,
    fmt(p.minFps),
    fmt(p.targetFps),
    fmt(p.srcFps),
    fmt(p.modeFps),
    fmt(p.t1),
    fmt(p.t2),
    fmt(p.t3),
    fmt(p.t4),
    p.resolution,
    p.fi ? '1' : '0',
    p.sr ? '1' : '0',
  ].join('_');
}

export interface FrcValidationIssue {
  field: keyof FrcParams | 'relation';
  message: string;
}

/** Cross-field validation. Returns a list of issues — empty = OK. Does not
 * throw, so the UI can show issues alongside a partially-valid form. */
export function validateFrc(p: FrcParams, supportedRefreshRates?: number[]): FrcValidationIssue[] {
  const issues: FrcValidationIssue[] = [];

  for (const k of ['minFps', 'targetFps', 'srcFps', 'modeFps', 't1', 't2', 't3', 't4'] as const) {
    if (!Number.isFinite(p[k]) || p[k] < 0) {
      issues.push({ field: k, message: `must be non-negative number` });
    }
  }

  if (p.targetFps > 0 && p.srcFps > 0) {
    if (p.minFps > 0 && p.minFps < p.srcFps + 1) {
      issues.push({
        field: 'relation',
        message: `minFps (${p.minFps}) must be >= srcFps + 1 (${p.srcFps + 1}) when FI is active`,
      });
    }
    if (p.targetFps % p.srcFps !== 0) {
      issues.push({
        field: 'relation',
        message: `targetFps (${p.targetFps}) should be an integer multiple of srcFps (${p.srcFps})`,
      });
    }
  }

  if (supportedRefreshRates && supportedRefreshRates.length > 0 && p.targetFps > 0) {
    if (!supportedRefreshRates.includes(p.targetFps)) {
      issues.push({
        field: 'targetFps',
        message: `targetFps ${p.targetFps} not in device native refresh rates [${supportedRefreshRates.join(', ')}]`,
      });
    }
  }

  // thermal thresholds: T1 >= T2 >= T3 >= T4 is the usual shape (downshift thresholds).
  if (p.t1 > 0 && p.t2 > 0 && p.t3 > 0 && p.t4 > 0) {
    if (!(p.t1 >= p.t2 && p.t2 >= p.t3 && p.t3 >= p.t4)) {
      issues.push({
        field: 'relation',
        message: `thermal thresholds should be non-increasing: T1 >= T2 >= T3 >= T4`,
      });
    }
  }

  return issues;
}

export function blankFrc(pkg = ''): FrcParams {
  return {
    pkg,
    minFps: 45,
    targetFps: 90,
    srcFps: 30,
    modeFps: 60,
    t1: 47,
    t2: 46.5,
    t3: 43,
    t4: 41,
    resolution: '0x0',
    fi: 1,
    sr: 1,
  };
}

function num(v: string, label: string): number {
  if (v === '' || v == null) throw new Error(`frc: ${label} is empty`);
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(`frc: ${label} "${v}" is not a finite number`);
  return n;
}

// Keep the textual form the user sees (e.g. `46.5`) rather than JS's default
// Number.toString which can round-trip to `46.5` correctly but might produce
// `46.500000000001` under arithmetic. We accept canonical decimals only.
function fmt(n: number): string {
  if (Number.isInteger(n)) return String(n);
  // trim trailing zeros from Number.toString output
  return String(n);
}
