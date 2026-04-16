#!/usr/bin/env bash
# ===============================================================
# E2E test: guardado y recuperación de ficha con paquetes_carrito,
# campos fin_* y mensualidad_total.
#
# Flujo:
#   1. POST /guardarFicha con una ficha de prueba única.
#   2. GET  /altas → localizar la ficha recién creada por marcador.
#   3. GET  /completar?id=<id> → verificar que los campos vuelven.
#   4. POST /eliminar (soft delete) para limpiar.
#
# Uso:
#   YUREST_BASIC_AUTH='dXNlcjpwYXNz' ./scripts/test-e2e-fichas.sh
#   (base64 de "user:pass")
#
# Opcional:
#   SKIP_CLEANUP=1 → deja la ficha sin borrar para inspección manual
# ===============================================================

set -u

BASE="https://n8n-soporte.data.yurest.dev/webhook"
EP_GUARDAR="$BASE/57e04029-bae4-4124-8c43-c535e831a147"
EP_LISTA="$BASE/018f3362-7969-4c49-9088-c78e4446c77f"
EP_COMPLETAR="$BASE/5a304fcd-ae1d-49e6-92d1-c5a5e007bbfd"
EP_ELIMINAR="$BASE/a2b1b1d6-a1dc-4366-b60e-b5e4506faa3d"

if [ -z "${YUREST_BASIC_AUTH:-}" ]; then
    echo "ERROR: falta env var YUREST_BASIC_AUTH (base64 de user:pass)" >&2
    exit 2
fi

AUTH="Authorization: Basic $YUREST_BASIC_AUTH"
TS=$(date +%s)
MARKER="E2E_QA_$TS"
PASS=0
FAIL=0
DIFF=""

# Colores sólo si stdout es tty
if [ -t 1 ]; then
    C_OK=$'\033[32m'; C_ERR=$'\033[31m'; C_DIM=$'\033[2m'; C_RST=$'\033[0m'
else
    C_OK=''; C_ERR=''; C_DIM=''; C_RST=''
fi

ok()   { PASS=$((PASS+1)); printf '%s ✓ %s%s\n' "$C_OK" "$1" "$C_RST"; }
fail() { FAIL=$((FAIL+1)); DIFF="$DIFF\n$1 — esperado='$2' obtenido='$3'"; printf '%s ✗ %s%s\n   esperado: %s\n   obtenido: %s\n' "$C_ERR" "$1" "$C_RST" "$2" "$3"; }

# ------------------------------------------------------------------
# 1) POST guardar ficha
# ------------------------------------------------------------------
echo "${C_DIM}[1/4] POST guardar ficha (marker=$MARKER)${C_RST}"

PAYLOAD=$(cat <<EOF
{
  "Comercial": "qa-bot",
  "Nombre Sociedad": "$MARKER SL",
  "Nombre Comercial": "$MARKER",
  "Calle": "C/ QA",
  "Número": "1",
  "CP": "28001",
  "Municipio": "Madrid",
  "Provincia": "Madrid",
  "CIF/NIF": "B99999999",
  "Email": "qa@example.com",
  "IBAN": "ES9121000418450200051332",
  "Tipo Cliente": "corporate",
  "Firmas Contratadas": "100",
  "Módulos": "Compras,Cocina,Stock,Finanzas",
  "ImporteSetup": 500,
  "Descuentosetup": 15,
  "Mensualidad Total Locales": 250,
  "Mensualidad Anualizada": 3000,
  "Proyecto de Implementación": 500,
  "Plan Producto BASIC": 0,
  "Plan Producto PRO": 0,
  "Plan RRHH": 0,
  "Plan Operaciones": 0,
  "Yurest Lite": 0,
  "Integraciones": 100,
  "paquetes_carrito": {
    "items": [
      { "id": "corp_compras",  "pago": "unico", "precio": 99 },
      { "id": "corp_finanzas", "pago": "unico", "precio": 77 }
    ],
    "descuentos":   { "cart": 0, "corp_setup": 15, "corp_recur": 5, "planes_setup": 0, "planes_recur": 0 },
    "periodos":     { "corp": "anual", "planes": "mensual", "mensual_anualizada": true },
    "locales_mensual":     [120, 130],
    "corp_module_locales": { "corp_compras": [0, 1], "corp_finanzas": [0] }
  },
  "locales": [
    { "nombre": "L1", "calle": "C/ L1", "cp": "28001" },
    { "nombre": "L2", "calle": "C/ L2", "cp": "28002" }
  ]
}
EOF
)

POST_RES=$(curl -sS -w "\n%{http_code}" -H "$AUTH" -H 'Content-Type: application/json' \
    -X POST "$EP_GUARDAR" --data "$PAYLOAD")
POST_CODE=$(echo "$POST_RES" | tail -1)
POST_BODY=$(echo "$POST_RES" | sed '$d')
if [ "$POST_CODE" != "200" ]; then
    echo "${C_ERR}POST devolvió $POST_CODE${C_RST}"
    echo "$POST_BODY"
    exit 1
fi
ok "POST guardar → 200"

# ------------------------------------------------------------------
# 2) GET lista → localizar por marker
# ------------------------------------------------------------------
echo "${C_DIM}[2/4] GET lista → localizar ficha${C_RST}"

