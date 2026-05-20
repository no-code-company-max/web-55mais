import { describe, expect, it } from 'vitest';
import {
  computeFirstSlotDate,
  computeNextSlotDate,
  computeOccurrenceDate,
} from '../compute-slots';

describe('computeFirstSlotDate', () => {
  it('weekly: first matching weekday on or after start_date', () => {
    // 2026-06-01 is a Monday. Weekdays = [0,2,4] = Mon, Wed, Fri → first is Mon.
    expect(
      computeFirstSlotDate('2026-06-01', { frequency: 'weekly', weekdays: [0, 2, 4] }),
    ).toBe('2026-06-01');
  });

  it('weekly: scans forward when start_date is not in weekdays', () => {
    // 2026-06-02 is a Tuesday. Weekdays = [4] = Fri only → first is 2026-06-05.
    expect(
      computeFirstSlotDate('2026-06-02', { frequency: 'weekly', weekdays: [4] }),
    ).toBe('2026-06-05');
  });

  it('monthly: clamps day_of_month to month length', () => {
    // Feb 2027: day 31 clamps to 28.
    expect(
      computeFirstSlotDate('2027-02-10', { frequency: 'monthly', day_of_month: 31 }),
    ).toBe('2027-02-28');
  });

  it('monthly: advances to next month when target lands before start_date', () => {
    // start 2026-06-20, day_of_month=5 → 2026-06-05 is in the past → roll to July.
    expect(
      computeFirstSlotDate('2026-06-20', { frequency: 'monthly', day_of_month: 5 }),
    ).toBe('2026-07-05');
  });
});

describe('computeNextSlotDate', () => {
  it('weekly: remaining same-week weekday with repeat_every=1', () => {
    // Prev Mon 2026-06-01, weekdays [Mon, Wed, Fri] → next Wed 2026-06-03.
    expect(
      computeNextSlotDate('2026-06-01', { frequency: 'weekly', weekdays: [0, 2, 4] }),
    ).toBe('2026-06-03');
  });

  it('weekly: skips repeat_every-1 weeks after last day of week', () => {
    // Prev Fri 2026-06-05, weekdays [Mon] only, repeat_every=2 → +2 weeks Mon 2026-06-15.
    expect(
      computeNextSlotDate('2026-06-05', {
        frequency: 'weekly',
        weekdays: [0],
        repeat_every: 2,
      }),
    ).toBe('2026-06-15');
  });

  it('monthly: jumps repeat_every months with clamping', () => {
    // Prev 2027-01-31, dom=31, repeat_every=1 → Feb clamp to 28.
    expect(
      computeNextSlotDate('2027-01-31', {
        frequency: 'monthly',
        day_of_month: 31,
      }),
    ).toBe('2027-02-28');
  });
});

describe('computeOccurrenceDate', () => {
  it('weekly Mon/Wed/Fri × 10 sessions', () => {
    // Start 2026-06-01 (Mon), weekdays [Mon, Wed, Fri], total=10.
    // 1: Mon 06-01, 2: Wed 06-03, 3: Fri 06-05, 4: Mon 06-08, 5: Wed 06-10,
    // 6: Fri 06-12, 7: Mon 06-15, 8: Wed 06-17, 9: Fri 06-19, 10: Mon 06-22.
    expect(
      computeOccurrenceDate('2026-06-01', 10, {
        frequency: 'weekly',
        weekdays: [0, 2, 4],
      }),
    ).toBe('2026-06-22');
  });

  it('monthly 15th × 6 sessions', () => {
    // Start 2026-06-01, dom=15. First slot 2026-06-15. After 6 sessions: 2026-11-15.
    expect(
      computeOccurrenceDate('2026-06-01', 6, {
        frequency: 'monthly',
        day_of_month: 15,
      }),
    ).toBe('2026-11-15');
  });

  it('first session = sequence 1 (no advance)', () => {
    expect(
      computeOccurrenceDate('2026-06-01', 1, {
        frequency: 'weekly',
        weekdays: [0, 2, 4],
      }),
    ).toBe('2026-06-01');
  });
});
