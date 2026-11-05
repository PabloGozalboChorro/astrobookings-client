import { describe, expect, it } from 'vitest';

describe('test environment', () => {
  it('R4: runs tests in the UTC time zone', () => {
    expect(new Date('2027-03-15T14:30:00.000Z').getHours()).toBe(14);
  });
});
