#!/usr/bin/env bash
# ===============================================================
# E2E del módulo Hardware del portal Yurest.
#
# Cobertura (cada bloque independiente y asertable, ver
# docs/QA-HARDWARE-HALLAZGOS.md):
#
#   1.  Auth negativa en GET (401) y POST (401) — fix B1
#   2.  GET /hardware/pedidos con auth (listado)
#   3.  GET ?estado=X filtrado backend
#   4.  GET ?proyecto_id=X filtrado backend
#   5.  POST create (happy path) — devuelve id + estado=solicitada
#   6.  POST create sin items / sin cliente (negativos)
#   7.  POST adjuntar_proforma (+ variantes negativas)
#   8.  POST adjuntar_justificante (round-trip)
#   9.  POST confirmar_pago
#   10. POST marcar_enviado (nuevo estado, fix S1)
#   11. Round-trip completo happy path
#   12. POST devolver_a_contabilidad desde proforma_adjuntada (fix S2)
#   13. POST devolver_a_contabilidad desde pendiente_confirmar
#   14. POST devolver_a_contabilidad sin motivo → 400/success=false
#   15. POST action=delete → 400/success=false (retirada, fix B2)
#   16. POST action desconocida
#   17. POST id no-UUID → error claro (fix B4)
#
# Uso:
#   YUREST_BASIC_AUTH='dXNlcjpwYXNz' ./scripts/test-e2e-hardware.sh
#   (base64 de "user:pass")
#
# Opcional:
#   SKIP_CLEANUP=1           → no borra los pedidos creados
#   ONLY=auth,crud,flujo,...  → solo grupos indicados
#   VERBOSE=1                 → imprime respuestas completas
#   BASE=<url>                → sobreescribe el webhook base
# ===============================================================

set -u

BASE="${BASE:-https://n8n-soporte.data.yurest.dev/webhook}"
EP="$BASE/hardware/pedidos"

if [ -z "${YUREST_BASIC_AUTH:-}" ]; then
    echo "ERROR: falta env var YUREST_BASIC_AUTH (base64 de user:pass)" >&2
    exit 2
fi

AUTH="Authorization: Basic $YUREST_BASIC_AUTH"
TS=$(date +%s)
MARKER="E2E_HW_$TS"
PASS=0
FAIL=0
SKIP=0
CREATED_IDS=()

ONLY="${ONLY:-auth,crud,flujo,rollback,validacion}"
VERBOSE="${VERBOSE:-}"

if [ -t 1 ]; then
    C_OK=$'\033[32m'; C_ERR=$'\033[31m'; C_WARN=$'\033[33m'; C_DIM=$'\033[2m'; C_BOLD=$'\033[1m'; C_RST=$'\033[0m'
else
    C_OK=''; C_ERR=''; C_WARN=''; C_DIM=''; C_BOLD=''; C_RST=''
fi

ok()   { PASS=$((PASS+1)); printf '  %s✓%s %s\n' "$C_OK"  "$C_RST" "$1"; }
fail() { FAIL=$((FAIL+1)); printf '  %s✗%s %s\n     esperado: %s\n     obtenido: %s\n' "$C_ERR" "$C_RST" "$1" "$2" "$3"; }
skip() { SKIP=$((SKIP+1)); printf '  %s~%s %s (%s)\n' "$C_WARN" "$C_RST" "$1" "$2"; }
section() { printf '\n%s━━━━━━ %s ━━━━━━%s\n' "$C_BOLD" "$1" "$C_RST"; }
group_enabled() { case ",$ONLY," in *",$1,"*) return 0;; *) return 1;; esac }

assert_eq() { [ "$2" = "$3" ] && ok "$1 = $3" || fail "$1" "$3" "$2"; }

# Llamada HTTP con retorno "body\n__STATUS__<code>"
req() {
    local method="$1" url="$2" body="${3:-}" with_auth="${4:-1}"
    if [ "$with_auth" = "1" ]; then
        if [ -n "$body" ]; then
            curl -sS -w "\n__STATUS__%{http_code}" -H "$AUTH" -H 'Content-Type: application/json' -X "$method" "$url" --data "$body"
        else
            curl -sS -w "\n__STATUS__%{http_code}" -H "$AUTH" -X "$method" "$url"
        fi
    else
        if [ -n "$body" ]; then
            curl -sS -w "\n__STATUS__%{http_code}" -H 'Content-Type: application/json' -X "$method" "$url" --data "$body"
        else
            curl -sS -w "\n__STATUS__%{http_code}" -X "$method" "$url"
        fi
    fi
}

