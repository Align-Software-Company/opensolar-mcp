import { describe, expect, it } from 'vitest';
import { classifyMatches, rankContact, rankProject } from '../../src/lib/entity-match.js';

describe('rankContact', () => {
  const contact = {
    email: 'pat@example.test',
    phone: '2025550100',
    first_name: 'Pat',
    family_name: 'Example',
    display: 'Pat Example',
  };

  it('records exact email, phone, and full name', () => {
    expect(rankContact('pat@example.test', contact)).toEqual({ field: 'email', type: 'exact' });
    expect(rankContact('(202) 555-0100', contact)).toEqual({ field: 'phone', type: 'exact' });
    expect(rankContact('Pat Example', contact)).toEqual({ field: 'full_name', type: 'exact' });
  });

  it('records a name prefix and a name contains match', () => {
    expect(rankContact('Pa', contact)).toEqual({ field: 'full_name', type: 'prefix' });
    expect(rankContact('xample', contact)).toEqual({ field: 'full_name', type: 'contains' });
  });

  it('does not treat a short phone fragment or a bare domain as a match', () => {
    expect(rankContact('202', contact)).toBeNull();
    expect(rankContact('example.test', contact)).toBeNull();
  });

  it('does not match a redacted secret field', () => {
    expect(rankContact('PTEST123456', { ...contact, display: '[REDACTED]' })).toBeNull();
  });
});

describe('rankProject', () => {
  const project = {
    title: 'Example Street',
    address: '12 Example Street',
    business_name: 'Example Solar',
    contacts: [
      {
        email: 'pat@example.test',
        phone: '202-555-0100',
        display: 'Pat Example',
        identifier: 'contact-only',
      },
    ],
  };

  it('prefers contact email, then phone, then address, then title', () => {
    expect(rankProject('pat@example.test', project)).toEqual({
      field: 'contact_email',
      type: 'exact',
    });
    expect(rankProject('2025550100', project)).toEqual({ field: 'contact_phone', type: 'exact' });
    expect(rankProject('12 Example Street', project)).toEqual({ field: 'address', type: 'exact' });
    expect(rankProject('Example Street', project)).toEqual({ field: 'title', type: 'exact' });
  });

  it('uses a project identifier only when the list row has one', () => {
    expect(rankProject('JOB-1', project)).toBeNull();
    expect(rankProject('JOB-1', { ...project, identifier: 'JOB-1' })).toEqual({
      field: 'identifier',
      type: 'exact',
    });
    expect(rankProject('contact-only', project)).toBeNull();
  });

  it('matches locality only when the list row carries it', () => {
    expect(rankProject('Exampleton', project)).toBeNull();
    expect(rankProject('Exampleton', { ...project, locality: 'Exampleton' })).toEqual({
      field: 'locality',
      type: 'exact',
    });
  });
});

describe('classifyMatches', () => {
  it('keeps two equal name matches ambiguous', () => {
    const left = rankContact('Pat Example', {
      first_name: 'Pat',
      family_name: 'Example',
    });
    const right = rankContact('Pat Example', {
      first_name: 'Pat',
      family_name: 'Example',
    });
    expect(left).toEqual(right);
    expect(classifyMatches(2)).toBe('ambiguous');
    expect(classifyMatches(1)).toBe('unique');
    expect(classifyMatches(0)).toBe('none');
  });
});
