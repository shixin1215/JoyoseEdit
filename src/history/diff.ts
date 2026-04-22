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
