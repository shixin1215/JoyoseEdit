// teg_config.rules.rule_content wraps a cloud_config row's `params` in an
// envelope. The shape is stable across samples we inspected — Joyose treats
// this mirror as a fallback when cloud_config is missing, so we need to keep
// it in perfect sync with cloud_config whenever we mutate params / version.

export interface RuleEnvelope<T = unknown> {
  config_name: string;
  group_name: string;
  enable: boolean;
  version: number;
  with_model: boolean;
  params: T;
}

export function buildRuleEnvelope<T>(
  configName: string,
  params: T,
  version: number,
): RuleEnvelope<T> {
  return {
    config_name: configName,
    group_name: configName,
    enable: true,
    version,
    with_model: false,
    params,
  };
}

/** Given a freshly parsed `rule_content` envelope, substitute fresh `params`
 * (and optionally bump `version`). Returns a new object; the original stays
 * untouched so diffs remain meaningful. */
export function refreshEnvelope<T>(
  envelope: RuleEnvelope<unknown> | null | undefined,
  params: T,
  version?: number,
): RuleEnvelope<T> {
  const base = envelope
    ? { ...envelope }
    : buildRuleEnvelope('__unknown__', params, version ?? 0);
  return {
    config_name: base.config_name,
    group_name: base.group_name,
    enable: base.enable,
    version: typeof version === 'number' ? version : base.version,
    with_model: base.with_model,
    params,
  };
}
