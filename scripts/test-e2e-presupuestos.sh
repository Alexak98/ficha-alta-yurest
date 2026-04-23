#!/usr/bin/env bash
# ===============================================================
# E2E del módulo Presupuestos (departamento Producto) del portal Yurest.
#
# Cobertura (ver docs/QA-PRESUPUESTOS.md):
#
#   1. Auth negativa en GET (401) y POST (401)
#   2. Create happy path — devuelve id + shape correcto
#   3. Listado GET + totales agregados
#   4. Validaciones: cliente/desarrollo obligatorios, UUID, enums,
#      horas fuera de rango, coste negativo, action desconocida,
#      delete retirada
#   5. Flujo: create → update → marcar_enviado → aceptar → entregar →
#      archivar → reactivar
#   6. Filtros GET: ?estado, ?estado_entrega, ?entorno, ?quien_abona,
#      ?cliente (contains)
#
# Uso:
#   YUREST_BASIC_AUTH='dXNlcjpwYXNz' ./scripts/test-e2e-presupuestos.sh
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
EP="$BASE/presupuestos"

if [ -z "${YUREST_BASIC_AUTH:-}" ]; then
    echo "ERROR: falta env var YUREST_BASIC_AUTH (base64 de user:pass)" >&2
    exit 2
fi

AUTH="Authorization: Basic $YUREST_BASIC_AUTH"
TS=$(date +%s)
MARKER="E2E_PRES_$TS"
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
    local marker="$1"
    local entorno="${2:-backoffice}"
    local abona="${3:-cliente}"
    local hy="${4:-0}"
    local hc="${5:-10}"
    cat <<JSON
{
  "action": "create",
  "presupuesto": {
    "cliente": "$marker",
    "entorno": "$entorno",
    "desarrollo": "Desarrollo E2E $marker",
    "quien_abona": "$abona",
    "estado": "en_espera",
    "horas_yurest": $hy,
    "coste_yurest": $(awk -v h="$hy" 'BEGIN{printf "%.2f", h*85}'),
    "horas_cliente": $hc,
    "coste_cliente": $(awk -v h="$hc" 'BEGIN{printf "%.2f", h*85}'),
    "estado_entrega": "pendiente",
    "notas": "creado por E2E",
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

resp=$(req POST "$EP" "$(build_create_body "${MARKER}_NOAUTH")" 0)
status=$(get_status "$resp")
assert_eq "POST sin auth → 401" "$status" "401"

resp=$(req GET "$EP" "")
status=$(get_status "$resp")
assert_eq "GET con auth → 200" "$status" "200"
fi

# ─────────────────────────────────────────────────────────────
# 2. Create happy + listado + totales
# ─────────────────────────────────────────────────────────────
if group_enabled crud; then
section "Create + listado + totales"

CID_MARKER="${MARKER}_A"
resp=$(req POST "$EP" "$(build_create_body "$CID_MARKER" backoffice cliente 0 10)")
status=$(get_status "$resp"); body=$(get_body "$resp")
assert_eq "POST create → 200" "$status" "200"
vdump "$body"

success=$(jqget "$body" '.success')
pid=$(jqget "$body" '.presupuesto.id')
estado=$(jqget "$body" '.presupuesto.estado')
entorno=$(jqget "$body" '.presupuesto.entorno')
hc=$(jqget "$body" '.presupuesto.horas_cliente')
assert_eq "create.success"   "$success" "true"
assert_eq "create.estado"    "$estado"  "en_espera"
assert_eq "create.entorno"   "$entorno" "backoffice"
assert_eq "create.horas_cli" "$hc"      "10"
if [ -n "$pid" ] && [ "$pid" != "null" ]; then
    CREATED_IDS+=("$pid")
    ok "create.id = $pid"
else
    fail "create.id" "uuid" "$pid"
fi

# GET listado total
resp=$(req GET "$EP")
body=$(get_body "$resp")
count=$(jqget "$body" '.presupuestos | length')
[ -n "$count" ] && [ "$count" -ge 1 ] && ok "GET devuelve presupuestos[] (n=$count)" || fail "GET listado" ">=1" "$count"

# totales agregados existen
tot_hc=$(jqget "$body" '.totales.horas_cliente')
tot_cc=$(jqget "$body" '.totales.coste_cliente')
[ -n "$tot_hc" ] && [ "$tot_hc" != "null" ] && ok "totales.horas_cliente=$tot_hc" || fail "totales.horas_cliente" "numérico" "$tot_hc"
[ -n "$tot_cc" ] && [ "$tot_cc" != "null" ] && ok "totales.coste_cliente=$tot_cc" || fail "totales.coste_cliente" "numérico" "$tot_cc"
fi

# ─────────────────────────────────────────────────────────────
# 3. Validaciones
# ─────────────────────────────────────────────────────────────
if group_enabled validacion; then
section "Validación de input"

# create sin cliente
resp=$(req POST "$EP" '{"action":"create","presupuesto":{"desarrollo":"X"}}')
body=$(get_body "$resp")
success=$(jqget "$body" '.success')
err=$(jqget "$body" '.errores | join(" ")')
assert_eq "create sin cliente → success=false" "$success" "false"
case "$err" in *"cliente obligatorio"*) ok "error contiene 'cliente obligatorio'";; *) fail "error cliente" "cliente obligatorio" "$err";; esac

