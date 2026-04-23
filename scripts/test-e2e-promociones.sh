#!/usr/bin/env bash
# ===============================================================
# E2E del módulo Promociones del portal Yurest.
#
# Cobertura (ver docs/QA-PROMOCIONES-HALLAZGOS.md):
#
#   1. Auth negativa en GET (401) y POST (401) — fix B1
#   2. Create happy path — devuelve id + estado=activa
#   3. Listado GET + flags manana_disponible/tarde_disponible/full
#   4. Validaciones: sin nombre, id no-UUID, action desconocida,
#      plazas fuera de rango, delete retirada — fixes B2, F1, F2
#   5. Flujo: create → update → cerrar → archivar → reactivar — fix S2
#   6. Filtros GET: ?estado=, ?incluir_archivadas= — fix B6
#
# Uso:
#   YUREST_BASIC_AUTH='dXNlcjpwYXNz' ./scripts/test-e2e-promociones.sh
#   (base64 de "user:pass")
#
# Opcional:
#   SKIP_CLEANUP=1            → no archiva los registros creados
#   ONLY=auth,crud,flujo,...  → solo grupos indicados
#   VERBOSE=1                 → imprime respuestas completas
#   BASE=<url>                → sobreescribe el webhook base
# ===============================================================

set -u

BASE="${BASE:-https://n8n-soporte.data.yurest.dev/webhook}"
EP="$BASE/promociones"

if [ -z "${YUREST_BASIC_AUTH:-}" ]; then
    echo "ERROR: falta env var YUREST_BASIC_AUTH (base64 de user:pass)" >&2
    exit 2
fi

AUTH="Authorization: Basic $YUREST_BASIC_AUTH"
TS=$(date +%s)
MARKER="E2E_PROMO_$TS"
PASS=0
FAIL=0
SKIP=0
CREATED_IDS=()

ONLY="${ONLY:-auth,crud,flujo,filtros,validacion}"
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

get_status() { printf '%s' "$1" | awk -F'__STATUS__' '{code=$NF} END{print code}' | tr -d '\r\n'; }
get_body()   { printf '%s' "$1" | awk -F'__STATUS__' 'NR==1{printf "%s", $0; printed=1; next}'; }

vdump() { [ -n "$VERBOSE" ] && printf '%s    %s%s\n' "$C_DIM" "$1" "$C_RST" || true; }

jqget() {
    if command -v jq >/dev/null 2>&1; then
        printf '%s' "$1" | jq -r "$2" 2>/dev/null
    else
        local key
        key=$(printf '%s' "$2" | sed 's/^\.//; s/^\.//' )
        printf '%s' "$1" | grep -oE "\"$key\"[[:space:]]*:[[:space:]]*\"[^\"]*\"" | head -n1 | sed -E 's/.*:[[:space:]]*"([^"]*)".*/\1/'
    fi
}

build_create_body() {
    local marker="$1" plazas_m="${2:-8}" plazas_t="${3:-8}"
    cat <<JSON
{
  "action": "create",
  "promocion": {
    "nombre": "$marker",
    "descripcion": "Creada por E2E",
    "fecha_inicio": "2026-06-01",
    "estado": "activa",
    "plazas_manana": $plazas_m,
    "plazas_tarde": $plazas_t,
    "created_by": "qa-bot"
  }
}
JSON
}

# ─────────────────────────────────────────────────────────────
# 1. Auth negativa
# ─────────────────────────────────────────────────────────────
if group_enabled auth; then
section "Auth"

resp=$(req GET "$EP" "" 0)
status=$(get_status "$resp")
assert_eq "GET sin auth → 401" "$status" "401"

resp=$(req POST "$EP" "$(build_create_body "E2E_PROMO_SIN_AUTH")" 0)
status=$(get_status "$resp")
assert_eq "POST sin auth → 401" "$status" "401"

resp=$(req GET "$EP" "")
status=$(get_status "$resp")
assert_eq "GET con auth → 200" "$status" "200"
fi

# ─────────────────────────────────────────────────────────────
# 2. Create happy path + listado + flags
# ─────────────────────────────────────────────────────────────
if group_enabled crud; then
section "Create + listado"

CID_MARKER="${MARKER}_A"
resp=$(req POST "$EP" "$(build_create_body "$CID_MARKER")")
status=$(get_status "$resp"); body=$(get_body "$resp")
assert_eq "POST create → 200" "$status" "200"
vdump "$body"

success=$(jqget "$body" '.success')
promo_id=$(jqget "$body" '.promocion.id')
estado=$(jqget "$body" '.promocion.estado')
pm=$(jqget "$body" '.promocion.plazas_manana')
pt=$(jqget "$body" '.promocion.plazas_tarde')
assert_eq "create.success"  "$success" "true"
assert_eq "create.estado"   "$estado"  "activa"
assert_eq "create.plazas_m" "$pm"      "8"
assert_eq "create.plazas_t" "$pt"      "8"
if [ -n "$promo_id" ] && [ "$promo_id" != "null" ]; then
    CREATED_IDS+=("$promo_id")
    ok "create.id = $promo_id"