LIST=$(curl -sS -H "$AUTH" "$EP_LISTA")
FICHA_ID=$(echo "$LIST" | jq -r --arg m "$MARKER" '
    (.clientes // . // []) | map(select((.nombre_comercial // ."Nombre Comercial" // "") == $m)) | (.[-1].id // empty)
')
if [ -z "$FICHA_ID" ]; then
    fail "Localizar ficha por marcador" "$MARKER encontrado" "no encontrada"
    echo "$LIST" | jq '.clientes // . | length' 2>/dev/null | sed 's/^/  total clientes: /'
    exit 1
fi
ok "Ficha localizada → id=$FICHA_ID"

# ------------------------------------------------------------------
# 3) GET /completar?id=<id> → verificar campos
# ------------------------------------------------------------------
echo "${C_DIM}[3/4] GET completar-ficha → verificar campos${C_RST}"

CF=$(curl -sS -H "$AUTH" "$EP_COMPLETAR?id=$FICHA_ID")

# Asserts sencillos con jq
assert() {
    local label="$1" jq_expr="$2" expected="$3"
    local got
    got=$(echo "$CF" | jq -r "$jq_expr // \"\"")
    if [ "$got" = "$expected" ]; then
        ok "$label = $expected"
    else
        fail "$label" "$expected" "$got"
    fi
}

# Numérico: compara como float (tolera "500" vs "500.00").
assert_num() {
    local label="$1" jq_expr="$2" expected="$3"
    local got
    got=$(echo "$CF" | jq -r "$jq_expr // 0 | tonumber? // 0")
    if awk -v a="$got" -v b="$expected" 'BEGIN { exit !(a == b) }'; then
        ok "$label = $expected"
    else
        fail "$label" "$expected" "$got"
    fi
}

assert "Nombre Comercial"           '."Nombre Comercial"'            "$MARKER"
assert "IBAN"                       '."IBAN"'                         "ES9121000418450200051332"
assert "Tipo Cliente"               '."Tipo Cliente"'                 "corporate"
assert "Firmas Contratadas"         '."Firmas Contratadas"'           "100"
assert_num "ImporteSetup"               '."ImporteSetup"'               500
assert_num "Descuentosetup"             '."Descuentosetup"'             15
assert_num "Mensualidad Total Locales"  '."Mensualidad Total Locales"'  250
assert_num "Mensualidad Anualizada"     '."Mensualidad Anualizada"'     3000
assert_num "Proyecto de Implementación" '."Proyecto de Implementación"' 500
assert_num "Integraciones"              '."Integraciones"'              100

# paquetes_carrito: verificar que es un objeto con items restaurables
CARRITO_ITEMS=$(echo "$CF" | jq -c '.paquetes_carrito.items // []')
CARRITO_DESC=$(echo "$CF" | jq -r '.paquetes_carrito.descuentos.corp_setup // "" | tostring')
CARRITO_PERIODO=$(echo "$CF" | jq -r '.paquetes_carrito.periodos.corp // ""')
CARRITO_LOCALES=$(echo "$CF" | jq -c '.paquetes_carrito.corp_module_locales.corp_compras // []')

[ "$CARRITO_ITEMS" = '[{"id":"corp_compras","pago":"unico","precio":99},{"id":"corp_finanzas","pago":"unico","precio":77}]' ] \
    && ok "paquetes_carrito.items round-trip" \
    || fail "paquetes_carrito.items" "corp_compras+corp_finanzas" "$CARRITO_ITEMS"
[ "$CARRITO_DESC"     = "15" ]                     && ok "paquetes_carrito.descuentos.corp_setup = 15"        || fail "paquetes_carrito.descuentos.corp_setup" "15" "$CARRITO_DESC"
[ "$CARRITO_PERIODO"  = "anual" ]                  && ok "paquetes_carrito.periodos.corp = anual"             || fail "paquetes_carrito.periodos.corp" "anual" "$CARRITO_PERIODO"
[ "$CARRITO_LOCALES"  = '[0,1]' ]                  && ok "paquetes_carrito.corp_module_locales.corp_compras = [0,1]" || fail "paquetes_carrito.corp_module_locales.corp_compras" "[0,1]" "$CARRITO_LOCALES"

# ------------------------------------------------------------------
# 4) Limpieza (soft delete)
# ------------------------------------------------------------------
if [ -z "${SKIP_CLEANUP:-}" ]; then
    echo "${C_DIM}[4/4] Soft delete de la ficha de prueba${C_RST}"
    DEL_RES=$(curl -sS -o /dev/null -w "%{http_code}" -H "$AUTH" -H 'Content-Type: application/json' \
        -X POST "$EP_ELIMINAR" --data "{\"entity\":\"ficha\",\"id\":\"$FICHA_ID\"}")
    [ "$DEL_RES" = "200" ] && ok "DELETE → 200" || fail "DELETE" "200" "$DEL_RES"
else
    echo "${C_DIM}[4/4] SKIP_CLEANUP=1 → ficha $FICHA_ID queda en la BD${C_RST}"
fi

# ------------------------------------------------------------------
# Resumen
# ------------------------------------------------------------------
echo
echo "════════════════════════════════════════"
printf "RESULTADO: %s%d PASS%s / %s%d FAIL%s\n" "$C_OK" "$PASS" "$C_RST" "$C_ERR" "$FAIL" "$C_RST"
echo "════════════════════════════════════════"
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
