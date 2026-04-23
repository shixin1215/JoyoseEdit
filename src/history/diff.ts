// A compact JSON diff used by the edit-history view.
//
// Goals:
//  * Stable, dependency-free, small enough to inline in the bundle.
//  * Output shaped for human review, not for programmatic re-apply —
//    we keep full before/after blobs separately; this diff is just the
//    summary ("what paths changed, from what, to what").
//
// Output: a flat list of change records:
//   { path, kind: 'added' | 'removed' | 'changed', before?, after? }
// where `path` is a JSON-Pointer-like dot path with bracketed array indices.

export type DiffKind = 'added' | 'removed' | 'changed';

export interface DiffRecord {
  path: string;
  kind: DiffKind;
  before?: unknown;
  after?: unknown;
}

export interface DiffOptions {
  /** If true, arrays are diffed by index; otherwise arrays are treated as
   * opaque leaves (reported as a single "changed" when unequal). Array-index
   * diff is noisier but shows per-entry changes. */
  arraysByIndex?: boolean;
  /** Maximum recursion depth — safety-net against cyclic inputs. */
  maxDepth?: number;
}

const DEFAULT_OPTS: Required<DiffOptions> = {
  arraysByIndex: true,
  maxDepth: 200,
};

export function diff(
  before: unknown,
  after: unknown,
  options: DiffOptions = {},
): DiffRecord[] {
  const opts = { ...DEFAULT_OPTS, ...options };
  const records: DiffRecord[] = [];
  walk(before, after, '', 0, opts, records);
  return records;
}

function walk(
  a: unknown,
  b: unknown,
  path: string,
  depth: number,
  opts: Required<DiffOptions>,
  out: DiffRecord[],
): void {
  if (depth > opts.maxDepth) return;
  if (a === b) return;
  if (isPrimitive(a) || isPrimitive(b)) {
    if (!deepEqual(a, b)) {
      out.push({ path: path || '/', kind: 'changed', before: a, after: b });
    }
    return;
  }
  const aIsArr = Array.isArray(a);
  const bIsArr = Array.isArray(b);
  if (aIsArr !== bIsArr) {
    out.push({ path: path || '/', kind: 'changed', before: a, after: b });
    return;
  }
  if (aIsArr && bIsArr) {
    if (opts.arraysByIndex) {
      const max = Math.max(a.length, b.length);
      for (let i = 0; i < max; i++) {
        const p = `${path}[${i}]`;
        if (i >= a.length) out.push({ path: p, kind: 'added', after: b[i] });
        else if (i >= b.length) out.push({ path: p, kind: 'removed', before: a[i] });
        else walk(a[i], b[i], p, depth + 1, opts, out);
      }
    } else if (!deepEqual(a, b)) {
      out.push({ path: path || '/', kind: 'changed', before: a, after: b });
    }
    return;
  }
  // objects
  const ao = a as Record<string, unknown>;
  const bo = b as Record<string, unknown>;
  const keys = new Set([...Object.keys(ao), ...Object.keys(bo)]);
  for (const k of keys) {
    const p = path ? `${path}.${k}` : k;
    const hasA = Object.prototype.hasOwnProperty.call(ao, k);
    const hasB = Object.prototype.hasOwnProperty.call(bo, k);
    if (!hasA) out.push({ path: p, kind: 'added', after: bo[k] });
    else if (!hasB) out.push({ path: p, kind: 'removed', before: ao[k] });
    else walk(ao[k], bo[k], p, depth + 1, opts, out);
  }
}

