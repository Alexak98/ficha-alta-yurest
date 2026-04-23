# QA — Módulo Presupuestos

Sesión de E2E profundo sobre el módulo Presupuestos del portal Yurest
(`/presupuestos.html`, workflow n8n `22-presupuestos`, tabla `presupuestos`).

Mirror de la metodología aplicada en
[QA-HARDWARE-HALLAZGOS.md](./QA-HARDWARE-HALLAZGOS.md) y
[QA-PROMOCIONES-HALLAZGOS.md](./QA-PROMOCIONES-HALLAZGOS.md).
Fecha: **2026-04-23**.

Notación:

- **B**_N_ — bloqueante (o al menos severo). Hay que arreglarlo antes de
  declarar el módulo apto.
- **S**_N_ — severo. Rompe un caso de uso pero no el módulo entero.
- **F**_N_ — funcional / de pulido. Mejora observable para el usuario.

---

## Resumen ejecutivo

El módulo se diseñó aprovechando los aprendizajes de hardware/promociones,
así que nació sin los bloqueantes clásicos (BasicAuth desde el día 1,
PostgREST por `httpRequest` en vez del nodo Supabase v1, RLS con
`anon_write_presupuestos`, acción `delete` no expuesta, filtros GET
cableados al Code node). La QA revela sin embargo **cinco** problemas
funcionales / severos que se habían colado:

1. La toggle "Mostrar archivadas" de la UI era **código muerto**: el GET
   del workflow filtraba `deleted_at` incondicionalmente. Ver B1.
2. El `Preparar` convertía `null` a la string literal `"null"` en
   `cliente` y `desarrollo` durante el `update`. Ver S1.
3. `validaNumero` para los costes aceptaba hasta `1e9` pero la columna
   es `NUMERIC(10,2)` (tope `99 999 999,99`). Valores entre ambos daban
   error 400 de PostgREST con mensaje confuso. Ver S2.
4. El orden del listado devolvía los archivados mezclados con los vivos
   cuando `?incluir_archivadas=1` estaba activo, escondiendo los vivos.
   Ver S3.
5. El E2E tenía asserción **negativa** (archivados ocultos por defecto)
   pero ninguna **positiva** que verificara `?incluir_archivadas=1`. Ver
   S4.

Plus cuatro problemas de pulido UX (F1–F4) y una mejora de
observabilidad (F5, badge sidebar global).

---

## Hallazgos

### B1 — `?incluir_archivadas=1` no llegaba al Code GET

**Síntoma.** La UI tenía un chip "Mostrar archivadas" que añadía
`?incluir_archivadas=1` al GET, pero el listado seguía sin incluirlos.
Código en `presupuestos.html:382`:

```js
if (verArchivadas) params.set('incluir_archivadas', '1');
```

El `Code → Formatear GET` del workflow filtraba `deleted_at`
incondicionalmente:

```js
const raw = ($input.all() || [])
    .map(i => i.json)
    .filter(x => x && x.id && !x.deleted_at);  // <-- sin mirar q.incluir_archivadas
```

Mismo antipatrón que ya habíamos corregido en hardware/promociones pero
que se había copiado sin el branch.

**Fix.** Split del filtro: siempre filtra filas huecas, y sólo filtra
`deleted_at` si `!q.incluir_archivadas`:

```js
const q = wh.query || wh.params || {};
const verArch = String(q.incluir_archivadas || '') === '1';
const raw = ($input.all() || [])
    .map(i => i.json)
    .filter(x => x && x.id && (verArch || !x.deleted_at));
```

---

### S1 — `String(null).trim()` → `"null"` en `update`

**Síntoma.** Al editar un presupuesto y dejar `cliente` o `desarrollo`
sin tocar, el frontend envía `null` (por `payload.notas = ... || null`
y por el JSON default de objetos). El `Preparar` hacía:

```js
if (p.cliente !== undefined) {
    if (!String(p.cliente).trim()) errores.push('cliente no puede ser vacío');
    else out.cliente = String(p.cliente).trim();
}
```

`String(null)` devuelve la string `"null"` (4 chars), cuyo `.trim()`
NO es vacío → pasaba la validación y se persistía el literal `"null"`
en la tabla. Exactamente el bug que habíamos clavado en hardware.

**Fix.** Normalizar `null`/`undefined` antes del `trim`:

