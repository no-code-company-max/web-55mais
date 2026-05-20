// Client-side mirror of the SQL helpers `create_order_with_series` (first slot)
// and `compute_next_slot` (subsequent slots). Used by the wizard preview
// "Última sesión aproximada: …" so the user sees roughly when the series ends.
//
// Convention: weekdays here use the wizard's 0=Mon..6=Sun mapping. The SQL
// stores DOW (0=Sun..6=Sat); the conversion happens at the wizard→RPC boundary
// in submit-service-hire.ts, not here.

export type Frequency = 'weekly' | 'monthly';

export type RecurrenceRule = {
  frequency: Frequency;
  weekdays?: number[];      // 0=Mon..6=Sun, required when frequency='weekly'
  day_of_month?: number;    // 1..31, required when frequency='monthly'
  repeat_every?: number;    // default 1
};

// JS Date.getDay() returns Sun=0..Sat=6. Convert to Mon0..Sun6.
function dowMon0(d: Date): number {
  return (d.getDay() + 6) % 7;
}

function lastDayOfMonth(year: number, monthOneBased: number): number {
  return new Date(year, monthOneBased, 0).getDate();
}

function addDays(d: Date, n: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + n);
  return next;
}

function parseIsoDate(iso: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return null;
  const [, y, m, d] = match;
  return new Date(Number(y), Number(m) - 1, Number(d));
}

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Mirror of create_order_with_series first-slot math. Returns YYYY-MM-DD or null.
export function computeFirstSlotDate(
  startDate: string,
  rule: RecurrenceRule,
): string | null {
  const start = parseIsoDate(startDate);
  if (!start) return null;

  if (rule.frequency === 'weekly') {
    if (!rule.weekdays || rule.weekdays.length === 0) return null;
    let cand = new Date(start);
    for (let i = 0; i < 7; i++) {
      if (rule.weekdays.includes(dowMon0(cand))) return toIsoDate(cand);
      cand = addDays(cand, 1);
    }
    return null;
  }

  if (!rule.day_of_month) return null;
  let year = start.getFullYear();
  let month = start.getMonth() + 1;
  let maxDom = lastDayOfMonth(year, month);
  let target = Math.min(rule.day_of_month, maxDom);
  let cand = new Date(year, month - 1, target);
  if (cand < start) {
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
    maxDom = lastDayOfMonth(year, month);
    target = Math.min(rule.day_of_month, maxDom);
    cand = new Date(year, month - 1, target);
  }
  return toIsoDate(cand);
}

// Mirror of compute_next_slot. Returns the next YYYY-MM-DD on or after prev+1.
// Weekly: same-week remaining weekdays first, then skip (repeat_every-1) weeks.
// Monthly: jump repeat_every months, clamp day_of_month to that month's length.
export function computeNextSlotDate(
  prevDate: string,
  rule: RecurrenceRule,
): string | null {
  const prev = parseIsoDate(prevDate);
  if (!prev) return null;
  const every = rule.repeat_every ?? 1;
  if (every < 1) return null;

  if (rule.frequency === 'weekly') {
    if (!rule.weekdays || rule.weekdays.length === 0) return null;
    // Bounded forward scan: at most 12 * every weeks.
    let cand = addDays(prev, 1);
    const bound = 12 * every * 7;
    for (let i = 0; i < bound; i++) {
      if (rule.weekdays.includes(dowMon0(cand))) {
        const prevWeekStart = startOfWeekMon0(prev);
        const candWeekStart = startOfWeekMon0(cand);
        const weekDiff = Math.round(
          (candWeekStart.getTime() - prevWeekStart.getTime()) / (7 * 86400_000),
        );
        if (weekDiff === 0 || (weekDiff > 0 && weekDiff % every === 0)) {
          return toIsoDate(cand);
        }
        if (weekDiff > 0 && weekDiff < every) {
          // Jump to the next valid week block without incrementing twice.
          cand = addDays(prevWeekStart, every * 7);
          continue;
        }
      }
      cand = addDays(cand, 1);
    }
    return null;
  }

  if (!rule.day_of_month) return null;
  let year = prev.getFullYear();
  let month = prev.getMonth() + 1 + every;
  while (month > 12) {
    month -= 12;
    year += 1;
  }
  const maxDom = lastDayOfMonth(year, month);
  const target = Math.min(rule.day_of_month, maxDom);
  return toIsoDate(new Date(year, month - 1, target));
}

function startOfWeekMon0(d: Date): Date {
  // Monday-anchored week start.
  const day = dowMon0(d);
  return addDays(d, -day);
}

// Convenience: returns the date of the Nth occurrence (1-indexed) given the
// recurrence rule and start_date. Used by the wizard to show the
// "última sesión aproximada".
export function computeOccurrenceDate(
  startDate: string,
  total: number,
  rule: RecurrenceRule,
): string | null {
  if (total < 1) return null;
  let cur = computeFirstSlotDate(startDate, rule);
  if (!cur) return null;
  for (let i = 2; i <= total; i++) {
    const next = computeNextSlotDate(cur, rule);
    if (!next) return null;
    cur = next;
  }
  return cur;
}
