-- Recurring orders — M1 additive (S1a). See docs/features/recurring-orders.md
-- for the full rollout + rollback plan; M2 (destructive) is deferred.

-- ---------------------------------------------------------------------------
-- order_series
-- ---------------------------------------------------------------------------
CREATE TABLE public.order_series (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Recurrence rule.
  frequency              text NOT NULL CHECK (frequency IN ('weekly','monthly')),
  weekdays               int[] NULL,
  day_of_month           int   NULL CHECK (
    day_of_month IS NULL OR (day_of_month BETWEEN 1 AND 31)
  ),
  repeat_every           int   NOT NULL DEFAULT 1
                              CHECK (repeat_every BETWEEN 1 AND 12),
  time_start             time  NOT NULL,
  time_end               time  NULL,
  hours_per_session      numeric NULL CHECK (
    hours_per_session IS NULL OR hours_per_session > 0
  ),
  timezone               text  NOT NULL,
  start_date             date  NOT NULL,
  last_appointment_at    timestamptz NULL,
  total_occurrences      int   NOT NULL CHECK (total_occurrences BETWEEN 2 AND 52),
  occurrences_completed  int   NOT NULL DEFAULT 0 CHECK (occurrences_completed >= 0),
  occurrences_cancelled  int   NOT NULL DEFAULT 0 CHECK (occurrences_cancelled >= 0),

  status                 text  NOT NULL DEFAULT 'active'
                              CHECK (status IN ('active','completed','cancelled')),

  CONSTRAINT order_series_weekly_requires_weekdays CHECK (
    frequency <> 'weekly' OR (
      weekdays IS NOT NULL AND array_length(weekdays, 1) >= 1
    )
  ),
  CONSTRAINT order_series_monthly_requires_dom CHECK (
    frequency <> 'monthly' OR day_of_month IS NOT NULL
  ),
  CONSTRAINT order_series_weekdays_in_range CHECK (
    weekdays IS NULL OR (
      array_length(weekdays, 1) BETWEEN 1 AND 7
      AND weekdays <@ ARRAY[0,1,2,3,4,5,6]::int[]
    )
  ),

  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  closed_at              timestamptz NULL,
  closed_reason          text NULL
);

CREATE INDEX idx_order_series_status_active
  ON public.order_series(status)
  WHERE status = 'active';

CREATE INDEX idx_order_series_created_at
  ON public.order_series(created_at DESC);

CREATE TRIGGER trg_order_series_updated_at
  BEFORE UPDATE ON public.order_series
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

COMMENT ON COLUMN public.order_series.last_appointment_at IS
  'appointment_date of the most recently materialized ocurrence. Canonical anchor for compute_next_slot; manual edits on individual orders MUST NOT update this — the rule beats per-row tweaks.';

-- ---------------------------------------------------------------------------
-- orders: link to its series + sequence position
-- ---------------------------------------------------------------------------
ALTER TABLE public.orders
  ADD COLUMN series_id   uuid NULL REFERENCES public.order_series(id) ON DELETE SET NULL,
  ADD COLUMN sequence_no int  NULL;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_series_seq_unique UNIQUE (series_id, sequence_no);

ALTER TABLE public.orders
  ADD CONSTRAINT orders_series_pair_consistency CHECK (
    (series_id IS NULL  AND sequence_no IS NULL)
    OR
    (series_id IS NOT NULL AND sequence_no IS NOT NULL AND sequence_no >= 1)
  );

CREATE INDEX idx_orders_series_id
  ON public.orders(series_id)
  WHERE series_id IS NOT NULL;

CREATE INDEX idx_orders_series_active_pending
  ON public.orders(series_id, appointment_date)
  WHERE series_id IS NOT NULL
    AND status NOT IN ('completado','cancelado','rechazado','archivado','terminado');

-- ---------------------------------------------------------------------------
-- compute_next_slot — pure date math, no DB access.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.compute_next_slot(
  p_prev          timestamptz,
  p_frequency     text,
  p_weekdays      int[],
  p_day_of_month  int,
  p_repeat_every  int,
  p_time          time,
  p_tz            text
) RETURNS timestamptz
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_prev_date    date;
  v_candidate    date;
  v_dow          int;
  v_week_diff    int;
  v_year         int;
  v_month        int;
  v_max_dom      int;
  v_target_dom   int;
  v_iter         int;
