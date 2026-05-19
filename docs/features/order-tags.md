# Feature: Order Tags (Etiquetas de órdenes)

## Resumen

Sistema de etiquetas categorizadoras planas que el backoffice aplica manualmente a las **órdenes** (p.ej. `Urgente`, `Cliente VIP`, `Repetido`, `Difícil acceso`). Análogo a `talent-tags` pero sobre `orders`. Los nombres son traducibles en los 5 locales (es/en/pt/fr/ca) y la gestión se realiza desde `/admin/order-tags`.

**Estructura plana, sin grupos**: una orden tiene N tags; cada tag tiene un nombre por locale almacenado en una columna `i18n jsonb`.

## Estado actual (verificado vía MCP, dev `vkfolbfchkwezrbkxpiv`)

- `order_tags` y `order_tag_assignments` **ya existen** en el DB dev. El backend de detalle de orden (`get-order-detail.ts`, `update-order-tags.ts`) ya las usa de forma real.
- `get-order-tag-options.ts` (selector del detalle de orden) **es un mock** con IDs `mock-tag-N` que viola el FK `order_tag_assignments_tag_id_fkey` al guardar. Se reconecta en Sesión 3.
- Datos vivos: 4 tags activos (`urgente`, `cliente_vip`, `repetido`, `dificil_acceso`) sembrados; orden #1042 con `urgente`+`cliente_vip`.

## Requisitos

### Funcionales

1. **CRUD de tags**: admin crea, edita, activa/desactiva tags desde `/admin/order-tags`.
2. **Traducciones por locale**: cada tag tiene un nombre por locale (es/en/pt/fr/ca) en `order_tags.i18n` (`{ "<locale>": { "name": "..." } }`). Mínimo una traducción.
3. **Slug único auto-generado**: al crear, el `slug` se genera desde la traducción del locale primario (`es`) vía `slugify`. Constraint DB `UNIQUE` (`order_tags_slug_key`); slug duplicado → error `_db` surfaceado como toast.
4. **Soft delete**: desactivar (`is_active = false`) NO borra asignaciones en `order_tag_assignments`. No hay hard delete desde la UI.
5. **Ordenamiento**: `sort_order` numérico; se normaliza por posición de array al guardar (idéntico a talent-tags).
6. **Consulta por locale con fallback**: el picker del detalle de orden obtiene `{ id, name }[]` con `is_active=true`, ordenado por `sort_order`, nombre en el locale pedido y fallback a `slug` si falta (Sesión 3).
7. **Asignación a órdenes**: vía `order_tag_assignments` (order_id ↔ tag_id, `assigned_by`, `created_at`). La UI de asignación ya existe en el detalle de orden; este feature solo gestiona el catálogo y repuebla su selector.

### No funcionales

- Feature aislado en `src/features/order-tags/`. No importa de otros features (boundaries `features → shared|lib|components-ui`).
- `src/features/orders/` **NO** importa de `src/features/order-tags/` (boundaries: features→features prohibido). El picker replica una query mínima propia (`@/shared/lib/i18n/localize` es shared y permitido).
- Tipos locales en `types.ts`; NO re-exporta `Tables<'order_tags'>`.
- Límites: archivo ≤300 LOC, función ≤60 LOC, feature ≤1500 LOC.
- i18n de UI bajo namespace `AdminOrderTags` + `AdminNav.orderTags` en los 5 locales (keys idénticas — locale-parity = keys-only).

## Esquema DB (existente, NO se modifica en este feature)

`order_tags`:

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid | PK, `gen_random_uuid()` |
| `slug` | text | NOT NULL, **UNIQUE** (`order_tags_slug_key`) |
| `i18n` | jsonb | NOT NULL, default `{}`; `{ "<locale>": { "name": "..." } }` |
| `is_active` | boolean | NOT NULL, default `true` |
| `sort_order` | integer | NOT NULL, default `0` |
| `created_at` | timestamptz | NOT NULL, default `now()` |
| `updated_at` | timestamptz | NOT NULL, default `now()` |

`order_tag_assignments (order_id → orders, tag_id → order_tags, assigned_by → profiles, created_at)`.

> **Deuda técnica declarada (fuera de scope):** las migraciones que crearon estas tablas (`20260505170823 order_tags_and_assignments`, `20260505170857 order_tags_seed_initial`) están aplicadas y registradas en el DB dev pero **sus archivos `.sql` no están en `supabase/migrations/`** (drift sistémico ~63 migraciones). Un clon limpio + `supabase db push` NO reproduce el esquema. Se aborda en un plan separado posterior (decisión explícita del usuario). Este feature asume la tabla existente en dev.

## Flujos

### Crear tag
1. Admin abre `/admin/order-tags` → "Añadir etiqueta".
2. Introduce nombre en `es` (mínimo) → `slugify` genera `slug`.
3. Opcionalmente añade `en/pt/fr/ca`.
4. "Guardar" → `saveTag({ tag })` valida con Zod → `INSERT` en `order_tags` (i18n jsonb) → `revalidatePath('/[locale]/(admin)/admin/order-tags','layout')`.

### Editar tag existente
1. Admin edita traducciones o toggle `is_active` inline; reordena por posición.
2. `saveTag` con `id` → `UPDATE order_tags` (slug, sort_order, is_active, i18n).
3. **Nota (comportamiento no obvio):** editar el nombre del locale primario (`es`) regenera el `slug` vía `slugify` (patrón idéntico a talent-tags). Es **seguro**: `order_tag_assignments` y el picker del detalle de orden referencian `tag_id` (uuid), nunca el slug, así que renombrar no orfana asignaciones existentes.

### Desactivar tag (soft delete)
1. `deleteTag(id)` → `UPDATE is_active=false`.
2. Desaparece del picker del detalle de orden (`is_active=true`).
3. `order_tag_assignments` se preserva; `get-order-detail.ts` NO filtra `is_active`, así que órdenes que ya tenían el tag lo siguen mostrando (histórico correcto).

### Picker del detalle de orden (Sesión 3)
`get-order-tag-options.ts` reemplaza el mock por query directa a `order_tags` (`is_active=true`, order `sort_order`, `localizedField(i18n, locale, 'name') ?? slug`). NO importa `@/features/order-tags`.

## Criterios de aceptación

- [ ] `saveTag({ tag })` valida con Zod, persiste tag + i18n, devuelve `{ data:{ id } }` o `{ error }`.
- [ ] `listTags()` devuelve `OrderTagWithTranslations[]` (todas, activas+inactivas) ordenadas por `sort_order`, traducciones indexadas por locale.
- [ ] `deleteTag(id)` hace soft delete (`is_active=false`), preserva asignaciones.
- [ ] Tests: schemas Zod (valid/invalid, 5 locales, slug), smoke `saveTag`.
- [ ] `/admin/order-tags` lista, crea, edita, desactiva (Sesión 2).
- [ ] Picker del detalle de orden ofrece UUIDs reales; guardar no viola FK; #1042 sigue mostrando `urgente`+`cliente_vip` (Sesión 3).
- [ ] `grep '@/features/order-tags' src/features/orders/` → 0 resultados.
- [ ] Archivos ≤300 LOC, funciones ≤60 LOC; feature ≤1500 LOC.
- [ ] `pnpm lint` + `pnpm test --run` + `NODE_ENV=production pnpm build` verdes.

## Fuera de scope

- Recuperación de migraciones / reconciliación de drift (plan separado posterior).
- Drag-drop de reorden (no existe en talent-tags; no se inventa scope).
- Cambios al detalle de orden más allá de poblar el picker real.
- Hard delete / merge de tags.
