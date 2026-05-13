import { z } from 'zod';

const REDACTED_VALUE = '[REDACTED]';

export const RedactionOptions = z.object({
  fieldNames: z.array(z.string()).default([]),
  fieldPatterns: z.array(z.instanceof(RegExp)).default([]),
  valuePatterns: z.array(z.instanceof(RegExp)).default([]),
});

export type RedactionOptions = z.infer<typeof RedactionOptions>;

export const DEFAULT_REDACTION: RedactionOptions = {
  fieldNames: [
    'integration_key_lightreach',
    'integration_json',
    'api_key',
    'api_key_chat',
    'credit_card_stripe_secret_key',
    'credit_card_stripe_publishable_key',
    'docusign_account_secret',
    'pandadoc_api_key',
    'webhook_signing_secret',
  ],
  fieldPatterns: [
    /^integration_key_/i,
    /^api_key_/i,
    /_secret$/i,
    /_secret_key$/i,
    /credentials?$/i,
  ],
  valuePatterns: [/^gAAAA[A-Za-z0-9_-]{20,}/],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function keyShouldBeRedacted(
  key: string,
  normalizedFieldNames: ReadonlySet<string>,
  fieldPatterns: readonly RegExp[],
): boolean {
  const normalizedKey = key.toLowerCase();
  if (normalizedFieldNames.has(normalizedKey)) {
    return true;
  }
  return fieldPatterns.some((pattern) => pattern.test(key));
}

function valueShouldBeRedacted(value: string, valuePatterns: readonly RegExp[]): boolean {
  return valuePatterns.some((pattern) => pattern.test(value));
}

function walkAndRedact(
  value: unknown,
  normalizedFieldNames: ReadonlySet<string>,
  fieldPatterns: readonly RegExp[],
  valuePatterns: readonly RegExp[],
): unknown {
  if (typeof value === 'string') {
    return valueShouldBeRedacted(value, valuePatterns) ? REDACTED_VALUE : value;
  }

  if (Array.isArray(value)) {
    return value.map((entry) =>
      walkAndRedact(entry, normalizedFieldNames, fieldPatterns, valuePatterns),
    );
  }

  if (isRecord(value)) {
    const clone: Record<string, unknown> = {};
    for (const [key, nestedValue] of Object.entries(value)) {
      if (keyShouldBeRedacted(key, normalizedFieldNames, fieldPatterns)) {
        clone[key] = REDACTED_VALUE;
        continue;
      }
      clone[key] = walkAndRedact(nestedValue, normalizedFieldNames, fieldPatterns, valuePatterns);
    }
    return clone;
  }

  return value;
}

export function redactSensitive<T>(payload: T, options: RedactionOptions = DEFAULT_REDACTION): T {
  const parsedOptions = RedactionOptions.parse(options);
  const normalizedFieldNames = new Set(
    parsedOptions.fieldNames.map((fieldName) => fieldName.toLowerCase()),
  );
  return walkAndRedact(
    payload,
    normalizedFieldNames,
    parsedOptions.fieldPatterns,
    parsedOptions.valuePatterns,
  ) as T;
}
