import { describe, it, expect } from 'vitest';
import { formatCurrency, formatPhone, initials } from './format';

describe('formatCurrency', () => {
  it('formats numeric values as USD', () => {
    expect(formatCurrency(1234)).toBe('$1,234');
  });

  it('returns em-dash for null/empty', () => {
    expect(formatCurrency(null)).toBe('—');
    expect(formatCurrency('')).toBe('—');
  });
});

describe('formatPhone', () => {
  it('formats E.164 US numbers', () => {
    expect(formatPhone('+15125550101')).toBe('(512) 555-0101');
  });

  it('returns empty string for null', () => {
    expect(formatPhone(null)).toBe('');
  });
});

describe('initials', () => {
  it('returns first letters of up to two name parts', () => {
    expect(initials('Katie Smith')).toBe('KS');
  });

  it('returns ? for empty', () => {
    expect(initials(null)).toBe('?');
  });
});
