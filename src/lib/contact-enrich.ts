import type { Contact } from '../schemas/contact.js';
import { DEFAULT_REDACTION, redactSensitive } from './redaction.js';

const syntheticEmailPattern = /^\d+@os\.code$/;

export function enrichContact(contact: Contact): Contact & { is_synthetic_email: boolean } {
  const redacted = redactSensitive(contact, DEFAULT_REDACTION) as Contact;
  const emailValue = typeof redacted.email === 'string' ? redacted.email : null;
  const isSyntheticEmail = emailValue !== null && syntheticEmailPattern.test(emailValue);

  const { url: _url, share_urls: _shareUrls, ...withoutNoise } = redacted;
  const withDerivedField: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(withoutNoise)) {
    withDerivedField[key] = value;
    if (key === 'email') {
      withDerivedField.is_synthetic_email = isSyntheticEmail;
    }
  }

  if (!Object.hasOwn(withDerivedField, 'is_synthetic_email')) {
    withDerivedField.is_synthetic_email = isSyntheticEmail;
  }

  return withDerivedField as Contact & { is_synthetic_email: boolean };
}
