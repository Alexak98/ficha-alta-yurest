#!/usr/bin/env bash
# ===============================================================
# E2E test exhaustivo del módulo Fichas del portal Yurest.
#
# Flujo cubierto (cada bloque es independiente y asertable):
#   1.  Auth negativa en GET /altas (esperado 401)
#   2.  GET /altas con auth (listado)
#   3.  POST /guardarFicha (alta Corporate + 2 locales + carrito completo)
#   4.  GET /altas → localizar ficha por marcador único
#   5.  GET /completar?id=<id> → round-trip de campos y carrito
#   6.  POST /guardarFicha con id (edición: cambia Nombre Comercial)
#   7.  GET /completar → verifica que la edición persistió
#   8.  Edición con 2 locales distintos → detecta duplicados
#   9.  POST /guardarFicha (alta Lite con tablet y dirección de entrega)
#   10. POST /guardarFicha (alta Planes con periodo anual)
#   11. Negativos /completar: id inexistente, 'undefined', vacío
#   12. Negativos /eliminar: UUID inválido, entity desconocida, sin id
#   13. POST /eliminar (soft delete) + verificar que desaparece del listado
#   14. Cleanup de todas las fichas de prueba creadas
#
# Uso:
#   YUREST_BASIC_AUTH='dXNlcjpwYXNz' ./scripts/test-e2e-fichas.sh
#   (base64 de "user:pass")
#
# Opcional:
#   SKIP_CLEANUP=1    → deja las fichas de prueba sin borrar
#   ONLY=auth,crud,edit,locales,lite,planes,negativos
#                      → ejecuta solo los grupos indicados (coma-separado)
#   VERBOSE=1         → imprime las respuestas completas de cada request
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
MARKER_BASE="E2E_QA_$TS"
PASS=0
FAIL=0
SKIP=0
CREATED_IDS=()

ONLY="${ONLY:-auth,crud,edit,locales,lite,planes,negativos}"
VERBOSE="${VERBOSE:-}"

if [ -t 1 ]; then
    C_OK=$'\033[32m'; C_ERR=$'\033[31m'; C_WARN=$'\033[33m'; C_DIM=$'\033[2m'; C_BOLD=$'\033[1m'; C_RST=$'\033[0m'
else
    C_OK=''; C_ERR=''; C_WARN=''; C_DIM=''; C_BOLD=''; C_RST=''
fi

ok()   { PASS=$((PASS+1)); printf '  %s✓%s %s\n' "$C_OK"   "$C_RST" "$1"; }
fail() { FAIL=$((FAIL+1)); printf '  %s✗%s %s\n     esperado: %s\n     obtenido: %s\n' "$C_ERR" "$C_RST" "$1" "$2" "$3"; }
skip() { SKIP=$((SKIP+1)); printf '  %s~%s %s (%s)\n' "$C_WARN" "$C_RST" "$1" "$2"; }
section() { printf '\n%s━━━━━━ %s ━━━━━━%s\n' "$C_BOLD" "$1" "$C_RST"; }
group_enabled() { case ",$ONLY," in *",$1,"*) return 0;; *) return 1;; esac }

# Asserts de texto numérico
assert_eq()     { [ "$2" = "$3" ] && ok "$1 = $3" || fail "$1" "$3" "$2"; }
assert_num_eq() {
    awk -v a="$2" -v b="$3" 'BEGIN { exit !(a+0 == b+0) }' && ok "$1 = $3" || fail "$1" "$3" "$2"
}

# Llamada HTTP con retorno "body\n__STATUS__<code>"
req() {
    local method="$1" url="$2" body="${3:-}" extra_hdr="${4:-}"
    if [ -n "$body" ]; then
        curl -sS -w "\n__STATUS__%{http_code}" -H "$AUTH" -H 'Content-Type: application/json' $extra_hdr -X "$method" "$url" --data "$body"
    else
        curl -sS -w "\n__STATUS__%{http_code}" -H "$AUTH" $extra_hdr -X "$method" "$url"
    fi
}