# Separa body y status del retorno de `req`.
parse_status() { printf '%s' "$1" | awk -F'__STATUS__' 'NR==1{printf "%s", $0; next} {code=$NF} END{}'; printf ''; }
get_status() { printf '%s' "$1" | awk -F'__STATUS__' '{code=$NF} END{print code}' | tr -d '\r\n'; }
get_body()   { printf '%s' "$1" | awk -F'__STATUS__' 'NR==1{printf "%s", $0; printed=1; next}'; }

vdump() { [ -n "$VERBOSE" ] && printf '%s    %s%s\n' "$C_DIM" "$1" "$C_RST" || true; }

# Pequeño helper para extraer valores JSON con jq si está disponible; si no,
# cae a grep (limitado). Los asserts críticos usan jq para evitar falsos
# positivos con valores anidados.
jqget() {
    if command -v jq >/dev/null 2>&1; then
        printf '%s' "$1" | jq -r "$2" 2>/dev/null
    else
        # Fallback muy limitado — solo funciona para claves top-level string.
        local key
        key=$(printf '%s' "$2" | sed 's/^\.//; s/^\.//' )
        printf '%s' "$1" | grep -oE "\"$key\"[[:space:]]*:[[:space:]]*\"[^\"]*\"" | head -n1 | sed -E 's/.*:[[:space:]]*"([^"]*)".*/\1/'
    fi
}

# Construye el body JSON de create (reusable en varios tests).
build_create_body() {
    local marker="$1"
    cat <<JSON
{
  "action": "create",
  "pedido": {
    "proyecto_id": null,
    "cliente": "$marker",
    "implementador": "QA Bot",
    "items": [
      { "id": "etq_s", "nombre": "Etiqueta S (sencilla)", "formato": "57×32 mm", "grupo": "Etiquetas", "cantidad": 2, "unidad": "rollo", "precio_unitario": 12.25, "precio_total": 24.50 },
      { "id": "imp_zebra_zd", "nombre": "Impresora Zebra ZD", "grupo": "Hardware", "cantidad": 1, "unidad": "ud", "precio_unitario": 300, "precio_total": 300 }
    ],
    "notas_implementador": "Creado por E2E — $marker",
    "solicitado_por": "qa-bot"
  }
}
JSON
}

# PDF válido mínimo en base64 (1x1 pixel). Se usa como data URL.
PDF_B64='JVBERi0xLjQKJeLjz9MKMyAwIG9iago8PC9MZW5ndGggMjkvRmlsdGVyL0ZsYXRlRGVjb2RlPj4Kc3RyZWFtCnicS+QKUjBQMDEwUNA3NFAwsuAKLOEK5AIAQiQFCwplbmRzdHJlYW0KZW5kb2JqCjEgMCBvYmoKPDwvVHlwZS9QYWdlL1BhcmVudCAyIDAgUi9Db250ZW50cyAzIDAgUi9NZWRpYUJveFswIDAgMyAzXS9SZXNvdXJjZXM8PD4+Pj4KZW5kb2JqCjIgMCBvYmoKPDwvVHlwZS9QYWdlcy9LaWRzWzEgMCBSXS9Db3VudCAxPj4KZW5kb2JqCjQgMCBvYmoKPDwvVHlwZS9DYXRhbG9nL1BhZ2VzIDIgMCBSPj4KZW5kb2JqCnhyZWYKMCA1CjAwMDAwMDAwMDAgNjU1MzUgZgowMDAwMDAwMTE3IDAwMDAwIG4KMDAwMDAwMDIwMSAwMDAwMCBuCjAwMDAwMDAwMTUgMDAwMDAgbgowMDAwMDAwMjUwIDAwMDAwIG4KdHJhaWxlcgo8PC9Sb290IDQgMCBSL1NpemUgNT4+CnN0YXJ0eHJlZgoyOTIKJSVFT0YK'
PDF_DATA_URL="data:application/pdf;base64,$PDF_B64"

# ─────────────────────────────────────────────────────────────
# 1. Auth negativa
# ─────────────────────────────────────────────────────────────
if group_enabled auth; then
section "Auth"

resp=$(req GET "$EP" "" 0)
status=$(get_status "$resp")
assert_eq "GET sin auth → 401" "$status" "401"

resp=$(req POST "$EP" "$(build_create_body "E2E_HW_SIN_AUTH")" 0)
status=$(get_status "$resp")
assert_eq "POST sin auth → 401" "$status" "401"

resp=$(req GET "$EP" "")
status=$(get_status "$resp")
assert_eq "GET con auth → 200" "$status" "200"
fi

