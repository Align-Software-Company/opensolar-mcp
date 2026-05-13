import { z } from 'zod';

const REDACTED_VALUE = '[REDACTED]';

export type SubtreeMode = 'wholesale' | 'surgical';

export type RedactionRule = {
  match: string | RegExp;
  mode: SubtreeMode;
};

export type ValuePatternRule = RegExp;

export type RedactionOptions = {
  fieldRules: RedactionRule[];
  valuePatterns: ValuePatternRule[];
};

const SubtreeModeSchema = z.enum(['wholesale', 'surgical']);
const RedactionRuleSchema = z.object({
  match: z.union([z.string(), z.instanceof(RegExp)]),
  mode: SubtreeModeSchema,
});
const RedactionOptionsSchema = z.object({
  fieldRules: z.array(RedactionRuleSchema).default([]),
  valuePatterns: z.array(z.instanceof(RegExp)).default([]),
});

export const DEFAULT_REDACTION: RedactionOptions = {
  fieldRules: [
    { match: /^integration_key_/i, mode: 'surgical' },
    { match: /^integration_secret_/i, mode: 'surgical' },
    { match: 'integration_json', mode: 'wholesale' },
    { match: 'api_key_chat', mode: 'wholesale' },
    { match: /^api_key_/i, mode: 'wholesale' },
    { match: 'webhook_signing_secret', mode: 'wholesale' },
    { match: /^webhook_/i, mode: 'wholesale' },
    { match: 'credit_card_stripe_secret_key', mode: 'wholesale' },
    { match: 'credit_card_stripe_publishable_key', mode: 'wholesale' },
    { match: 'docusign_account_secret', mode: 'wholesale' },
    { match: /^docusign_(secret|token|key|account)/i, mode: 'wholesale' },
    { match: /^pandadoc_(secret|token|key|api)/i, mode: 'wholesale' },
    { match: /^lightreach_(secret|token|key|api)/i, mode: 'wholesale' },
    { match: /^brighte_(secret|token|key|api)/i, mode: 'wholesale' },
    { match: /^bridgeselect_(secret|token|key|api)/i, mode: 'wholesale' },
    { match: /^bridgeselect_key$/i, mode: 'wholesale' },
    { match: /^sungage_(secret|token|key|api)/i, mode: 'wholesale' },
    { match: /^mosaic_(secret|token|key|api)/i, mode: 'wholesale' },
    { match: /^sunlight_(secret|token|key|api)/i, mode: 'wholesale' },
    { match: /^goodleap_(secret|token|key|api)/i, mode: 'wholesale' },
    { match: /^cashflow_(api|secret|token|key)/i, mode: 'wholesale' },
    { match: /^segen_(secret|token|key|api)/i, mode: 'wholesale' },
    { match: /^city_plumbing_(secret|token|key|api)/i, mode: 'wholesale' },
    { match: /^outlet_(secret|token|key|api)/i, mode: 'wholesale' },
    { match: /^salesforce_(secret|token|key|access|refresh|client)/i, mode: 'wholesale' },
    { match: /^zoho_(secret|token|key|access|refresh|client)/i, mode: 'wholesale' },
    { match: /^nearmap_(secret|token|key|api)/i, mode: 'wholesale' },
    { match: /^solarapp_(secret|token|key|api)/i, mode: 'wholesale' },
    { match: /^greenlancer_(secret|token|key|api)/i, mode: 'wholesale' },
    { match: /^centrix_(secret|token|key|api)/i, mode: 'wholesale' },
    { match: /_secret$/i, mode: 'wholesale' },
    { match: /_secret_key$/i, mode: 'wholesale' },
    { match: /_api_key$/i, mode: 'wholesale' },
    { match: /_signing_secret$/i, mode: 'wholesale' },
    { match: /_access_token$/i, mode: 'wholesale' },
    { match: /_refresh_token$/i, mode: 'wholesale' },
    { match: /_bearer_token$/i, mode: 'wholesale' },
    { match: /_password$/i, mode: 'wholesale' },
    { match: /_passwd$/i, mode: 'wholesale' },
    { match: /_credentials?$/i, mode: 'wholesale' },
    { match: /_private_key$/i, mode: 'wholesale' },
    { match: /_client_secret$/i, mode: 'wholesale' },
  ],
  valuePatterns: [
    /^gAAAA[A-Za-z0-9+/=_-]{20,}/,
    /^sk_(live|test)_[A-Za-z0-9]{20,}/,
    /^pk_(live|test)_[A-Za-z0-9]{20,}/,
    /^rk_(live|test)_[A-Za-z0-9]{20,}/,
    /^eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/,
    /^[A-Za-z0-9+/=_-]{40,}$/,
  ],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isContainer(value: unknown): value is Record<string, unknown> | unknown[] {
  return isRecord(value) || Array.isArray(value);
}

function resolveRuleMode(
  key: string,
  fieldRules: readonly RedactionRule[],
  normalizedFieldRuleNames: ReadonlyMap<number, string>,
): SubtreeMode | null {
  const normalizedKey = key.toLowerCase();
  for (const [index, rule] of fieldRules.entries()) {
    if (typeof rule.match === 'string') {
      const normalizedRule = normalizedFieldRuleNames.get(index);
      if (normalizedRule === normalizedKey) {
        return rule.mode;
      }
      continue;
    }
    if (rule.match.test(key)) {
      return rule.mode;
    }
  }
  return null;
}

function valueShouldBeRedacted(value: string, valuePatterns: readonly RegExp[]): boolean {
  return valuePatterns.some((pattern) => pattern.test(value));
}

function walkAndRedact(
  value: unknown,
  fieldRules: readonly RedactionRule[],
  normalizedFieldRuleNames: ReadonlyMap<number, string>,
  valuePatterns: readonly RegExp[],
  forceSurgical: boolean,
): unknown {
  if (typeof value === 'string') {
    if (valueShouldBeRedacted(value, valuePatterns)) {
      return REDACTED_VALUE;
    }
    return forceSurgical ? REDACTED_VALUE : value;
  }

  if (Array.isArray(value)) {
    return value.map((entry) =>
      walkAndRedact(entry, fieldRules, normalizedFieldRuleNames, valuePatterns, forceSurgical),
    );
  }

  if (isRecord(value)) {
    const clone: Record<string, unknown> = {};
    for (const [key, nestedValue] of Object.entries(value)) {
      const ruleMode = resolveRuleMode(key, fieldRules, normalizedFieldRuleNames);
      if (ruleMode === 'wholesale') {
        clone[key] = REDACTED_VALUE;
        continue;
      }
      if (ruleMode === 'surgical') {
        clone[key] = isContainer(nestedValue)
          ? walkAndRedact(nestedValue, fieldRules, normalizedFieldRuleNames, valuePatterns, true)
          : REDACTED_VALUE;
        continue;
      }
      clone[key] = walkAndRedact(
        nestedValue,
        fieldRules,
        normalizedFieldRuleNames,
        valuePatterns,
        forceSurgical,
      );
    }
    return clone;
  }

  return value;
}

export function redactSensitive<T>(payload: T, options: RedactionOptions = DEFAULT_REDACTION): T {
  const parsedOptions = RedactionOptionsSchema.parse(options);
  const normalizedFieldRuleNames = new Map<number, string>();
  for (const [index, rule] of parsedOptions.fieldRules.entries()) {
    if (typeof rule.match === 'string') {
      normalizedFieldRuleNames.set(index, rule.match.toLowerCase());
    }
  }
  const clonedPayload = JSON.parse(JSON.stringify(payload)) as unknown;
  return walkAndRedact(
    clonedPayload,
    parsedOptions.fieldRules,
    normalizedFieldRuleNames,
    parsedOptions.valuePatterns,
    false,
  ) as T;
}