```js
if (p.cliente !== undefined) {
    const v = p.cliente == null ? '' : String(p.cliente).trim();
    if (!v) errores.push('cliente no puede ser vacío');
    else out.cliente = v;
}
```

Mismo patrón aplicado a `desarrollo`.

---

### S2 — `validaNumero` tope `1e9` no concuerda con `NUMERIC(10,2)`

**Síntoma.** La columna `coste_yurest` / `coste_cliente` es
`NUMERIC(10,2)` → valor máximo `99 999 999,99`. El workflow validaba
hasta `1e9` (1 000 000 000) → valores entre 100 M y 1 000 M pasaban la
validación y reventaban en PostgREST con:

```
numeric field overflow (precision 10, scale 2)
```

El frontend mostraba el error pelado sin contexto.

**Fix.** Bajar el tope de `validaNumero` a `99999999.99` tanto en
`create` como en `update`. Mensaje de error consistente con el CHECK:
`"coste_yurest fuera de rango (0..99999999.99)"`.

---

### S3 — Archivados mezclados con vivos al ordenar

**Síntoma.** Cuando `?incluir_archivadas=1` devuelve archivados mezclados,
el ordenamiento ignoraba el estado de archivado. Un cliente marcaba dos
presupuestos como aceptados hace seis meses → hoy están archivados pero
siguen apareciendo arriba del listado porque `estado='aceptado'` los
prioriza, empujando los vivos abajo.

**Fix.** Poner los archivados siempre al final:

```js
out.sort((a, b) => {
    const ax = a.deleted_at ? 1 : 0;
    const bx = b.deleted_at ? 1 : 0;
    if (ax !== bx) return ax - bx;            // vivos primero
    if (a.estado !== b.estado) return a.estado === 'aceptado' ? -1 : 1;
    const da = a.created_at ? new Date(a.created_at).getTime() : 0;
    const db = b.created_at ? new Date(b.created_at).getTime() : 0;
    return db - da;
});
```

---

### S4 — E2E sólo tenía asserción negativa de archivadas

**Síntoma.** `test-e2e-presupuestos.sh` verificaba que por defecto no
devuelve archivados (`arch == 0`) pero no que `?incluir_archivadas=1`
los devuelva. El bug B1 por tanto no lo hubiera detectado un CI run.

**Fix.** Añadido al grupo `filtros`:

```bash
resp=$(req GET "$EP?incluir_archivadas=1")
body=$(get_body "$resp")
# tras el flujo hemos archivado/reactivado → tiene que haber >= 0
# archivados visibles (no siempre >=1 porque el cleanup se archiva
# DESPUÉS, pero sí tiene que aparecer al menos 1 si SKIP_CLEANUP=1)
```

Además se añade una asserción **directa**: tras `archivar` verificamos
que con flag sí aparece, y luego sin flag no aparece (round-trip).

También se añade validación de overflow (S2):

```bash
# coste_yurest fuera de NUMERIC(10,2)
resp=$(req POST "$EP" '{"action":"create","presupuesto":{"cliente":"X","desarrollo":"Y","coste_yurest":500000000}}')
# espera success=false
```

---

### F1 — `dataset.manual` del coste no se resetea entre modales

**Síntoma.** Escenario:

1. Abro "Nuevo presupuesto", toco el coste Yurest a mano → `dataset.manual='1'`.
2. Cancelo.
3. Abro "Nuevo presupuesto" otra vez, meto 10 horas.
4. El auto-cálculo NO se dispara porque el flag sigue activo del modal
   anterior.

`dataset` está en el `<input>`, que vive hasta que se recarga la página,
así que el flag es "persistente por sesión" sin querer.

**Fix.** Resetear `manual` en `abrirModal()` y en `editar()`:

```js
document.getElementById('mf-cy').dataset.manual = '';
document.getElementById('mf-cc').dataset.manual = '';
```

En `editar()`, si el coste recibido NO coincide con `horas * 85` lo
marcamos como manual para no pisar ese valor si el usuario cambia las
horas (ver F2).

---

### F2 — Editar con coste manual se pisa al cambiar las horas

**Síntoma.** Presupuesto con `horas_yurest=10, coste_yurest=500` (se
pactó una tarifa especial de 50 €/h en vez de los 85 por defecto). El
usuario lo edita para subir a 12 h. Tocar `horas_yurest` dispara
`autoCosteYurest()` que pisaba `coste_yurest = 12*85 = 1020` porque el
flag `dataset.manual` no estaba puesto (sólo se marca cuando el usuario
toca el input de coste).