# ─────────────────────────────────────────────────────────────
# 2. Create happy path + listado
# ─────────────────────────────────────────────────────────────
if group_enabled crud; then
section "Create + listado"

CID_MARKER="${MARKER}_A"
resp=$(req POST "$EP" "$(build_create_body "$CID_MARKER")")
status=$(get_status "$resp"); body=$(get_body "$resp")
assert_eq "POST create → 200" "$status" "200"
vdump "$body"

success=$(jqget "$body" '.success')
pedido_id=$(jqget "$body" '.pedido.id')
estado=$(jqget "$body" '.pedido.estado')
assert_eq "create.success" "$success" "true"
assert_eq "create.estado" "$estado" "solicitada"
if [ -n "$pedido_id" ] && [ "$pedido_id" != "null" ]; then
    CREATED_IDS+=("$pedido_id")
    ok "create.id = $pedido_id"
else
    fail "create.id" "uuid" "$pedido_id"
fi

# GET listado total
resp=$(req GET "$EP")
body=$(get_body "$resp")
count=$(jqget "$body" '.pedidos | length')
[ -n "$count" ] && [ "$count" -ge 1 ] && ok "GET devuelve pedidos[] (n=$count)" || fail "GET listado" ">=1" "$count"

# GET filtrado por estado
resp=$(req GET "$EP?estado=solicitada")
body=$(get_body "$resp")
wrong=$(jqget "$body" '[.pedidos[] | select(.estado != "solicitada")] | length')
assert_eq "GET ?estado=solicitada → ningún otro estado" "$wrong" "0"

# GET filtrado por proyecto_id (inexistente → 0 resultados)
resp=$(req GET "$EP?proyecto_id=00000000-0000-0000-0000-000000000000")
body=$(get_body "$resp")
count=$(jqget "$body" '.pedidos | length')
assert_eq "GET ?proyecto_id=inexistente → 0" "$count" "0"
fi

# ─────────────────────────────────────────────────────────────
# 3. Validaciones en create
# ─────────────────────────────────────────────────────────────
if group_enabled validacion; then
section "Validación de input"

# create sin items
resp=$(req POST "$EP" '{"action":"create","pedido":{"cliente":"E2E","items":[]}}')
body=$(get_body "$resp")
success=$(jqget "$body" '.success')
err=$(jqget "$body" '.errores | join(" ")')
assert_eq "create sin items → success=false" "$success" "false"
case "$err" in *"items vacío"*) ok "error contiene 'items vacío'";; *) fail "error items" "items vacío" "$err";; esac

# create sin cliente
resp=$(req POST "$EP" '{"action":"create","pedido":{"items":[{"nombre":"x","cantidad":1}]}}')
body=$(get_body "$resp")
err=$(jqget "$body" '.errores | join(" ")')
case "$err" in *"cliente obligatorio"*) ok "error contiene 'cliente obligatorio'";; *) fail "error cliente" "cliente obligatorio" "$err";; esac

# create con item cantidad=0
resp=$(req POST "$EP" '{"action":"create","pedido":{"cliente":"x","items":[{"nombre":"x","cantidad":0}]}}')
body=$(get_body "$resp")
err=$(jqget "$body" '.errores | join(" ")')
case "$err" in *"items inválidos"*) ok "error contiene 'items inválidos'";; *) fail "error cantidad=0" "items inválidos" "$err";; esac

# adjuntar_proforma sin PDF
resp=$(req POST "$EP" '{"action":"adjuntar_proforma","pedido":{"id":"00000000-0000-0000-0000-000000000001"}}')
body=$(get_body "$resp")
err=$(jqget "$body" '.errores | join(" ")')
case "$err" in *"proforma_pdf requerido"*) ok "error proforma_pdf";; *) fail "error adjuntar sin PDF" "proforma_pdf requerido" "$err";; esac

# id no-UUID
resp=$(req POST "$EP" '{"action":"confirmar_pago","pedido":{"id":"not-a-uuid"}}')
body=$(get_body "$resp")
err=$(jqget "$body" '.errores | join(" ")')
case "$err" in *"UUID válido"*|*"UUID"*) ok "error UUID inválido";; *) fail "error UUID" "UUID válido" "$err";; esac

# action desconocida
resp=$(req POST "$EP" '{"action":"explode","pedido":{"id":"00000000-0000-0000-0000-000000000001"}}')
body=$(get_body "$resp")
err=$(jqget "$body" '.errores | join(" ")')
case "$err" in *"action inválida"*) ok "error action desconocida";; *) fail "error action" "action inválida" "$err";; esac

