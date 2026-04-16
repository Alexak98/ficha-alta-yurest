# QA Fichas — Hallazgos E2E (2026-04-16)

Resumen de ejecución de `scripts/test-e2e-fichas.sh` contra
`https://n8n-soporte.data.yurest.dev/webhook` con credenciales válidas.

    RESULTADO: 6 PASS · 12 FAIL · 3 SKIP

El flujo de **alta de ficha está roto en producción**: el POST devuelve 200
pero ninguna ficha se persiste. En consecuencia, los bloques que dependen de
una ficha recién creada (edición, locales, round-trip) no se pudieron
ejecutar y quedaron como SKIP.

---

## 🔴 Bloqueantes

### B1. `POST /guardarFicha` no persiste (HTTP 200, body vacío)

- Endpoint: `/webhook/57e04029-bae4-4124-8c43-c535e831a147`
- Síntoma: responde `200` con **body vacío** en lugar del esperado
  `{"success":true}`. Tras esperar 2 s, el `GET /altas` sigue devolviendo
  el mismo número de fichas. Reproducible con payload mínimo y con payload
  completo (corporate + locales + carrito).
- Diagnóstico probable: el flujo n8n se corta entre `Preparar Ficha` e
  `INSERT Ficha` (nodo Supabase). Con `alwaysOutputData: true` en todos los
  nodos, el error del INSERT no aborta el flujo pero tampoco llega al nodo
  `Respond Guardar OK` que inyectaría el body.
- Causa raíz más plausible: las credenciales de Supabase en n8n
  (`SUPABASE_CREDENTIAL_ID` aparece como placeholder en el JSON exportado).
  Es posible que estén usando la `anon key` y las políticas RLS del schema
  solo permiten escritura a `service_role`.
- Acción recomendada:
  1. En la UI de n8n abrir la credencial “Supabase Yurest” y confirmar que
     usa la **service role key**, no la anon.
  2. Ejecutar una vez el workflow a mano para ver en qué nodo se aborta y
     qué error devuelve Supabase.
  3. Si el error es RLS, revisar `schema.sql:359-376` — las policies están
     definidas solo para `service_role`.

### B2. `POST /eliminar` no borra (soft-delete no se aplica)

- Endpoint: `/webhook/a2b1b1d6-a1dc-4366-b60e-b5e4506faa3d`
- Síntoma: responde `200 {"success":true,"entity":"ficha","id":"..."}` pero
  la ficha sigue apareciendo en `GET /altas` y en `GET /completar`.
- El nodo `Formatear GET` filtra `deleted_at`, por lo que si el DELETE
  funcionara la ficha desaparecería. No desaparece → el `UPDATE deleted_at`
  de Supabase no se ejecuta. Mismo síntoma que B1, misma causa probable
  (credenciales/RLS).

### B3. Webhooks `POST /guardarFicha` y `POST /eliminar` son **públicos**

- Solo `GET /altas` requiere Basic Auth. El JSON del workflow
  (`database/n8n-workflows/04-fichas-alta.json:108-117`) no declara
  `"authentication": "basicAuth"` en el nodo `Webhook POST Guardar`, y lo
  mismo ocurre en `10-eliminar.json`.
- Cualquiera con la URL puede crear o borrar fichas. Aunque hoy por B1/B2
  no pase nada, en cuanto se arregle Supabase esto es un vector directo de
  manipulación de datos.
- Acción: añadir `"authentication": "basicAuth"` y `credentials.httpBasicAuth`
  a los webhooks POST de los workflows 04 y 10 (mismo patrón que el GET en
  `04-fichas-alta.json:7-26`).

---

## 🟠 Severos

### S1. `POST /eliminar` no valida entrada

- Acepta IDs que no son UUID: `{"id":"not-a-uuid"}` → 200 success.
- Acepta entidades desconocidas: `{"entity":"zzzz","id":"..."}` → 200.
- Acepta body sin id: `{"entity":"ficha"}` → 200 body vacío.
- En `10-eliminar.json` el nodo `Preparar DELETE` tira excepción si falta
  `id` (`throw new Error('Falta ID para eliminar')`), pero el webhook sigue
  respondiendo 200 por `alwaysOutputData: true` y porque el nodo Respond
  final responde con `{success:true}` hard-codeado.