# Separar status y body de la respuesta
parse_status() { echo "$1" | tail -1 | sed 's/__STATUS__//'; }
parse_body()   { echo "$1" | sed '$d'; }

verbose_body() { [ -n "$VERBOSE" ] && echo "$C_DIM     $(parse_body "$1" | head -c 400)$C_RST" || true; }

# Payload genérico para alta Corporate
payload_corporate() {
    local marker="$1" cif="$2"
    cat <<EOF
{
  "Comercial": "qa-bot",
  "Nombre Sociedad": "$marker SL",
  "Nombre Comercial": "$marker",
  "Calle": "C/ QA",
  "Número": "1",
  "CP": "28001",
  "Municipio": "Madrid",
  "Provincia": "Madrid",
  "CIF/NIF": "$cif",
  "Email": "qa@example.com",
  "IBAN": "ES9121000418450200051332",
  "Tipo Cliente": "corporate",
  "Firmas Contratadas": "100",
  "Módulos": ["Compras","Cocina","Stock","Finanzas"],
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
  "Baja": "No",
  "Estado": "Rellenado",
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
}

# Buscar ficha por marcador en GET /altas. Imprime id o vacío.
buscar_ficha_por_marcador() {
    local marker="$1"
    curl -sS -H "$AUTH" "$EP_LISTA" | jq -r --arg m "$marker" '
        (.clientes // . // []) |
        map(select(
            (.nombre_comercial // ."Nombre Comercial" // "") == $m or
            ((.denominacion // ."Nombre Sociedad" // "") | startswith($m))
        )) |
        (.[-1].id // empty)
    '
}

# ==================================================================
# 1) AUTH
# ==================================================================
if group_enabled "auth"; then
    section "1. AUTH — endpoints deben proteger al menos GET /altas"

    R=$(curl -sS -w "\n__STATUS__%{http_code}" "$EP_LISTA")
    assert_eq "GET /altas sin auth → 401" "$(parse_status "$R")" "401"

    R=$(curl -sS -w "\n__STATUS__%{http_code}" -H "$AUTH" "$EP_LISTA")
    assert_eq "GET /altas con auth → 200" "$(parse_status "$R")" "200"

    # Estos no están protegidos hoy; documentamos el estado real.
    R=$(curl -sS -w "\n__STATUS__%{http_code}" -H 'Content-Type: application/json' -X POST "$EP_GUARDAR" --data '{}')
    if [ "$(parse_status "$R")" = "401" ] || [ "$(parse_status "$R")" = "403" ]; then
        ok "POST /guardarFicha sin auth → $(parse_status "$R") (protegido)"
    else
        fail "POST /guardarFicha sin auth" "401/403" "$(parse_status "$R") (endpoint PÚBLICO)"
    fi

    R=$(curl -sS -w "\n__STATUS__%{http_code}" -H 'Content-Type: application/json' -X POST "$EP_ELIMINAR" --data '{"entity":"ficha","id":"x"}')
    if [ "$(parse_status "$R")" = "401" ] || [ "$(parse_status "$R")" = "403" ]; then
        ok "POST /eliminar sin auth → $(parse_status "$R") (protegido)"
    else
        fail "POST /eliminar sin auth" "401/403" "$(parse_status "$R") (endpoint PÚBLICO)"
    fi
fi

# ==================================================================
# 2) CRUD — crear + listar + leer
# ==================================================================
FICHA_ID_CORP=""
if group_enabled "crud"; then
    section "2. CRUD CORPORATE — POST → GET /altas → GET /completar"

    N_ANTES=$(curl -sS -H "$AUTH" "$EP_LISTA" | jq -r '(.clientes // . // []) | length')
    MARKER="${MARKER_BASE}_CORP"
    PAYLOAD=$(payload_corporate "$MARKER" "B99999999")

    R=$(req POST "$EP_GUARDAR" "$PAYLOAD")
    verbose_body "$R"
    assert_eq "POST /guardarFicha → 200" "$(parse_status "$R")" "200"

    # El body esperado es {"success":true}. Si viene vacío, es síntoma de
    # que el flujo n8n no llegó al nodo Respond (INSERT Ficha falló).
    BODY=$(parse_body "$R" | tr -d '[:space:]')
    [ -n "$BODY" ] && ok "POST body no vacío" || fail "POST body" "{\"success\":true}" "(vacío — INSERT falló)"

    sleep 2
    N_DESPUES=$(curl -sS -H "$AUTH" "$EP_LISTA" | jq -r '(.clientes // . // []) | length')
    if [ "$N_DESPUES" -gt "$N_ANTES" ]; then
        ok "GET /altas: count subió ($N_ANTES → $N_DESPUES)"
    else
        fail "GET /altas: count" ">$N_ANTES" "$N_DESPUES (no persistió)"
    fi

    FICHA_ID_CORP=$(buscar_ficha_por_marcador "$MARKER")
    if [ -n "$FICHA_ID_CORP" ]; then
        ok "Ficha localizada por marcador → id=$FICHA_ID_CORP"
        CREATED_IDS+=("$FICHA_ID_CORP")
    else
        fail "Localizar ficha por marcador" "id devuelto" "no encontrada"
    fi

    # Round-trip completar
    if [ -n "$FICHA_ID_CORP" ]; then
        CF=$(curl -sS -H "$AUTH" "$EP_COMPLETAR?id=$FICHA_ID_CORP")
        assert_eq "completar.Nombre Comercial" "$(echo "$CF" | jq -r '."Nombre Comercial" // ""')" "$MARKER"
        assert_eq "completar.Tipo Cliente"      "$(echo "$CF" | jq -r '."Tipo Cliente" // ""')" "corporate"
        assert_eq "completar.IBAN"              "$(echo "$CF" | jq -r '."IBAN" // ""')" "ES9121000418450200051332"
        assert_num_eq "completar.ImporteSetup"              "$(echo "$CF" | jq -r '."ImporteSetup" // 0')" 500
        assert_num_eq "completar.Mensualidad Total Locales" "$(echo "$CF" | jq -r '."Mensualidad Total Locales" // 0')" 250
        assert_num_eq "completar.Mensualidad Anualizada"    "$(echo "$CF" | jq -r '."Mensualidad Anualizada" // 0')" 3000
        assert_num_eq "completar.Integraciones"             "$(echo "$CF" | jq -r '."Integraciones" // 0')" 100

        CARRITO_DESC=$(echo "$CF" | jq -r '.paquetes_carrito.descuentos.corp_setup // ""')
        assert_eq "paquetes_carrito.descuentos.corp_setup" "$CARRITO_DESC" "15"
        CARRITO_PERIODO=$(echo "$CF" | jq -r '.paquetes_carrito.periodos.corp // ""')
        assert_eq "paquetes_carrito.periodos.corp" "$CARRITO_PERIODO" "anual"
    else
        skip "Round-trip completar" "no hay ficha creada"
    fi
fi

# ==================================================================
# 3) EDICIÓN — cambiar nombre y re-leer
# ==================================================================
if group_enabled "edit"; then
    section "3. EDICIÓN — POST con id, GET /completar tras cambio"

    if [ -z "$FICHA_ID_CORP" ]; then
        skip "Edición" "no hay ficha creada en el paso CRUD"
    else
        MARKER_EDIT="${MARKER_BASE}_CORP_EDIT"
        PAYLOAD_EDIT=$(payload_corporate "$MARKER_EDIT" "B99999999" | jq --arg id "$FICHA_ID_CORP" '. + {id: $id}')
        R=$(req POST "$EP_GUARDAR" "$PAYLOAD_EDIT")
        verbose_body "$R"
        assert_eq "POST edición → 200" "$(parse_status "$R")" "200"

        sleep 2
        CF=$(curl -sS -H "$AUTH" "$EP_COMPLETAR?id=$FICHA_ID_CORP")
        assert_eq "edición.Nombre Comercial aplicado" "$(echo "$CF" | jq -r '."Nombre Comercial" // ""')" "$MARKER_EDIT"
    fi
fi

# ==================================================================
# 4) LOCALES — duplicación al editar (bug conocido en workflow)
# ==================================================================
if group_enabled "locales"; then
    section "4. LOCALES — re-guardar ficha con 2 locales y contar duplicados"

    if [ -z "$FICHA_ID_CORP" ]; then
        skip "Locales" "no hay ficha creada"
    else
        # Re-guardamos la ficha con los mismos 2 locales. Si el workflow
        # no hace UPSERT por (ficha_id, nombre), los locales se duplicarán.
        PAYLOAD_RESAVE=$(payload_corporate "${MARKER_BASE}_CORP_EDIT" "B99999999" | jq --arg id "$FICHA_ID_CORP" '. + {id: $id}')
        R=$(req POST "$EP_GUARDAR" "$PAYLOAD_RESAVE")
        assert_eq "POST re-save → 200" "$(parse_status "$R")" "200"

        # Nota: el endpoint /completar no devuelve locales; el control se
        # debe hacer sobre BD o sobre el panel de detalle del front. Aquí
        # solo dejamos registro de que el endpoint respondió OK.
        skip "Verificar locales no duplicados" "endpoint /completar no expone array de locales — revisar en BD"
    fi
fi

# ==================================================================
# 5) ALTA LITE — con tablet y dirección de entrega
# ==================================================================
if group_enabled "lite"; then
    section "5. ALTA LITE — flujo con tablet + entrega"

    MARKER_LITE="${MARKER_BASE}_LITE"
    PAYLOAD_LITE=$(cat <<EOF
{
  "Comercial": "qa-bot",
  "Nombre Sociedad": "$MARKER_LITE SL",
  "Nombre Comercial": "$MARKER_LITE",
  "CIF/NIF": "B99999999",
  "Tipo Cliente": "lite",
  "Lite": "Sí",
  "Necesita Tablet": "Sí",
  "Entrega Calle": "C/ Entrega", "Entrega Número": "5", "Entrega CP": "46001",
  "Entrega Municipio": "Valencia", "Entrega Provincia": "Valencia",
  "Contacto Nombre": "Ana QA", "Contacto Email": "ana@qa.com", "Contacto Teléfono": "+34600111222",
  "Firmas Contratadas": "",
  "Módulos": [],
  "Estado": "Rellenado", "Baja": "No",
  "ImporteSetup": 490, "Descuentosetup": 0,
  "Mensualidad Total Locales": 79, "Mensualidad Anualizada": 948,
  "Yurest Lite": 490,
  "paquetes_carrito": { "items": [{"id":"lite_setup","pago":"unico","precio":490}], "descuentos": {"cart":0}, "periodos": {"planes":"mensual"}, "locales_mensual":[79], "corp_module_locales":{} },
  "locales": [ {"nombre":"Tienda Lite","calle":"C/L","cp":"46001"} ]
}
EOF
)
    R=$(req POST "$EP_GUARDAR" "$PAYLOAD_LITE")
    assert_eq "POST alta Lite → 200" "$(parse_status "$R")" "200"
    sleep 2
    FID_LITE=$(buscar_ficha_por_marcador "$MARKER_LITE")
    if [ -n "$FID_LITE" ]; then
        ok "Alta Lite persistida → id=$FID_LITE"
        CREATED_IDS+=("$FID_LITE")
        CF=$(curl -sS -H "$AUTH" "$EP_COMPLETAR?id=$FID_LITE")
        assert_eq "lite.Tipo Cliente"   "$(echo "$CF" | jq -r '."Tipo Cliente" // ""')" "lite"
        assert_eq "lite.Entrega CP"     "$(echo "$CF" | jq -r '."Entrega CP" // ""')" "46001"
        assert_eq "lite.Contacto Email" "$(echo "$CF" | jq -r '."Contacto Email" // ""')" "ana@qa.com"
    else
        fail "Alta Lite persistida" "id devuelto" "no encontrada"
    fi
fi

# ==================================================================
# 6) ALTA PLANES — periodo anual + mensual_anualizada
# ==================================================================
if group_enabled "planes"; then
    section "6. ALTA PLANES — periodo anual y flag mensual_anualizada"

    MARKER_PLN="${MARKER_BASE}_PLANES"
    PAYLOAD_PLN=$(cat <<EOF
{
  "Comercial": "qa-bot",
  "Nombre Sociedad": "$MARKER_PLN SL",
  "Nombre Comercial": "$MARKER_PLN",
  "CIF/NIF": "B99999999",
  "Tipo Cliente": "planes",
  "Módulos": ["Compras","Cocina","Stock","Finanzas"],
  "Estado": "Rellenado", "Baja": "No",
  "ImporteSetup": 1580, "Descuentosetup": 0,
  "Plan Producto PRO": 1580,
  "Mensualidad Total Locales": 197, "Mensualidad Anualizada": 2364,
  "paquetes_carrito": {
    "items": [{"id":"plan_pro","pago":"unico","precio":1580}],
    "descuentos": {"cart":0,"planes_setup":0,"planes_recur":0},
    "periodos": {"planes":"anual","mensual_anualizada":true},
    "locales_mensual":[197], "corp_module_locales":{}
  },
  "locales": [ {"nombre":"Sede","calle":"C/S","cp":"28001"} ]
}
EOF
)
    R=$(req POST "$EP_GUARDAR" "$PAYLOAD_PLN")
    assert_eq "POST alta Planes → 200" "$(parse_status "$R")" "200"
    sleep 2
    FID_PLN=$(buscar_ficha_por_marcador "$MARKER_PLN")
    if [ -n "$FID_PLN" ]; then
        ok "Alta Planes persistida → id=$FID_PLN"
        CREATED_IDS+=("$FID_PLN")
        CF=$(curl -sS -H "$AUTH" "$EP_COMPLETAR?id=$FID_PLN")
        assert_eq "planes.Tipo Cliente"             "$(echo "$CF" | jq -r '."Tipo Cliente" // ""')" "planes"
        assert_num_eq "planes.Plan Producto PRO"    "$(echo "$CF" | jq -r '."Plan Producto PRO" // 0')" 1580
        PERIODO=$(echo "$CF" | jq -r '.paquetes_carrito.periodos.planes // ""')
        assert_eq "planes.periodos.planes" "$PERIODO" "anual"
        ANUAL=$(echo "$CF" | jq -r '.paquetes_carrito.periodos.mensual_anualizada // false')
        assert_eq "planes.periodos.mensual_anualizada" "$ANUAL" "true"
    else
        fail "Alta Planes persistida" "id devuelto" "no encontrada"
    fi
fi

# ==================================================================
# 7) NEGATIVOS — casos límite en completar / eliminar
# ==================================================================
if group_enabled "negativos"; then
    section "7. NEGATIVOS — casos límite"

    # /completar con id='undefined' (commit fc578c8 dice que debe rechazarse)
    R=$(req GET "$EP_COMPLETAR?id=undefined" "")
    ST=$(parse_status "$R")
    BODY=$(parse_body "$R")
    if [ "$ST" = "400" ] || echo "$BODY" | jq -e '.error' >/dev/null 2>&1; then
        ok "completar?id=undefined → rechazado ($ST)"
    else
        fail "completar?id=undefined" "400 o error en body" "$ST body=$(echo "$BODY" | head -c 80)"
    fi

    # /completar con UUID que no existe
    R=$(req GET "$EP_COMPLETAR?id=00000000-0000-0000-0000-000000000000" "")
    ST=$(parse_status "$R")
    [ "$ST" = "200" ] && ok "completar?id=<uuid inexistente> → 200 (payload vacío esperado)" \
                     || fail "completar?id=<uuid inexistente>" "200" "$ST"

    # /completar sin id
    R=$(req GET "$EP_COMPLETAR" "")
    ST=$(parse_status "$R")
    if [ "$ST" = "400" ]; then
        ok "completar sin id → 400"
    else
        fail "completar sin id" "400" "$ST"
    fi

    # /eliminar con UUID inválido (no es uuid)
    R=$(req POST "$EP_ELIMINAR" '{"entity":"ficha","id":"not-a-uuid"}')
    ST=$(parse_status "$R")
    if [ "$ST" = "400" ] || parse_body "$R" | jq -e '.error' >/dev/null 2>&1; then
        ok "eliminar con id no-uuid → rechazado ($ST)"
    else
        fail "eliminar con id no-uuid" "400/error" "$ST body=$(parse_body "$R" | head -c 80)"
    fi

    # /eliminar con entity desconocida
    R=$(req POST "$EP_ELIMINAR" '{"entity":"zzzz","id":"11111111-1111-1111-1111-111111111111"}')
    ST=$(parse_status "$R")
    if [ "$ST" = "400" ] || parse_body "$R" | jq -e '.error' >/dev/null 2>&1; then
        ok "eliminar con entity desconocida → rechazado ($ST)"
    else
        fail "eliminar con entity desconocida" "400/error" "$ST"
    fi

    # /eliminar sin id
    R=$(req POST "$EP_ELIMINAR" '{"entity":"ficha"}')
    ST=$(parse_status "$R")
    if [ "$ST" = "400" ] || parse_body "$R" | jq -e '.error' >/dev/null 2>&1; then
        ok "eliminar sin id → rechazado ($ST)"
    else
        fail "eliminar sin id" "400/error" "$ST"
    fi
fi

# ==================================================================
# 8) DELETE efectivo + verificación de filtrado
# ==================================================================
if group_enabled "crud" && [ -n "$FICHA_ID_CORP" ]; then
    section "8. DELETE efectivo — soft delete debe filtrar la ficha del listado"
    R=$(req POST "$EP_ELIMINAR" "{\"entity\":\"ficha\",\"id\":\"$FICHA_ID_CORP\"}")
    assert_eq "POST /eliminar → 200" "$(parse_status "$R")" "200"
    sleep 2
    AUN=$(curl -sS -H "$AUTH" "$EP_LISTA" | jq -r --arg id "$FICHA_ID_CORP" '(.clientes // . // []) | map(select(.id == $id)) | length')
    if [ "$AUN" = "0" ]; then
        ok "Ficha filtrada del listado tras delete"
        # Marcar como ya borrada para no intentar limpiar
        CREATED_IDS=("${CREATED_IDS[@]/$FICHA_ID_CORP}")
    else
        fail "Ficha filtrada tras delete" "0 apariciones en listado" "$AUN (soft-delete NO aplicado)"
    fi
fi

# ==================================================================
# CLEANUP
# ==================================================================
if [ -z "${SKIP_CLEANUP:-}" ] && [ "${#CREATED_IDS[@]}" -gt 0 ]; then
    section "CLEANUP — eliminando ${#CREATED_IDS[@]} fichas de prueba"
    for fid in "${CREATED_IDS[@]}"; do
        [ -z "$fid" ] && continue
        R=$(req POST "$EP_ELIMINAR" "{\"entity\":\"ficha\",\"id\":\"$fid\"}")
        printf '  · %s → %s\n' "$fid" "$(parse_status "$R")"
    done
elif [ -n "${SKIP_CLEANUP:-}" ]; then
    echo
    echo "${C_DIM}SKIP_CLEANUP=1 → quedan ${#CREATED_IDS[@]} fichas de prueba sin borrar${C_RST}"
fi

# ==================================================================
# RESUMEN
# ==================================================================
echo
printf '%s════════════════════════════════════════%s\n' "$C_BOLD" "$C_RST"
printf '%sRESULTADO%s: %s%d PASS%s · %s%d FAIL%s · %s%d SKIP%s\n' \
    "$C_BOLD" "$C_RST" "$C_OK" "$PASS" "$C_RST" "$C_ERR" "$FAIL" "$C_RST" "$C_WARN" "$SKIP" "$C_RST"
printf '%s════════════════════════════════════════%s\n' "$C_BOLD" "$C_RST"
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