function isPrimitive(v: unknown): boolean {
  return (
    v === null ||
    typeof v === 'boolean' ||
    typeof v === 'number' ||
    typeof v === 'string' ||
    typeof v === 'undefined'
  );
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (isPrimitive(a) || isPrimitive(b)) return false;
  const aIsArr = Array.isArray(a);
  const bIsArr = Array.isArray(b);
  if (aIsArr !== bIsArr) return false;
  if (aIsArr && bIsArr) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!deepEqual(a[i], b[i])) return false;
    return true;
  }
  const ao = a as Record<string, unknown>;
  const bo = b as Record<string, unknown>;
  const ak = Object.keys(ao);
  const bk = Object.keys(bo);
  if (ak.length !== bk.length) return false;
  for (const k of ak) {
    if (!Object.prototype.hasOwnProperty.call(bo, k)) return false;
    if (!deepEqual(ao[k], bo[k])) return false;
  }
  return true;
}

/** Parse a path produced by `diff()` into a sequence of segments.
 * Object keys are strings; array indices are numbers. */
export function parsePath(path: string): (string | number)[] {
  if (!path || path === '/') return [];
  const segs: (string | number)[] = [];
  for (const part of path.split('.')) {
    const m = /^([^\[]*)((?:\[\d+\])*)$/.exec(part);
    const name = m?.[1] ?? part;
    const brackets = m?.[2] ?? '';
    if (name) segs.push(name);
    for (const im of brackets.matchAll(/\[(\d+)\]/g)) segs.push(Number(im[1]));
  }
  return segs;
}

/** Apply a forward delta (produced by `diff(before, after)`) to a clone of
 * `snap` and return the result. Deltas are applied in REVERSE order so that
 * trailing-index array `removed` / `added` ops from `diff()` compose
 * correctly (splice-from-the-end semantics).
 *
 * Assumes `diff()` never decomposes a whole-branch add/remove into nested
 * records — so the parent of every affected leaf is guaranteed to exist in
 * the snapshot being mutated. That is how `diff()` at line 91/92 behaves:
 * absent keys emit a single `added`/`removed` carrying the full subtree. */
export function applyDelta<T>(snap: T, delta: DiffRecord[]): T {
  const out = JSON.parse(JSON.stringify(snap)) as T;
  for (let i = delta.length - 1; i >= 0; i--) {
    const d = delta[i];
    const segs = parsePath(d.path);
    if (segs.length === 0) continue;
    const parentSegs = segs.slice(0, -1);
    const last = segs[segs.length - 1];
    let parent: any = out;
    for (const s of parentSegs) {
      if (parent == null) { parent = null; break; }
      parent = parent[s];
    }
    if (parent == null) continue;
    if (d.kind === 'removed') {
      if (Array.isArray(parent) && typeof last === 'number') {
        parent.splice(last, 1);
      } else {
        delete parent[last];
      }
    } else {
      parent[last] = d.after;
    }
  }
  return out;
}

/** Invert a delta: applying `invertDelta(d)` after applying `d` yields the
 * original state. DiffRecord is invertible by construction (added ↔ removed,
 * changed swaps before/after). */
export function invertDelta(delta: DiffRecord[]): DiffRecord[] {
  return delta.map((d) => {
    switch (d.kind) {
      case 'added':
        return { path: d.path, kind: 'removed' as const, before: d.after };
      case 'removed':
        return { path: d.path, kind: 'added' as const, after: d.before };
      case 'changed':
        return { path: d.path, kind: 'changed' as const, before: d.after, after: d.before };
    }
  });
}

/** Abbreviate a DiffRecord for compact list display. Leaves long values
 * truncated with an ellipsis. */
export function summarizeRecord(r: DiffRecord, maxLen = 60): string {
  const render = (v: unknown) => {
    const s = typeof v === 'string' ? JSON.stringify(v) : JSON.stringify(v);
    return s && s.length > maxLen ? s.slice(0, maxLen - 1) + '…' : (s ?? 'undefined');
  };
  switch (r.kind) {
    case 'added':
      return `+ ${r.path} = ${render(r.after)}`;
    case 'removed':
      return `- ${r.path} (was ${render(r.before)})`;
    case 'changed':
      return `~ ${r.path}: ${render(r.before)} → ${render(r.after)}`;
  }
}