else
    fail "create.id" "uuid" "$promo_id"
fi

# GET listado total
resp=$(req GET "$EP")
body=$(get_body "$resp")
count=$(jqget "$body" '.promociones | length')
[ -n "$count" ] && [ "$count" -ge 1 ] && ok "GET devuelve promociones[] (n=$count)" || fail "GET listado" ">=1" "$count"

# flags del objeto recién creado
flag_full=$(jqget "$body" ".promociones[] | select(.id == \"$promo_id\") | .full")
flag_m=$(jqget "$body"   ".promociones[] | select(.id == \"$promo_id\") | .manana_disponible")
flag_t=$(jqget "$body"   ".promociones[] | select(.id == \"$promo_id\") | .tarde_disponible")
assert_eq "flag.full=false (promo recién creada vacía)" "$flag_full" "false"
assert_eq "flag.manana_disponible=true"                 "$flag_m"    "true"
assert_eq "flag.tarde_disponible=true"                  "$flag_t"    "true"
fi

# ─────────────────────────────────────────────────────────────
# 3. Validaciones
# ─────────────────────────────────────────────────────────────
if group_enabled validacion; then
section "Validación de input"

# create sin nombre
resp=$(req POST "$EP" '{"action":"create","promocion":{}}')
body=$(get_body "$resp")
success=$(jqget "$body" '.success')
err=$(jqget "$body" '.errores | join(" ")')
assert_eq "create sin nombre → success=false" "$success" "false"
case "$err" in *"nombre obligatorio"*) ok "error contiene 'nombre obligatorio'";; *) fail "error nombre" "nombre obligatorio" "$err";; esac

# create con plazas > 100
resp=$(req POST "$EP" '{"action":"create","promocion":{"nombre":"X","plazas_manana":200}}')
body=$(get_body "$resp")
err=$(jqget "$body" '.errores | join(" ")')
case "$err" in *"plazas_manana fuera de rango"*) ok "error plazas_manana rango";; *) fail "error plazas rango" "plazas_manana fuera de rango" "$err";; esac

# update sin id
resp=$(req POST "$EP" '{"action":"update","promocion":{"nombre":"X"}}')
body=$(get_body "$resp")
err=$(jqget "$body" '.errores | join(" ")')
case "$err" in *"id obligatorio"*) ok "update sin id → error id obligatorio";; *) fail "error id" "id obligatorio" "$err";; esac

# id no-UUID
resp=$(req POST "$EP" '{"action":"update","promocion":{"id":"nope","nombre":"X"}}')
body=$(get_body "$resp")
err=$(jqget "$body" '.errores | join(" ")')
case "$err" in *"UUID"*) ok "id no-UUID → error UUID";; *) fail "error UUID" "UUID válido" "$err";; esac

# action desconocida
resp=$(req POST "$EP" '{"action":"explode","promocion":{"id":"00000000-0000-0000-0000-000000000001"}}')
body=$(get_body "$resp")
err=$(jqget "$body" '.errores | join(" ")')
case "$err" in *"action inválida"*) ok "error action desconocida";; *) fail "error action" "action inválida" "$err";; esac

# action:delete → retirada
resp=$(req POST "$EP" '{"action":"delete","promocion":{"id":"00000000-0000-0000-0000-000000000001"}}')
body=$(get_body "$resp")
err=$(jqget "$body" '.errores | join(" ")')
case "$err" in *"action inválida"*) ok "delete retirada (era B2)";; *) fail "delete retirada" "action inválida" "$err";; esac

# update con estado inválido
resp=$(req POST "$EP" '{"action":"update","promocion":{"id":"00000000-0000-0000-0000-000000000001","estado":"zombie"}}')
body=$(get_body "$resp")
err=$(jqget "$body" '.errores | join(" ")')
case "$err" in *"estado debe ser"*) ok "update estado inválido → error";; *) fail "error estado" "estado debe ser" "$err";; esac
fi

# ─────────────────────────────────────────────────────────────
# 4. Flujo completo: create → update → cerrar → archivar → reactivar
# ─────────────────────────────────────────────────────────────
if group_enabled flujo; then
section "Flujo feliz (create → update → cerrar → archivar → reactivar)"

CID_MARKER="${MARKER}_B"
resp=$(req POST "$EP" "$(build_create_body "$CID_MARKER" 10 5)")
body=$(get_body "$resp")
PID=$(jqget "$body" '.promocion.id')
if [ -z "$PID" ] || [ "$PID" = "null" ]; then
    fail "flujo.create" "id" "$PID"