# create sin desarrollo
resp=$(req POST "$EP" '{"action":"create","presupuesto":{"cliente":"X"}}')
body=$(get_body "$resp")
err=$(jqget "$body" '.errores | join(" ")')
case "$err" in *"desarrollo obligatorio"*) ok "error desarrollo obligatorio";; *) fail "error desarrollo" "desarrollo obligatorio" "$err";; esac

# entorno inválido
resp=$(req POST "$EP" '{"action":"create","presupuesto":{"cliente":"X","desarrollo":"Y","entorno":"marte"}}')
body=$(get_body "$resp")
err=$(jqget "$body" '.errores | join(" ")')
case "$err" in *"entorno"*) ok "error entorno inválido";; *) fail "error entorno" "entorno debe ser" "$err";; esac

# horas fuera de rango
resp=$(req POST "$EP" '{"action":"create","presupuesto":{"cliente":"X","desarrollo":"Y","entorno":"backoffice","horas_yurest":99999}}')
body=$(get_body "$resp")
err=$(jqget "$body" '.errores | join(" ")')
case "$err" in *"horas_yurest"*) ok "error horas_yurest rango";; *) fail "horas rango" "horas_yurest fuera de rango" "$err";; esac

# coste negativo
resp=$(req POST "$EP" '{"action":"create","presupuesto":{"cliente":"X","desarrollo":"Y","entorno":"backoffice","coste_cliente":-10}}')
body=$(get_body "$resp")
err=$(jqget "$body" '.errores | join(" ")')
case "$err" in *"coste_cliente"*) ok "error coste_cliente negativo";; *) fail "coste negativo" "coste_cliente fuera de rango" "$err";; esac

# quien_abona inválido
resp=$(req POST "$EP" '{"action":"create","presupuesto":{"cliente":"X","desarrollo":"Y","entorno":"backoffice","quien_abona":"marte"}}')
body=$(get_body "$resp")
err=$(jqget "$body" '.errores | join(" ")')
case "$err" in *"quien_abona"*) ok "error quien_abona inválido";; *) fail "quien_abona" "quien_abona debe ser" "$err";; esac

# update sin id
resp=$(req POST "$EP" '{"action":"update","presupuesto":{"cliente":"X"}}')
body=$(get_body "$resp")
err=$(jqget "$body" '.errores | join(" ")')
case "$err" in *"id obligatorio"*) ok "update sin id → error id obligatorio";; *) fail "error id" "id obligatorio" "$err";; esac

# id no-UUID
resp=$(req POST "$EP" '{"action":"update","presupuesto":{"id":"nope","cliente":"X"}}')
body=$(get_body "$resp")
err=$(jqget "$body" '.errores | join(" ")')
case "$err" in *"UUID"*) ok "id no-UUID → error UUID";; *) fail "error UUID" "UUID válido" "$err";; esac

# action desconocida
resp=$(req POST "$EP" '{"action":"explode","presupuesto":{"id":"00000000-0000-0000-0000-000000000001"}}')
body=$(get_body "$resp")
err=$(jqget "$body" '.errores | join(" ")')
case "$err" in *"action inválida"*) ok "error action desconocida";; *) fail "error action" "action inválida" "$err";; esac

