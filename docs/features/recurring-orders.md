# Recurring orders — spec, snapshot pre-S1a y rollback

## Resumen del feature

Materialización perezosa de órdenes recurrentes. El cliente reserva N sesiones; el admin ve UNA orden activa por vez; al completarla se materializa la siguiente; al completarse la N-ésima se cierra la serie; cancelar ofrece scope *"sólo esta"* (avanza) o *"esta y futuras"* (mata la serie).

**Plan detallado (durable)**: `~/.claude/plans/scalable-enchanting-river.md`. Este doc resume y se enfoca en el snapshot + rollback.

### Modelo de datos final (post-S1a/S1b)

- Tabla nueva `order_series` con la regla + estado (frequency, weekdays/day_of_month, repeat_every, time_start/end, total_occurrences, occurrences_completed/cancelled, status, timezone, anclas temporales).
- `orders` gana columnas `series_id uuid NULL` y `sequence_no int NULL` (atómicas vía `UNIQUE(series_id, sequence_no)`).
- 4 RPCs `SECURITY DEFINER`: `set_order_status`, `create_order_with_series`, `complete_order_and_advance`, `cancel_order_and_decide`. Helper SQL `compute_next_slot`.
- Tablas a eliminar (S6): `order_recurrence`, `order_schedules`, `order_sessions` — pre-existentes pero huérfanas o desconectadas.

### Cadencia de sesiones

S1a (schema + funciones base) → S1b (RPCs) → S2 (wizard) → S3 (admin detail completar) → S4 (admin cancelación) → S5 (admin list) → S6 (drop M2).

Regla operativa por sesión: **commit antes de iniciar**, **compact antes de iniciar** (ventana de contexto limpia). Al cerrar la sesión: `pnpm lint`, `pnpm test`, `NODE_ENV=production pnpm build`, commit + push.

---

## Snapshot del estado actual (pre-S1a)

Capturado el 2026-05-19 contra Supabase dev `vkfolbfchkwezrbkxpiv`.

### Código

- Branch: `main`
- HEAD: `bde69fa4ccb12797c1ac321e7d8d61d95ddaa819` (`bde69fa`)
- Mensaje: `docs(i18n): document navigation router pattern (i18n vs next)`
- Working tree: clean
- Ahead/behind remote: 63 commits ahead de upstream (no upstream tracking activo)

**Punto de retorno absoluto**: `git reset --hard bde69fa4ccb12797c1ac321e7d8d61d95ddaa819`.

### Base de datos