BEGIN
  IF p_prev IS NULL OR p_frequency IS NULL OR p_time IS NULL OR p_tz IS NULL THEN
    RETURN NULL;
  END IF;
  IF p_repeat_every IS NULL OR p_repeat_every < 1 THEN
    RETURN NULL;
  END IF;

  v_prev_date := (p_prev AT TIME ZONE p_tz)::date;

  IF p_frequency = 'weekly' THEN
    IF p_weekdays IS NULL OR array_length(p_weekdays, 1) IS NULL THEN
      RETURN NULL;
    END IF;

    v_candidate := v_prev_date + 1;
    -- Safety bound: at most (12 * repeat_every) weeks of forward scan.
    FOR v_iter IN 1..(12 * p_repeat_every * 7) LOOP
      v_dow := EXTRACT(DOW FROM v_candidate)::int;  -- 0=Sun..6=Sat
      IF v_dow = ANY(p_weekdays) THEN
        v_week_diff := (
          date_trunc('week', v_candidate::timestamp)::date
          - date_trunc('week', v_prev_date::timestamp)::date
        ) / 7;
        IF v_week_diff = 0 OR (v_week_diff > 0 AND v_week_diff % p_repeat_every = 0) THEN
          RETURN (v_candidate + p_time) AT TIME ZONE p_tz;
        ELSIF v_week_diff > 0 AND v_week_diff < p_repeat_every THEN
          -- Jump to the first day of the next valid week block; do not
          -- increment at the bottom of the loop.
          v_candidate := date_trunc('week', v_prev_date::timestamp)::date
                         + (p_repeat_every * 7);
          CONTINUE;
        END IF;
      END IF;
      v_candidate := v_candidate + 1;
    END LOOP;
    RETURN NULL;

  ELSIF p_frequency = 'monthly' THEN
    IF p_day_of_month IS NULL THEN
      RETURN NULL;
    END IF;
    v_year  := EXTRACT(YEAR  FROM v_prev_date)::int;
    v_month := EXTRACT(MONTH FROM v_prev_date)::int + p_repeat_every;
    WHILE v_month > 12 LOOP
      v_month := v_month - 12;
      v_year  := v_year + 1;
    END LOOP;
    -- Clamp day to the target month's length (handles Feb 28/29, Apr 30, etc.).
    v_max_dom := EXTRACT(DAY FROM (
      make_date(v_year, v_month, 1) + INTERVAL '1 month' - INTERVAL '1 day'
    ))::int;
    v_target_dom := LEAST(p_day_of_month, v_max_dom);
    v_candidate := make_date(v_year, v_month, v_target_dom);
    RETURN (v_candidate + p_time) AT TIME ZONE p_tz;

  ELSE
    RETURN NULL;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.compute_next_slot IS
  'Next-slot timestamptz for a recurrence rule. Weekly: same-week remaining weekdays, then skip (repeat_every-1) weeks. Monthly: jump repeat_every months, clamp day_of_month. NULL only on invalid input.';

-- ---------------------------------------------------------------------------
-- set_order_status — sole sanctioned path for orders.status changes.
-- Terminal -> anything rejected. Same-status is a silent no-op.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_order_status(
  p_order_id   uuid,
  p_new_status text,
  p_actor_id   uuid,
  p_notes      text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
-- search_path = 'public' (not '') so triggers on public.orders that use
-- unqualified table names (e.g. validate_order_city_country_match references
-- `cities` without schema) still resolve. The function body itself qualifies
-- every reference as public.X, so the function is not vulnerable to a
-- search_path hijack of its own statements.
SET search_path = 'public'
AS $$
DECLARE
  v_old text;
  v_valid_set text[] := ARRAY[
    'pendiente','asignado','confirmado','completado',
    'pendiente_de_pago','terminado','rechazado','archivado','cancelado'
  ];
BEGIN
  IF p_new_status IS NULL OR NOT (p_new_status = ANY(v_valid_set)) THEN
    RAISE EXCEPTION 'invalid_status: %', p_new_status
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT status INTO v_old
    FROM public.orders
    WHERE id = p_order_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'order_not_found'
      USING ERRCODE = 'no_data_found';
  END IF;

  IF v_old = p_new_status THEN
    RETURN;
  END IF;

  IF v_old IN ('completado','cancelado','rechazado','archivado','terminado') THEN
    RAISE EXCEPTION 'invalid_transition: % -> %', v_old, p_new_status
      USING ERRCODE = 'check_violation';
  END IF;

  UPDATE public.orders
     SET status = p_new_status,
         updated_at = now()
   WHERE id = p_order_id;

  INSERT INTO public.order_status_history (
    order_id, from_status, to_status, changed_by, notes, created_at
  ) VALUES (
    p_order_id, v_old, p_new_status, p_actor_id, p_notes, now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.set_order_status(uuid, text, uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_order_status(uuid, text, uuid, text)
  TO service_role;

COMMENT ON FUNCTION public.set_order_status IS
  'Atomic orders.status UPDATE + order_status_history insert. All higher-level RPCs delegate here so audit + lock are guaranteed.';

-- ---------------------------------------------------------------------------
-- Carry the existing test row #1042 over to the new model. The legacy
-- row is preserved in order_recurrence until M2 drops the table.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_series_id uuid;
BEGIN
  INSERT INTO public.order_series (
    frequency, weekdays, day_of_month, repeat_every,
    time_start, time_end, hours_per_session, timezone,
    start_date, last_appointment_at,
    total_occurrences, occurrences_completed, occurrences_cancelled,
    status
  )
  SELECT
    'weekly',
    r.weekdays,
    NULL,
    r.repeat_every,
    r.time_window_start,
    r.time_window_end,
    r.hours_per_session,
    o.timezone,
    r.start_date,
    o.appointment_date,
    10,        -- arbitrary V1 default for the seeded row; user-controlled in S2.
    0, 0,
    'active'
  FROM public.order_recurrence r
  JOIN public.orders o ON o.id = r.order_id
  WHERE r.order_id = '5abf0613-8189-431f-8104-b1998534b4f4'
  RETURNING id INTO v_series_id;

  IF v_series_id IS NOT NULL THEN
    UPDATE public.orders
       SET series_id = v_series_id,
           sequence_no = 1
     WHERE id = '5abf0613-8189-431f-8104-b1998534b4f4';
  END IF;
END $$;