- Acción: añadir un **nodo IF previo** que valide `id` (regex UUID) y
  `entity` (allowlist) y corte el flow devolviendo 400 con mensaje.

### S2. `GET /completar` acepta IDs no-UUID y `id=undefined`

- `id=undefined` devuelve `{"id":"undefined","ID Solicitud":"undefined"}`
  con 200.
- Sin `id` también devuelve 200 con body vacío.
- El commit `fc578c8` saneó el caso en el front (edición), pero la defensa
  está solo en el front. El workflow `12-completar-ficha.json` debería
  rechazar cualquier `id` que no cumpla la regex UUID, o al menos devolver
  `404` si no hay match.

---

## 🟡 Funcionales / inconsistencias

### F1. `Módulos` viaja como CSV string en la respuesta de completar

- El schema declara `modulos TEXT[]` (`schema.sql:84`). El front envía array
  y el workflow `Preparar Ficha` lo guarda como array. Pero `12-completar-ficha`
  devuelve `"Módulos":"Compras,Cocina,..."` (CSV string). El front necesita
  parsearlo a array para rellenar checkboxes — revisar que funciona en
  `cargarModoEdicion` de `index.html`.

### F2. Mensualidad anualizada × 10 (UI) vs × 12 (persistida)

- `index.html:1225` muestra “€/año = mensual × 10” (oferta comercial de 2
  meses gratis por pago anual).
- `index.html:1859` guarda `Mensualidad Anualizada = mensual × 12` en BD.
- El workflow pasa el valor tal cual; los dashboards reciben × 12.
- Confirmar con el cliente si es intencional: si lo es, etiquetar la UI
  como “Oferta anual (10 meses)” para evitar confusión.

### F3. Resto de campos numéricos llegan como string `""`

- `Descuentosetup: ""` en vez de `0` en la respuesta de `/completar`. El
  front tolera ambos (`parseFloat`), pero al round-trip cambia 0 → ""
  silenciosamente.

---

## Cobertura del script actual

| Grupo | Escenarios | Observación |
|---|---|---|
| `auth` | GET con/sin auth, POST sin auth, DELETE sin auth | Detecta B3 |
| `crud` | POST → GET count delta → buscar por marker → completar round-trip | Detecta B1 |
| `edit` | POST con `id` + re-read | Bloqueado por B1 |
| `locales` | Re-guardar y medir duplicación | Bloqueado por B1 |
| `lite` | Alta Lite con tablet + entrega | Detecta B1 en variante Lite |
| `planes` | Alta Planes anual + `mensual_anualizada` | Detecta B1 en variante Planes |
| `negativos` | `/completar` y `/eliminar` con entradas inválidas | Detecta S1, S2 |

Ejecución selectiva:

    ONLY=auth,negativos bash scripts/test-e2e-fichas.sh
    VERBOSE=1 bash scripts/test-e2e-fichas.sh      # imprime body de respuestas
    SKIP_CLEANUP=1 bash scripts/test-e2e-fichas.sh # deja fichas para inspección

---

## Próximos pasos sugeridos (orden)

1. **Arreglar credencial Supabase en n8n** → desbloquea B1, B2 y la mayoría
   del resto de escenarios E2E.
2. Re-ejecutar `scripts/test-e2e-fichas.sh`. Los `SKIP` deberían pasar a
   PASS o FAIL reales — especialmente el de duplicación de locales.
3. **Añadir Basic Auth** a `Webhook POST Guardar` y `Webhook Eliminar` en
   los workflows 04 y 10.
4. **Validar entrada** en workflows 10 y 12 (UUID + entity allowlist).
5. Revisar en front `cargarModoEdicion` que parsea `Módulos` CSV a array.
6. Confirmar con cliente la convención × 10 vs × 12 de la mensualidad
   anualizada.