**Fix.** En `editar()`, marcar como manual si el coste existente no
coincide con `horas * TARIFA_POR_HORA`. Así el usuario puede seguir
tocando horas sin perder la tarifa pactada, y sólo si mete un coste
nuevo a mano el flag se renueva.

---

### F3 — `aceptar` no marca automáticamente `enviado=true`

**Síntoma.** El flujo típico es: crear presupuesto → enviar al cliente
→ el cliente acepta → marcar aceptado. El portal obliga a marcar
explícitamente `enviado` antes porque la acción `aceptar` sólo toca
`estado`. Si el usuario olvida marcar enviado, el listado muestra un
presupuesto aceptado que según el portal nunca se le envió al cliente
→ confuso para Customer Success.

**Fix (opcional, no aplicado en esta pasada).** Una opción sería que
`aceptar` también setease `enviado=true` si todavía era false. Queda
documentado como pulido pendiente; no lo incluyo en esta ronda porque
el Customer Success team quiere distinguir claramente "aceptado sin
envío formal por email" (chat con el cliente) de "aceptado con PDF
enviado" — el flag tiene semántica propia.

---

### F4 — Modal no se cierra al hacer click fuera

**Síntoma.** Inconsistencia UX con el resto del portal (clientes.html,
promociones.html) donde clicar fuera del modal lo cierra. Aquí había
que pulsar la × explícita, Esc, o Cancelar.

**Fix.** Listener en el `.modal-overlay` con check `e.target === el`
para cerrar sólo al clicar en el backdrop, no en el contenido:

```js
document.getElementById('modal-pre').addEventListener('click', e => {
    if (e.target === e.currentTarget) cerrarModal();
});
```

---

### F5 — Badge del sidebar no se actualiza desde otras páginas

**Síntoma.** El badge `badge-presupuestos` sólo se refresca cuando
estás dentro de presupuestos.html (lo actualiza `render()`). El resto
de páginas del portal nunca dispara un fetch al endpoint, así que el
número mostrado en el sidebar queda congelado al último valor que vio
esta pestaña del navegador (o a vacío si nunca entraste).

**Fix (opcional, no aplicado en esta pasada).** Mover el helper al
`config.js` como `actualizarBadgePresupuestos()` y llamarlo desde
`sidebar.js` al renderizar, mismo patrón que `actualizarBadgeA3()` /
`actualizarBadgeSinAsignar()`. Queda documentado como mejora
observable; la prioridad ahora es B1/S1-S4.

---

## Mapa de cambios

| Fichero | Cambio |
| --- | --- |
| `database/n8n-workflows/22-presupuestos.json` | B1 (archivadas honoradas), S1 (null→'' en update), S2 (max coste 99 999 999,99), S3 (archivados al final del sort). |
| `presupuestos.html` | F1 (reset `dataset.manual` en abrir/editar), F2 (marcar manual si coste diverge de horas·tarifa), F4 (cerrar modal al clicar overlay). |
| `scripts/test-e2e-presupuestos.sh` | S4 (asserción positiva de `?incluir_archivadas=1`), validación de overflow NUMERIC(10,2). |
| `docs/QA-PRESUPUESTOS-HALLAZGOS.md` | **Nuevo**. Este documento. |

F3 y F5 quedan documentados y sin aplicar en esta ronda (decisión
explícita de producto / optimización no prioritaria).

---

## Cobertura E2E final (test-e2e-presupuestos.sh)

| Grupo | Asertos | Cubre |
| --- | --- | --- |
| auth | GET sin auth → 401; POST sin auth → 401; GET con auth → 200 | sanity |
| crud | create happy; listado total ≥1; totales agregados numéricos | — |
| validacion | cliente/desarrollo obligatorios; UUID; enums inválidos; horas fuera de rango; coste negativo; action desconocida; delete retirada; estado/entrega inválidos; **coste fuera de NUMERIC(10,2)** | S2 |
| flujo | create → update → marcar_enviado → aceptar → entregar → archivar → GET sin flag oculta → **GET con flag incluye** → reactivar → GET vuelve a verlo | B1, S3 |
| filtros | ?estado=aceptado/en_espera, ?entorno, ?quien_abona, ?cliente (contains); por defecto oculta archivados; `?incluir_archivadas=1` **sí** devuelve archivados | B1, S4 |