else
    CREATED_IDS+=("$PID")
    ok "flujo.create id=$PID"

    # update
    resp=$(req POST "$EP" "{\"action\":\"update\",\"promocion\":{\"id\":\"$PID\",\"descripcion\":\"Actualizada\",\"plazas_manana\":12}}")
    body=$(get_body "$resp")
    desc=$(jqget "$body" '.promocion.descripcion')
    pm=$(jqget "$body" '.promocion.plazas_manana')
    assert_eq "update.descripcion" "$desc" "Actualizada"
    assert_eq "update.plazas_manana" "$pm" "12"

    # cerrar
    resp=$(req POST "$EP" "{\"action\":\"cerrar\",\"promocion\":{\"id\":\"$PID\"}}")
    body=$(get_body "$resp")
    estado=$(jqget "$body" '.promocion.estado')
    assert_eq "cerrar.estado" "$estado" "cerrada"

    # archivar
    resp=$(req POST "$EP" "{\"action\":\"archivar\",\"promocion\":{\"id\":\"$PID\"}}")
    body=$(get_body "$resp")
    success=$(jqget "$body" '.success')
    deleted_at=$(jqget "$body" '.promocion.deleted_at')
    assert_eq "archivar.success" "$success" "true"
    [ -n "$deleted_at" ] && [ "$deleted_at" != "null" ] && ok "archivar.deleted_at set" || fail "deleted_at" "iso ts" "$deleted_at"

    # GET sin flag → la archivada NO aparece
    resp=$(req GET "$EP")
    body=$(get_body "$resp")
    found=$(jqget "$body" ".promociones[] | select(.id == \"$PID\") | .id" | head -n1)
    [ -z "$found" ] || [ "$found" = "null" ] && ok "GET sin flag no devuelve archivadas" || fail "GET sin flag" "no devuelve $PID" "devolvió $found"

    # GET con ?incluir_archivadas=1 → sí aparece
    resp=$(req GET "$EP?incluir_archivadas=1")
    body=$(get_body "$resp")
    found=$(jqget "$body" ".promociones[] | select(.id == \"$PID\") | .id" | head -n1)
    assert_eq "GET ?incluir_archivadas=1 devuelve la archivada" "$found" "$PID"

    # reactivar
    resp=$(req POST "$EP" "{\"action\":\"reactivar\",\"promocion\":{\"id\":\"$PID\"}}")
    body=$(get_body "$resp")
    success=$(jqget "$body" '.success')
    deleted_at=$(jqget "$body" '.promocion.deleted_at')
    assert_eq "reactivar.success" "$success" "true"
    assert_eq "reactivar.deleted_at=null" "$deleted_at" "null"

    # Tras reactivar vuelve a aparecer en el GET normal
    resp=$(req GET "$EP")
    body=$(get_body "$resp")
    found=$(jqget "$body" ".promociones[] | select(.id == \"$PID\") | .id" | head -n1)
    assert_eq "GET post-reactivar devuelve la promo" "$found" "$PID"
fi
fi

# ─────────────────────────────────────────────────────────────
# 5. Filtros GET por estado
# ─────────────────────────────────────────────────────────────
if group_enabled filtros; then
section "Filtros GET"

# Crea una cerrada directamente para asegurarnos de tener muestra
CID_MARKER="${MARKER}_C_CERRADA"
body_json=$(build_create_body "$CID_MARKER" 4 4 | jq -c '.promocion.estado = "cerrada" | .')
resp=$(req POST "$EP" "$body_json")
body=$(get_body "$resp")
CERR_ID=$(jqget "$body" '.promocion.id')
[ -n "$CERR_ID" ] && [ "$CERR_ID" != "null" ] && CREATED_IDS+=("$CERR_ID")

# ?estado=cerrada → solo cerradas
resp=$(req GET "$EP?estado=cerrada")
body=$(get_body "$resp")
wrong=$(jqget "$body" '[.promociones[] | select(.estado != "cerrada")] | length')
assert_eq "?estado=cerrada → 0 distintas de cerrada" "$wrong" "0"

# ?estado=activa → solo activas
resp=$(req GET "$EP?estado=activa")
body=$(get_body "$resp")
wrong=$(jqget "$body" '[.promociones[] | select(.estado != "activa")] | length')
assert_eq "?estado=activa → 0 distintas de activa" "$wrong" "0"

# Por defecto NO devuelve archivadas (ninguna .deleted_at no-null)
resp=$(req GET "$EP")
body=$(get_body "$resp")
arch=$(jqget "$body" '[.promociones[] | select(.deleted_at != null)] | length')
assert_eq "GET sin flag → 0 archivadas" "$arch" "0"
fi

# ─────────────────────────────────────────────────────────────
# Cleanup (archiva los creados si no se pidió SKIP_CLEANUP)
# ─────────────────────────────────────────────────────────────
section "Cleanup"
if [ "${SKIP_CLEANUP:-}" = "1" ]; then
    printf '  %s~%s SKIP_CLEANUP=1 — no se archiva nada.\n' "$C_WARN" "$C_RST"
else
    if [ ${#CREATED_IDS[@]} -gt 0 ]; then
        for id in "${CREATED_IDS[@]}"; do
            req POST "$EP" "{\"action\":\"archivar\",\"promocion\":{\"id\":\"$id\"}}" >/dev/null
        done
        printf '  %s~%s Archivadas %d promociones de prueba.\n' "$C_WARN" "$C_RST" "${#CREATED_IDS[@]}"
    fi
fi

if [ ${#CREATED_IDS[@]} -gt 0 ]; then
    printf '\n  %sPromociones creadas durante esta ejecución:%s\n' "$C_DIM" "$C_RST"
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
