import { addOneMonth, getPreviousMonthRange } from './date-utils';

describe('addOneMonth', () => {
  it('adds a calendar month to a mid-month date', () => {
    expect(addOneMonth(new Date('2026-03-15T10:30:00Z')).toISOString()).toBe('2026-04-15T10:30:00.000Z');
  });

  it('clamps Jan 31 to the last day of a non-leap February', () => {
    expect(addOneMonth(new Date('2026-01-31T00:00:00Z')).toISOString()).toBe('2026-02-28T00:00:00.000Z');
  });

  it('clamps Jan 31 to Feb 29 in a leap year', () => {
    expect(addOneMonth(new Date('2028-01-31T00:00:00Z')).toISOString()).toBe('2028-02-29T00:00:00.000Z');
  });

  it('rolls December into January of the next year', () => {
    expect(addOneMonth(new Date('2026-12-15T00:00:00Z')).toISOString()).toBe('2027-01-15T00:00:00.000Z');
  });

  it('does not mutate its input', () => {
    const input = new Date('2026-05-10T00:00:00Z');
    addOneMonth(input);
    expect(input.toISOString()).toBe('2026-05-10T00:00:00.000Z');
  });
});

describe('getPreviousMonthRange', () => {
  it('returns the previous full month as a half-open UTC range', () => {
    const { start, end } = getPreviousMonthRange(new Date('2026-10-01T04:00:00Z'));
    expect(start.toISOString()).toBe('2026-09-01T00:00:00.000Z');
    expect(end.toISOString()).toBe('2026-10-01T00:00:00.000Z');
  });

  it('crosses the year boundary in January', () => {
    const { start, end } = getPreviousMonthRange(new Date('2027-01-01T04:00:00Z'));
    expect(start.toISOString()).toBe('2026-12-01T00:00:00.000Z');
    expect(end.toISOString()).toBe('2027-01-01T00:00:00.000Z');
  });
});
