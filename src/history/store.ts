// Append-only edit history.
// Every push generates one file under /data/adb/joyose-edit/history/<epoch>-<seq>.json
// whose contents are a `HistoryRecord`. The store is monotonic: rollback
// writes a new record rather than deleting any existing one, so the audit
// chain is never destroyed.

import type { DiffRecord } from './diff';
import { diff } from './diff';

export type HistorySource = 'webui' | 'revert' | 'cleanup';

/** Full snapshot of the params we edit, so rollback is a pure function. */
export interface ConfigSnapshot {
  smartp: {
    cloud_config: Record<string, unknown>; // config_name -> parsed params
  };
  teg: {
    /** rule_module -> array of parsed rule_content JSON objects.
     *  We keep an array because teg_config.rules can carry multiple history
     *  rows per module. Writing syncs by (module, rule_id). */
    rules: Record<string, unknown[]>;
  };
}

export interface HistoryRecord {
  version: 1;
  seq: number;
  timestamp: number; // epoch seconds
  source: HistorySource;
  note: string;
  before: ConfigSnapshot;
  after: ConfigSnapshot;
  diff_summary: DiffRecord[];
}

export interface HistoryFileMeta {
  name: string;
  timestamp: number;
  seq: number;
}

/**
 * Parse a history filename. Files are named `<epoch>-<seq>.json`. Returns null
 * for unknown shapes (so stray files don't break the list).
 */
export function parseHistoryFilename(name: string): HistoryFileMeta | null {
  const m = /^(\d+)-(\d+)\.json$/.exec(name);
  if (!m) return null;
  return { name, timestamp: Number(m[1]), seq: Number(m[2]) };
}

export function buildHistoryFilename(timestamp: number, seq: number): string {
  return `${timestamp}-${seq}.json`;
}

/** Pick the next seq number given an existing list of filenames. */
export function nextSeq(existing: string[]): number {
  let max = 0;
  for (const n of existing) {
    const meta = parseHistoryFilename(n);
    if (meta && meta.seq > max) max = meta.seq;
  }
  return max + 1;
}

export interface BuildRecordArgs {
  seq: number;
  timestamp?: number;
  source?: HistorySource;
  note?: string;
  before: ConfigSnapshot;
  after: ConfigSnapshot;
}

export function buildRecord(args: BuildRecordArgs): HistoryRecord {
  return {
    version: 1,
    seq: args.seq,
    timestamp: args.timestamp ?? Math.floor(Date.now() / 1000),
    source: args.source ?? 'webui',
    note: args.note ?? '',
    before: args.before,
    after: args.after,
    diff_summary: diff(args.before, args.after),
  };
}

export function snapshotFromMaps(args: {
  cloudConfig: Record<string, unknown>;
  rulesByModule: Record<string, unknown[]>;
}): ConfigSnapshot {
  return {
    smartp: { cloud_config: clone(args.cloudConfig) },
    teg: { rules: clone(args.rulesByModule) },
  };
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

/**
 * RootBackedStore uses the `bin/joyose-edit.sh history-*` subcommands
 * (in the live module) to persist records. In Node (tests) we substitute a
 * FilesystemStore — both implement the same interface.
 */
export interface HistoryStore {
  list(): Promise<HistoryFileMeta[]>;
  read(name: string): Promise<HistoryRecord>;
  append(record: HistoryRecord): Promise<string>;
  clear(keep: number): Promise<number>;
}

export interface StoreDriver {
  listNames(): Promise<string[]>;
  readText(name: string): Promise<string>;
  writeText(name: string, content: string): Promise<void>;
  remove(name: string): Promise<void>;
}

export class DriverBackedStore implements HistoryStore {
  constructor(private readonly driver: StoreDriver) {}

  async list(): Promise<HistoryFileMeta[]> {
    const names = await this.driver.listNames();
    return names
      .map((n) => parseHistoryFilename(n))
      .filter((x): x is HistoryFileMeta => !!x)
      .sort((a, b) => b.timestamp - a.timestamp || b.seq - a.seq);
  }

  async read(name: string): Promise<HistoryRecord> {
    const text = await this.driver.readText(name);
    return JSON.parse(text) as HistoryRecord;
  }

  async append(record: HistoryRecord): Promise<string> {
    const name = buildHistoryFilename(record.timestamp, record.seq);
    await this.driver.writeText(name, JSON.stringify(record));
    return name;
  }

  async clear(keep: number): Promise<number> {
    if (!Number.isInteger(keep) || keep < 0) throw new Error('keep must be non-negative integer');
    const list = await this.list();
    const toRemove = list.slice(keep);
    for (const m of toRemove) await this.driver.remove(m.name);
    return toRemove.length;
  }
}