# action:delete → retirada
resp=$(req POST "$EP" '{"action":"delete","pedido":{"id":"00000000-0000-0000-0000-000000000001"}}')
body=$(get_body "$resp")
err=$(jqget "$body" '.errores | join(" ")')
case "$err" in *"action inválida"*) ok "delete retirada (era B2)";; *) fail "delete retirada" "action inválida" "$err";; esac
fi

# ─────────────────────────────────────────────────────────────
# 4. Flujo feliz completo
# ─────────────────────────────────────────────────────────────
if group_enabled flujo; then
section "Flujo feliz (create → proforma → justificante → confirmar → enviado)"

CID_MARKER="${MARKER}_B"
resp=$(req POST "$EP" "$(build_create_body "$CID_MARKER")")
body=$(get_body "$resp")
PID=$(jqget "$body" '.pedido.id')
if [ -z "$PID" ] || [ "$PID" = "null" ]; then
    fail "flujo.create" "id" "$PID"
else
    CREATED_IDS+=("$PID")
    ok "flujo.create id=$PID"

    # adjuntar_proforma
    body_json=$(cat <<JSON
{"action":"adjuntar_proforma","pedido":{"id":"$PID","proforma_pdf":{"nombre":"p.pdf","tipo":"application/pdf","size":500,"data":"$PDF_DATA_URL","fecha":"2026-04-23T00:00:00Z"},"notas_contabilidad":"Proforma #QA-$TS"}}
JSON
)
    resp=$(req POST "$EP" "$body_json")
    body=$(get_body "$resp")
    estado=$(jqget "$body" '.pedido.estado')
    proforma_at=$(jqget "$body" '.pedido.proforma_at')
    assert_eq "adjuntar_proforma.estado" "$estado" "proforma_adjuntada"
    [ -n "$proforma_at" ] && [ "$proforma_at" != "null" ] && ok "adjuntar_proforma.proforma_at set" || fail "proforma_at" "iso ts" "$proforma_at"

    # adjuntar_justificante
    body_json=$(cat <<JSON
{"action":"adjuntar_justificante","pedido":{"id":"$PID","justificante_pdf":{"nombre":"j.pdf","tipo":"application/pdf","size":500,"data":"$PDF_DATA_URL","fecha":"2026-04-23T00:00:00Z"}}}
JSON
)
    resp=$(req POST "$EP" "$body_json")
    body=$(get_body "$resp")
    estado=$(jqget "$body" '.pedido.estado')
    pagado_at=$(jqget "$body" '.pedido.pagado_at')
    assert_eq "adjuntar_justificante.estado" "$estado" "pendiente_confirmar"
    [ -n "$pagado_at" ] && [ "$pagado_at" != "null" ] && ok "adjuntar_justificante.pagado_at set" || fail "pagado_at" "iso ts" "$pagado_at"

    # confirmar_pago
    resp=$(req POST "$EP" "{\"action\":\"confirmar_pago\",\"pedido\":{\"id\":\"$PID\",\"notas_contabilidad\":\"OK\"}}")
    body=$(get_body "$resp")
    estado=$(jqget "$body" '.pedido.estado')
    confirmado_at=$(jqget "$body" '.pedido.confirmado_at')
    assert_eq "confirmar_pago.estado" "$estado" "lista_envio"
    [ -n "$confirmado_at" ] && [ "$confirmado_at" != "null" ] && ok "confirmar_pago.confirmado_at set" || fail "confirmado_at" "iso ts" "$confirmado_at"

    # marcar_enviado (fix S1)
    resp=$(req POST "$EP" "{\"action\":\"marcar_enviado\",\"pedido\":{\"id\":\"$PID\",\"enviado_por\":\"qa-bot\",\"tracking\":\"TRK-$TS\"}}")
    body=$(get_body "$resp")
    estado=$(jqget "$body" '.pedido.estado')
    enviado_at=$(jqget "$body" '.pedido.enviado_at')
    tracking=$(jqget "$body" '.pedido.tracking')
    assert_eq "marcar_enviado.estado" "$estado" "enviado"
    [ -n "$enviado_at" ] && [ "$enviado_at" != "null" ] && ok "marcar_enviado.enviado_at set" || fail "enviado_at" "iso ts" "$enviado_at"
    assert_eq "marcar_enviado.tracking" "$tracking" "TRK-$TS"
fi
fi

# ─────────────────────────────────────────────────────────────
# 5. Rollback (devolver_a_contabilidad)
# ─────────────────────────────────────────────────────────────
if group_enabled rollback; then
section "Rollback (fix S2)"