# action:delete retirada
resp=$(req POST "$EP" '{"action":"delete","presupuesto":{"id":"00000000-0000-0000-0000-000000000001"}}')
body=$(get_body "$resp")
err=$(jqget "$body" '.errores | join(" ")')
case "$err" in *"action inválida"*) ok "delete no expuesta";; *) fail "delete retirada" "action inválida" "$err";; esac

# estado inválido en update
resp=$(req POST "$EP" '{"action":"update","presupuesto":{"id":"00000000-0000-0000-0000-000000000001","estado":"zombie"}}')
body=$(get_body "$resp")
err=$(jqget "$body" '.errores | join(" ")')
case "$err" in *"estado debe ser"*) ok "update estado inválido → error";; *) fail "error estado" "estado debe ser" "$err";; esac

# estado_entrega inválido
resp=$(req POST "$EP" '{"action":"update","presupuesto":{"id":"00000000-0000-0000-0000-000000000001","estado_entrega":"moon"}}')
body=$(get_body "$resp")
err=$(jqget "$body" '.errores | join(" ")')
case "$err" in *"estado_entrega"*) ok "estado_entrega inválido → error";; *) fail "estado_entrega" "estado_entrega debe ser" "$err";; esac
fi

# ─────────────────────────────────────────────────────────────
# 4. Flujo completo: create → update → marcar_enviado → aceptar → entregar → archivar → reactivar
# ─────────────────────────────────────────────────────────────
if group_enabled flujo; then
section "Flujo (create → update → enviado → aceptar → entregar → archivar → reactivar)"

CID_MARKER="${MARKER}_B"
resp=$(req POST "$EP" "$(build_create_body "$CID_MARKER" app_cliente cliente 5 5)")
body=$(get_body "$resp")
PID=$(jqget "$body" '.presupuesto.id')
if [ -z "$PID" ] || [ "$PID" = "null" ]; then
    fail "flujo.create" "id" "$PID"
else
    CREATED_IDS+=("$PID")
    ok "flujo.create id=$PID"

    # update
    resp=$(req POST "$EP" "{\"action\":\"update\",\"presupuesto\":{\"id\":\"$PID\",\"notas\":\"Actualizado\",\"horas_cliente\":12}}")
    body=$(get_body "$resp")
    notas=$(jqget "$body" '.presupuesto.notas')
    hc=$(jqget "$body" '.presupuesto.horas_cliente')
    assert_eq "update.notas" "$notas" "Actualizado"
    assert_eq "update.horas_cliente" "$hc" "12"

    # marcar_enviado
    resp=$(req POST "$EP" "{\"action\":\"marcar_enviado\",\"presupuesto\":{\"id\":\"$PID\",\"enviado\":true}}")
    body=$(get_body "$resp")
    env=$(jqget "$body" '.presupuesto.enviado')
    assert_eq "marcar_enviado.enviado" "$env" "true"

    # aceptar
    resp=$(req POST "$EP" "{\"action\":\"aceptar\",\"presupuesto\":{\"id\":\"$PID\"}}")
    body=$(get_body "$resp")
    estado=$(jqget "$body" '.presupuesto.estado')
    assert_eq "aceptar.estado" "$estado" "aceptado"

    # entregar
    resp=$(req POST "$EP" "{\"action\":\"entregar\",\"presupuesto\":{\"id\":\"$PID\"}}")
    body=$(get_body "$resp")
    ent=$(jqget "$body" '.presupuesto.estado_entrega')
    assert_eq "entregar.estado_entrega" "$ent" "entregado"

    # archivar
    resp=$(req POST "$EP" "{\"action\":\"archivar\",\"presupuesto\":{\"id\":\"$PID\"}}")
    body=$(get_body "$resp")
    success=$(jqget "$body" '.success')
    deleted_at=$(jqget "$body" '.presupuesto.deleted_at')
    assert_eq "archivar.success" "$success" "true"
    [ -n "$deleted_at" ] && [ "$deleted_at" != "null" ] && ok "archivar.deleted_at set" || fail "deleted_at" "iso ts" "$deleted_at"

    # GET sin flag → la archivada NO aparece
    resp=$(req GET "$EP")
    body=$(get_body "$resp")
    found=$(jqget "$body" ".presupuestos[] | select(.id == \"$PID\") | .id" | head -n1)
    [ -z "$found" ] || [ "$found" = "null" ] && ok "GET sin flag no devuelve archivados" || fail "GET sin flag" "no devuelve $PID" "devolvió $found"

    # reactivar
    resp=$(req POST "$EP" "{\"action\":\"reactivar\",\"presupuesto\":{\"id\":\"$PID\"}}")
    body=$(get_body "$resp")
    success=$(jqget "$body" '.success')
    deleted_at=$(jqget "$body" '.presupuesto.deleted_at')
    assert_eq "reactivar.success" "$success" "true"
    assert_eq "reactivar.deleted_at=null" "$deleted_at" "null"

    # Tras reactivar vuelve a aparecer en el GET
    resp=$(req GET "$EP")
    body=$(get_body "$resp")
    found=$(jqget "$body" ".presupuestos[] | select(.id == \"$PID\") | .id" | head -n1)
    assert_eq "GET post-reactivar devuelve el presupuesto" "$found" "$PID"