| Tabla | Filas | Notas |
|---|---:|---|
| `orders` | 12 | 11 `once`, 1 `weekly` (test #1042) |
| `order_recurrence` | 1 | sólo la fila de test #1042 |
| `order_schedules` | 0 | zombie de escritura |
| `order_sessions` | 0 | huérfana |
| `order_status_history` | 0 | huérfana (será wire-arla en S1a) |
| `order_tag_assignments` | 2 | |
| `order_talents` | 1 | |
| `order_subtypes` | 3 | |
| `order_notes` | 4 | |
| `order_hours_logs` | 4 | |
| `order_billing_lines` | 2 | |

Secuencia `orders_order_number_seq`: `last_value = 13`.

### Fila test crítica (`#1042`)

```json
{
  "table": "order_recurrence",
  "order_id": "5abf0613-8189-431f-8104-b1998534b4f4",
  "start_date": "2026-04-01",
  "end_date": "2026-04-30",
  "weekdays": [1, 4, 6],
  "repeat_every": 2,
  "time_window_start": "15:00:00",
  "time_window_end": "19:00:00",
  "hours_per_session": 2,
  "created_at": "2026-05-05T17:16:58.241772+00:00",
  "updated_at": "2026-05-05T17:16:58.241772+00:00"
}
```

En S1a se migra esta fila a `order_series` + setear `orders.series_id` en la orden #1042. Si hay que rollback de M1, esta fila se re-inserta tal cual (SQL más abajo).

### Esquema de las 3 tablas a eliminar en M2

Capturado para que un rollback de M2 (o de la migración M1 que las modifique) las pueda recrear idénticas.

```sql
-- order_recurrence
CREATE TABLE public.order_recurrence (
  order_id uuid NOT NULL,
  repeat_every integer NOT NULL DEFAULT 1,
  weekdays integer[] NOT NULL DEFAULT '{}'::integer[],
  start_date date,
  end_date date,
  time_window_start time,
  time_window_end time,
  hours_per_session numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT order_recurrence_pkey PRIMARY KEY (order_id),
  CONSTRAINT order_recurrence_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT order_recurrence_dates_valid CHECK ((end_date IS NULL) OR (start_date IS NULL) OR (end_date >= start_date)),
  CONSTRAINT order_recurrence_hours_per_session_check CHECK ((hours_per_session IS NULL) OR ((hours_per_session > 0) AND (hours_per_session <= 24))),
  CONSTRAINT order_recurrence_repeat_every_check CHECK ((repeat_every >= 1) AND (repeat_every <= 365)),
  CONSTRAINT order_recurrence_window_valid CHECK ((time_window_start IS NULL) OR (time_window_end IS NULL) OR (time_window_end > time_window_start))
);

-- order_schedules
CREATE TABLE public.order_schedules (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  start_date date NOT NULL,
  end_date date,
  time_start time NOT NULL,
  time_end time,
  timezone text NOT NULL,
  weekdays integer[],
  day_of_month integer,
  next_session_date date,
  generation_paused boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT order_schedules_pkey PRIMARY KEY (id),
  CONSTRAINT order_schedules_order_id_key UNIQUE (order_id),
  CONSTRAINT order_schedules_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT order_schedules_day_of_month_check CHECK ((day_of_month >= 1) AND (day_of_month <= 31)),
  CONSTRAINT order_schedules_weekdays_check CHECK (weekdays <@ ARRAY[1,2,3,4,5,6,7])
);

-- order_sessions
CREATE TABLE public.order_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  scheduled_start timestamptz NOT NULL,
  scheduled_end timestamptz,
  local_timezone text NOT NULL,
  status text NOT NULL DEFAULT 'scheduled',
  talent_id uuid,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT order_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT order_sessions_order_id_scheduled_start_key UNIQUE (order_id, scheduled_start),
  CONSTRAINT order_sessions_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT order_sessions_talent_id_fkey FOREIGN KEY (talent_id) REFERENCES profiles(id) ON DELETE SET NULL,
  CONSTRAINT order_sessions_status_check CHECK (status = ANY (ARRAY['scheduled','completed','cancelled','no_show']))
);
```

`order_recurrence` y `order_sessions` tienen 0 filas en este snapshot (excepto la del test #1042 en `order_recurrence`). `order_schedules` tiene 0 filas.

---

## Procedimiento de rollback por sesión

### Rollback de S1a (migración M1 aplicada)

**Síntoma de "algo salió mal"**: tests SQL rojos, schema inconsistente, queries de smoke fallan.

**Pasos código**:
```bash
git reset --hard bde69fa4ccb12797c1ac321e7d8d61d95ddaa819
git push --force-with-lease  # sólo si ya hubo push
```

**Pasos DB** (ejecutar en orden vía MCP `execute_sql`):
```sql
-- 1. Restaurar la fila test #1042 en order_recurrence si fue migrada/borrada
INSERT INTO order_recurrence (
  order_id, repeat_every, weekdays, start_date, end_date,
  time_window_start, time_window_end, hours_per_session, created_at, updated_at
) VALUES (
  '5abf0613-8189-431f-8104-b1998534b4f4', 2, ARRAY[1,4,6],
  '2026-04-01', '2026-04-30', '15:00:00', '19:00:00', 2,
  '2026-05-05T17:16:58.241772+00:00', '2026-05-05T17:16:58.241772+00:00'
)
ON CONFLICT (order_id) DO NOTHING;

-- 2. Limpiar columnas que M1 agregó a orders
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_series_seq_unique;
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_series_pair_consistency;
DROP INDEX IF EXISTS idx_orders_series_id;
DROP INDEX IF EXISTS idx_orders_series_active_pending;
ALTER TABLE orders DROP COLUMN IF EXISTS sequence_no;
ALTER TABLE orders DROP COLUMN IF EXISTS series_id;

-- 3. Eliminar order_series
DROP TABLE IF EXISTS order_series CASCADE;

-- 4. Eliminar funciones nuevas
DROP FUNCTION IF EXISTS compute_next_slot(timestamptz, text, int[], int, int, time, text);
DROP FUNCTION IF EXISTS set_order_status(uuid, text, uuid, text);
```

**Verificación post-rollback**:
```sql
-- Debe devolver 12, 1, 0, 0 (counts originales)
SELECT
  (SELECT count(*) FROM orders) AS orders,
  (SELECT count(*) FROM order_recurrence) AS recurrence,
  (SELECT count(*) FROM information_schema.columns WHERE table_name='orders' AND column_name='series_id') AS has_series_col,
  (SELECT count(*) FROM information_schema.tables WHERE table_name='order_series') AS has_series_table;
```

### Rollback de S1b (RPCs creados)

Reverso del PR del código + en DB:
```sql
DROP FUNCTION IF EXISTS complete_order_and_advance(uuid, uuid);
DROP FUNCTION IF EXISTS cancel_order_and_decide(uuid, text, text, uuid);
DROP FUNCTION IF EXISTS create_order_with_series(jsonb, uuid);
```

Las funciones de S1a (`compute_next_slot`, `set_order_status`) pueden quedarse o irse según si rollback es parcial (sólo S1b) o total (a snapshot). Si es total, ver §S1a.

### Rollback de S2 (wizard cambiado)

Reverso de PR de S2. El wizard vuelve a escribir a `order_schedules` (que sigue existiendo en S1-S5).

**Datos creados durante la ventana defectuosa**: las filas `order_series` + `orders[sequence_no=1]` ya escritas quedan huérfanas pero **no rompen nada** porque el admin sólo lee `order_series` desde S3+ (que aún no está). Limpieza opcional:
```sql
-- Identificar series creadas por el wizard durante ventana de S2 defectuoso
SELECT id, created_at, total_occurrences FROM order_series
WHERE created_at BETWEEN '<inicio S2>' AND '<fin S2>';

-- Si se decide limpiar (opcional, no urgente):
DELETE FROM orders WHERE series_id IN (<ids identificados>);
DELETE FROM order_series WHERE id IN (<ids identificados>);
```

### Rollback de S3/S4/S5

Reverso de PR — el código viejo (status select directo, modal sin scope, lista sin badge) vuelve. Datos persisten sin daño. Las órdenes materializadas siguen existiendo pero no se materializan nuevas porque el botón *Completar sesión* desaparece.

### Rollback de S6 (M2 destructiva ejecutada)

**Crítico**: este rollback es el más costoso porque las 3 tablas viejas se eliminaron. Procedimiento:

1. Recrear las 3 tablas (CREATE TABLE SQL en sección §Esquema de las 3 tablas a eliminar — copiar tal cual).
2. NO es necesario re-poblar `order_recurrence` con el row de #1042 porque ese row ya fue migrado a `order_series` en S1a y la fuente de verdad ya cambió.
3. Reverso del PR de S6.

Por eso M2 se pospone hasta que S2-S5 estén en producción por al menos un ciclo de uso real (ver plan §Estrategia de migración).

---

## Checkpoint a hacer ANTES de iniciar S1a

1. **Commit del snapshot** (este doc): `git add docs/features/recurring-orders.md && git commit -m "docs: snapshot pre-S1a + rollback procedures"`.
2. **Push** si hay upstream: opcional, pero recomendado para no perder el SHA de retorno si la máquina local falla.
3. **Tag opcional** para tener un ancla nombrada: `git tag pre-recurring-orders-s1a bde69fa && git push origin pre-recurring-orders-s1a`.
4. **Compact** la conversación de Claude Code (`/compact`) para arrancar S1a con ventana de contexto limpia (memoria `feedback_context_management`).

## Después de cada sesión

- `pnpm lint`
- `pnpm test`
- `NODE_ENV=production pnpm build` (per gotcha en CLAUDE.md)
- `git add -p && git commit && git push`
- `/compact` antes de la siguiente sesión.

## Referencias

- Plan detallado: `~/.claude/plans/scalable-enchanting-river.md`
- Spec del wizard original: `docs/features/service-hire-modal.md`
- Spec del admin detail: `docs/features/admin-order-detail.md`
- Memoria de cadencia: `feedback_session_cadence`
