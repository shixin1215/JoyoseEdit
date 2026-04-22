// Parser / serializer for the Novatek independent-display per-game string,
// as observed in game_booster.novatek_game_params on Redmi K70U / K80 Pro:
//
//   <pkg> _ <SetA> _ <SetGpu> _ <SetB>
//
// Where each Set is `#`-delimited, 6 or 7 fields, and the 3rd field carries
// CSV sub-values. Per user correction (2026-04-22):
//   SetA   = independent-display scheme A
//   SetGpu = GPU fallback (when the independent display is unavailable)
//   SetB   = independent-display scheme B
//
// Typical K70U example:
//   com.tencent.tmgp.sgame
//     _ 61#120#60,120,1,0x2514,0,0,0,0,0,0,1,1#45#43#43#41
//     _ 0#0#0,0,0,0,1,0x66,1,0x222,0,0,1,1,0x62,1,0x4#45#43#43#41
//     _ 61#120#60,120,1,0x2514,1,0x66,1,0x222,0,0,1,1,0x62,1,0x4#45#43#43#41
//
// Fields inside each Set (index-based):
//   [0] minFps
//   [1] targetFps
//   [2] csv — frame-rate-and-mode tuple (srcFps, modeFps, fiOn, modeFlag, ...sharpen, ...color, ...combo)
//   [3] T1
//   [4] T2
//   [5] T3
//   [6] T4
// Older entries are 4 thermal thresholds; a few rows carry the historical form.
// We keep the CSV verbatim (as `csv` array of strings) to avoid lossy re-typing
// of hex values like 0x2514 / 0x222 / 0x535 — the UI surfaces specific slots
// via helpers below.

export interface NovatekSet {
  minFps: string; // keep as string so "40.6" and "61" round-trip byte-for-byte
  targetFps: string;
  csv: string[];
  t1: string;
  t2: string;
  t3: string;
  t4: string;
}

export interface NovatekParams {
  pkg: string;
  setA: NovatekSet;
  setGpu: NovatekSet;
  setB: NovatekSet;
}

const HEX_OR_DEC = /^(0x[0-9a-fA-F]+|-?\d+(?:\.\d+)?)$/;

export function parseNovatek(raw: string): NovatekParams {
  if (typeof raw !== 'string') throw new TypeError('novatek: not a string');
  const parts = raw.split('_');
  if (parts.length !== 4) {
    throw new Error(
      `novatek: expected 4 underscore-delimited segments (pkg, setA, setGpu, setB), got ${parts.length}: ${raw}`,
    );
  }
  const [pkg, a, gpu, b] = parts;
  if (!pkg) throw new Error('novatek: empty package');
  return {
    pkg,
    setA: parseSet(a, 'setA'),
    setGpu: parseSet(gpu, 'setGpu'),
    setB: parseSet(b, 'setB'),
  };
}

function parseSet(raw: string, label: string): NovatekSet {
  const fields = raw.split('#');
  if (fields.length !== 7) {
    throw new Error(
      `novatek: ${label} expected 7 # fields, got ${fields.length}: "${raw}"`,
    );
  }
  const [minFps, targetFps, csv, t1, t2, t3, t4] = fields;
  return {
    minFps,
    targetFps,
    csv: csv.split(',').map((s) => s.trim()),
    t1,
    t2,
    t3,
    t4,
  };
}

export function serializeNovatek(p: NovatekParams): string {
  if (p.pkg.includes('_')) {
    throw new Error(`novatek: package "${p.pkg}" contains underscore`);
  }
  return [p.pkg, serializeSet(p.setA), serializeSet(p.setGpu), serializeSet(p.setB)].join('_');
}

function serializeSet(s: NovatekSet): string {
  if (s.csv.some((c) => c.includes('#'))) {
    throw new Error(`novatek: CSV element contains #: ${s.csv.join(',')}`);
  }
  return [s.minFps, s.targetFps, s.csv.join(','), s.t1, s.t2, s.t3, s.t4].join('#');
}

/** Decode a hex-or-decimal CSV slot into an integer (for UI numeric inputs). */
export function decodeSlot(v: string): number {
  if (v.startsWith('0x') || v.startsWith('0X')) return parseInt(v, 16);
  return Number(v);
}

export function encodeSlotHex(n: number, width = 4): string {
  return '0x' + n.toString(16).toUpperCase().padStart(width, '0');
}

/** Quick preset: overwrite all 4 thermal thresholds on every set. Used by
 * the "unlock temperature" one-click helper described in the plan. */
export function setThermal(p: NovatekParams, t1: string, t2: string, t3: string, t4: string): NovatekParams {
  for (const s of [p.setA, p.setGpu, p.setB]) {
    s.t1 = t1;
    s.t2 = t2;
    s.t3 = t3;
    s.t4 = t4;
  }
  return p;
}

export function blankNovatek(pkg: string): NovatekParams {
  const blankSet = (): NovatekSet => ({
    minFps: '0',
    targetFps: '0',
    csv: ['0', '0', '0', '0'],
    t1: '45',
    t2: '43',
    t3: '43',
    t4: '41',
  });
  return {
    pkg,
    setA: blankSet(),
    setGpu: blankSet(),
    setB: blankSet(),
  };
}

export interface NovatekValidationIssue {
  segment: 'setA' | 'setGpu' | 'setB';
  message: string;
}

/** Minimal validation: each non-empty numeric-looking slot must parse. */
export function validateNovatek(p: NovatekParams): NovatekValidationIssue[] {
  const issues: NovatekValidationIssue[] = [];
  for (const [seg, s] of [
    ['setA', p.setA],
    ['setGpu', p.setGpu],
    ['setB', p.setB],
  ] as const) {
    for (const slot of [s.minFps, s.targetFps, s.t1, s.t2, s.t3, s.t4]) {
      if (slot && !HEX_OR_DEC.test(slot)) {
        issues.push({ segment: seg, message: `bad numeric slot "${slot}"` });
      }
    }
    for (const v of s.csv) {
      if (v && !HEX_OR_DEC.test(v)) {
        issues.push({ segment: seg, message: `bad CSV slot "${v}"` });
      }
    }
  }
  return issues;
}