fi
fi

# ─────────────────────────────────────────────────────────────
# 5. Filtros GET
# ─────────────────────────────────────────────────────────────
if group_enabled filtros; then
section "Filtros GET"

# ?estado=aceptado → solo aceptados
resp=$(req GET "$EP?estado=aceptado")
body=$(get_body "$resp")
wrong=$(jqget "$body" '[.presupuestos[] | select(.estado != "aceptado")] | length')
assert_eq "?estado=aceptado → 0 distintos de aceptado" "$wrong" "0"

# ?estado=en_espera → solo en_espera
resp=$(req GET "$EP?estado=en_espera")
body=$(get_body "$resp")
wrong=$(jqget "$body" '[.presupuestos[] | select(.estado != "en_espera")] | length')
assert_eq "?estado=en_espera → 0 distintos de en_espera" "$wrong" "0"

# ?entorno=backoffice
resp=$(req GET "$EP?entorno=backoffice")
body=$(get_body "$resp")
wrong=$(jqget "$body" '[.presupuestos[] | select(.entorno != "backoffice")] | length')
assert_eq "?entorno=backoffice → 0 distintos" "$wrong" "0"

# ?quien_abona=cliente
resp=$(req GET "$EP?quien_abona=cliente")
body=$(get_body "$resp")
wrong=$(jqget "$body" '[.presupuestos[] | select(.quien_abona != "cliente")] | length')
assert_eq "?quien_abona=cliente → 0 distintos" "$wrong" "0"

# ?cliente=<marker> → contiene match
resp=$(req GET "$EP?cliente=$MARKER")
body=$(get_body "$resp")
n=$(jqget "$body" '.presupuestos | length')
[ -n "$n" ] && [ "$n" -ge 1 ] && ok "?cliente=$MARKER devuelve >=1" || fail "?cliente filtro" ">=1" "$n"

# Por defecto NO devuelve archivados
resp=$(req GET "$EP")
body=$(get_body "$resp")
arch=$(jqget "$body" '[.presupuestos[] | select(.deleted_at != null)] | length')
assert_eq "GET sin flag → 0 archivados" "$arch" "0"
fi

# ─────────────────────────────────────────────────────────────
# Cleanup
# ─────────────────────────────────────────────────────────────
section "Cleanup"
if [ "${SKIP_CLEANUP:-}" = "1" ]; then
    printf '  %s~%s SKIP_CLEANUP=1 — no se archiva nada.\n' "$C_WARN" "$C_RST"
else
    if [ ${#CREATED_IDS[@]} -gt 0 ]; then
        for id in "${CREATED_IDS[@]}"; do
            req POST "$EP" "{\"action\":\"archivar\",\"presupuesto\":{\"id\":\"$id\"}}" >/dev/null
        done
        printf '  %s~%s Archivados %d presupuestos de prueba.\n' "$C_WARN" "$C_RST" "${#CREATED_IDS[@]}"
    fi
fi

if [ ${#CREATED_IDS[@]} -gt 0 ]; then
    printf '\n  %sPresupuestos creados durante esta ejecución:%s\n' "$C_DIM" "$C_RST"
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