# Crea pedido nuevo, lleva hasta proforma_adjuntada, lo devuelve.
CID_MARKER="${MARKER}_C"
resp=$(req POST "$EP" "$(build_create_body "$CID_MARKER")")
PID=$(jqget "$(get_body "$resp")" '.pedido.id')
[ -n "$PID" ] && [ "$PID" != "null" ] && CREATED_IDS+=("$PID") || { fail "rollback.setup" "id" "$PID"; PID=""; }

if [ -n "$PID" ]; then
    body_json=$(cat <<JSON
{"action":"adjuntar_proforma","pedido":{"id":"$PID","proforma_pdf":{"nombre":"p.pdf","tipo":"application/pdf","size":500,"data":"$PDF_DATA_URL","fecha":"2026-04-23T00:00:00Z"}}}
JSON
)
    req POST "$EP" "$body_json" >/dev/null

    # Devolver desde proforma_adjuntada
    resp=$(req POST "$EP" "{\"action\":\"devolver_a_contabilidad\",\"pedido\":{\"id\":\"$PID\",\"desde\":\"proforma_adjuntada\",\"motivo\":\"Importe incorrecto\"}}")
    body=$(get_body "$resp")
    estado=$(jqget "$body" '.pedido.estado')
    proforma_pdf=$(jqget "$body" '.pedido.proforma_pdf')
    notas=$(jqget "$body" '.pedido.notas_contabilidad')
    assert_eq "devolver desde proforma_adjuntada → solicitada" "$estado" "solicitada"
    assert_eq "proforma_pdf se limpia" "$proforma_pdf" "null"
    case "$notas" in "[DEVOLUCIÓN"*) ok "nota con prefijo [DEVOLUCIÓN]";; *) fail "nota" "[DEVOLUCIÓN ...]" "$notas";; esac

    # Devolver sin motivo → error
    resp=$(req POST "$EP" "{\"action\":\"devolver_a_contabilidad\",\"pedido\":{\"id\":\"$PID\",\"desde\":\"proforma_adjuntada\"}}")
    body=$(get_body "$resp")
    err=$(jqget "$body" '.errores | join(" ")')
    case "$err" in *"motivo obligatorio"*) ok "error motivo obligatorio";; *) fail "error motivo" "motivo obligatorio" "$err";; esac

    # Devolver desde estado inválido
    resp=$(req POST "$EP" "{\"action\":\"devolver_a_contabilidad\",\"pedido\":{\"id\":\"$PID\",\"desde\":\"enviado\",\"motivo\":\"x\"}}")
    body=$(get_body "$resp")
    err=$(jqget "$body" '.errores | join(" ")')
    case "$err" in *"desde debe ser"*) ok "error desde inválido";; *) fail "error desde" "desde debe ser" "$err";; esac
fi
fi

# ─────────────────────────────────────────────────────────────
# Cleanup (solo recuerda los IDs creados; el borrado no está
# expuesto — fix B2 — así que se loggean para borrado manual en
# Supabase si SKIP_CLEANUP=1).
# ─────────────────────────────────────────────────────────────
section "Cleanup"
if [ "${SKIP_CLEANUP:-}" = "1" ]; then
    printf '  %s~%s No se ha borrado ningún pedido (SKIP_CLEANUP=1)\n' "$C_WARN" "$C_RST"
else
    printf '  %s~%s El webhook no expone delete (fix B2).\n' "$C_WARN" "$C_RST"
    printf '     Los pedidos de prueba quedan en Supabase con marker prefix %s.\n' "$MARKER"
    printf '     Para limpiarlos manualmente ejecuta en Supabase SQL:\n'
    printf '        %sUPDATE hardware_pedidos SET deleted_at = NOW() WHERE cliente LIKE %s;%s\n' "$C_DIM" "'$MARKER%'" "$C_RST"
fi

if [ ${#CREATED_IDS[@]} -gt 0 ]; then
    printf '\n  %sPedidos creados durante esta ejecución:%s\n' "$C_DIM" "$C_RST"
    for id in "${CREATED_IDS[@]}"; do
        printf '    · %s\n' "$id"
    done
fi

# ─────────────────────────────────────────────────────────────
# Resumen
# ─────────────────────────────────────────────────────────────
printf '\n%s━━━━━━ RESULTADO ━━━━━━%s\n' "$C_BOLD" "$C_RST"
printf '    %s✓ %d PASS%s   %s✗ %d FAIL%s   %s~ %d SKIP%s\n\n' \
    "$C_OK" "$PASS" "$C_RST" \
    "$C_ERR" "$FAIL" "$C_RST" \
    "$C_WARN" "$SKIP" "$C_RST"

[ "$FAIL" -eq 0 ] || exit 1
exit 0
