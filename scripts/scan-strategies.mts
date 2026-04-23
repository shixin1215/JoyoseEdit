// Scan all sample DBs in tests/ and report every distinct `strategy` value
// that appears in fisr_config.enhance_config[].enhance_policy_config[].
// Groups by (backend, strategy, feature) with example packages.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import initSqlJs from 'sql.js';
import { parseParams } from '../src/db/schema';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const SAMPLES = [
  { label: 'Xiaomi 17 Pro Max', db: 'tests/Xiaomi 17 Pro Max/SmartP.db' },
  { label: 'Xiaomi 17 Ultra', db: 'tests/Xiaomi 17 Ultra/SmartP.db' },
  { label: 'Xiaomi 15', db: 'tests/Xiaomi 15/SmartP.db' },
  { label: 'Xiaomi 15 Pro', db: 'tests/Xiaomi 15 Pro/SmartP.db' },
  { label: 'Redmi K90 Pro Max', db: 'tests/Redmi K90 Pro Max/SmartP.db' },
];

const SQL = await initSqlJs({});

for (const s of SAMPLES) {
  const absPath = path.join(ROOT, s.db);
  let bytes: Buffer;
  try {
    bytes = readFileSync(absPath);
  } catch {
    console.log(`\n=== ${s.label} ===\n  (sample not present)`);
    continue;
  }
  const db = new SQL.Database(new Uint8Array(bytes));
  const rows = db.exec("SELECT params FROM cloud_config WHERE config_name = 'booster_config'")[0]?.values ?? [];
  if (!rows.length) {
    console.log(`\n=== ${s.label} ===\n  (no booster_config)`);
    db.close();
    continue;
  }
  const params = parseParams(String(rows[0][0] ?? '')) as any;
  const fisr = params?.game_booster?.fisr_config;
  const groups = Array.isArray(fisr?.enhance_config) ? fisr.enhance_config : [];

  console.log(`\n=== ${s.label} ===`);
  console.log(`  fisr_config.enhance_config groups: ${groups.length}`);

  // Collect (feature, strategy) pairs with example pkgs.
  const seen = new Map<string, { feature: string; strategy: string; pkgs: Set<string> }>();
  for (const g of groups) {
    const gamePkgs: string[] = Array.isArray(g.game_list) ? g.game_list : [];
    const policies: any[] = Array.isArray(g.enhance_policy_config) ? g.enhance_policy_config : [];
    for (const p of policies) {
      const key = `${p.feature}::${p.strategy}`;
      if (!seen.has(key)) seen.set(key, { feature: p.feature, strategy: p.strategy, pkgs: new Set() });
      for (const pkg of gamePkgs) seen.get(key)!.pkgs.add(pkg);
    }
  }

  if (seen.size === 0) {
    console.log('  (no policies)');
  } else {
    const sorted = [...seen.values()].sort(
      (a, b) => a.strategy.localeCompare(b.strategy) || a.feature.localeCompare(b.feature),
    );
    for (const e of sorted) {
      const sample = [...e.pkgs].slice(0, 3).join(', ');
      const more = e.pkgs.size > 3 ? ` …(+${e.pkgs.size - 3})` : '';
      console.log(`  ${e.feature.padEnd(10)} strategy=${e.strategy.padEnd(10)} [${e.pkgs.size} pkgs]  e.g. ${sample}${more}`);
    }
  }

  db.close();
}
