#!/usr/bin/env python3
"""
csv-to-sql.py — Convierte un CSV de clientes/locales en SQL listo
                 para pegar en el SQL Editor de Supabase.

Uso:
    python3 csv-to-sql.py clientes.csv > import-clientes.sql
    python3 csv-to-sql.py --tipo=locales locales.csv > import-locales.sql

El script:
- Lee el CSV con `csv.DictReader` (cabecera obligatoria).
- Valida cada fila: enums, CP 5 dígitos, columnas obligatorias.
- Aborta con código 1 si alguna fila no cumple — te dice cuál.
- Escapa apóstrofes y comillas para SQL.
- Genera un único INSERT con dedup por CIF (clientes) o JOIN
  por CIF (locales).
- Sale por stdout. Redirige a un fichero con `>`.

Cabeceras esperadas — ver clientes-template.csv y locales-template.csv.
"""
import csv
import sys
import argparse
import re

# ──────────────────────────────────────────────────────────
#  Validaciones
# ──────────────────────────────────────────────────────────

TIPOS_CLIENTE = {'lite', 'planes', 'corporate', 'corporate_cp', 'corp_cocina'}
FIRMAS_VALIDAS = {'', '100', '200', '300'}
CP_RE = re.compile(r'^\d{5}$')

# Columnas esperadas en cada modo. El orden NO importa en el CSV
# (DictReader resuelve por nombre), pero todas estas keys deben existir
# en la cabecera.
COLUMNAS_CLIENTES = [
    'denominacion', 'nombre_comercial', 'cif', 'email', 'tipo_cliente',
    'cp', 'calle', 'numero', 'municipio', 'provincia',
    'comercial',
    'jp_nombre', 'jp_apellidos', 'jp_mail', 'jp_telefono',
    'tpv', 'comentarios'
]

COLUMNAS_LOCALES = [
    'cliente_cif', 'nombre', 'email',
    'cp', 'calle', 'numero', 'municipio',
    'sociedad_cif', 'sociedad_denominacion',
    'mensualidad', 'es_cocina_central'
]


def escape_sql(v):
    """Escapa un valor para SQL. Convierte vacíos y None a NULL."""
    if v is None:
        return 'NULL'
    s = str(v).strip()
    if s == '' or s.lower() == 'null':
        return 'NULL'
    # Escapa comilla simple duplicándola (estándar SQL).
    s = s.replace("'", "''")
    return f"'{s}'"


def escape_bool(v):
    """Convierte 'true'/'false'/'1'/'0'/vacío a TRUE/FALSE/NULL."""
    if v is None or str(v).strip() == '':
        return 'NULL'
    s = str(v).strip().lower()
    if s in ('true', 't', '1', 'sí', 'si', 'yes', 'y'):
        return 'TRUE'
    if s in ('false', 'f', '0', 'no', 'n'):
        return 'FALSE'
    raise ValueError(f"valor booleano inválido: {v!r}")


def escape_decimal(v):
    """Convierte un valor numérico a literal SQL."""
    if v is None or str(v).strip() == '':
        return 'NULL'
    s = str(v).strip().replace(',', '.')
    try:
        return str(float(s))
    except ValueError:
        raise ValueError(f"valor numérico inválido: {v!r}")


def validar_cliente(row, n):
    """Valida una fila de clientes. Lanza ValueError con mensaje claro."""
    if not (row.get('denominacion') or '').strip():
        raise ValueError(f"fila {n}: 'denominacion' es obligatoria")
    tipo = (row.get('tipo_cliente') or '').strip()
    if tipo and tipo not in TIPOS_CLIENTE:
        raise ValueError(
            f"fila {n}: tipo_cliente='{tipo}' inválido. "
            f"Valores: {sorted(TIPOS_CLIENTE)} o vacío")
    cp = (row.get('cp') or '').strip()
    if cp and not CP_RE.match(cp):
        raise ValueError(f"fila {n}: cp='{cp}' debe ser 5 dígitos exactos o vacío")


def validar_local(row, n):
    """Valida una fila de locales."""
    if not (row.get('cliente_cif') or '').strip():
        raise ValueError(f"fila {n}: 'cliente_cif' es obligatoria")
    if not (row.get('nombre') or '').strip():
        raise ValueError(f"fila {n}: 'nombre' es obligatoria")
    cp = (row.get('cp') or '').strip()
    if cp and not CP_RE.match(cp):
        raise ValueError(f"fila {n}: cp='{cp}' debe ser 5 dígitos o vacío")
    # mensualidad y es_cocina_central se validan al convertir.


# ──────────────────────────────────────────────────────────
#  Generadores
# ──────────────────────────────────────────────────────────

def generar_clientes(filas):
    """Genera el SQL para fichas_alta (con dedup por CIF)."""
    tuplas = []
    for n, row in enumerate(filas, start=2):  # start=2 → la 1 es la cabecera
        validar_cliente(row, n)
        valores = [
            escape_sql(row.get('denominacion')),
            escape_sql(row.get('nombre_comercial')),
            escape_sql(row.get('cif')),
            escape_sql(row.get('email')),
            escape_sql(row.get('tipo_cliente')),
            escape_sql(row.get('cp')),
            escape_sql(row.get('calle')),
            escape_sql(row.get('numero')),
            escape_sql(row.get('municipio')),
            escape_sql(row.get('provincia')),
            escape_sql(row.get('comercial')),
            escape_sql(row.get('jp_nombre')),
            escape_sql(row.get('jp_apellidos')),
            escape_sql(row.get('jp_mail')),
            escape_sql(row.get('jp_telefono')),
            escape_sql(row.get('tpv')),
            escape_sql(row.get('comentarios')),
        ]
        tuplas.append('        (' + ', '.join(valores) + ')')

    if not tuplas:
        raise ValueError('CSV vacío (0 filas de datos)')

    body = ',\n'.join(tuplas)
    sql = (
        "-- Generado automáticamente desde CSV — " + str(len(tuplas)) + " cliente(s)\n"
        "-- Pegar y ejecutar en Supabase SQL Editor.\n"
        "\n"
        "WITH datos AS (\n"
        "    SELECT * FROM (VALUES\n"
        + body + "\n"
        "    ) AS t(\n"
        "        denominacion, nombre_comercial, cif, email, tipo_cliente,\n"
        "        cp, calle, numero, municipio, provincia,\n"
        "        comercial, jp_nombre, jp_apellidos, jp_mail, jp_telefono,\n"
        "        tpv, comentarios\n"
        "    )\n"
        ")\n"
        "INSERT INTO fichas_alta (\n"
        "    denominacion, nombre_comercial, cif, email, tipo_cliente,\n"
        "    cp, calle, numero, municipio, provincia,\n"
        "    comercial, jp_nombre, jp_apellidos, jp_mail, jp_telefono,\n"
        "    tpv, comentarios,\n"
        "    estado, baja, modulos\n"
        ")\n"
        "SELECT\n"
        "    d.denominacion, d.nombre_comercial, d.cif, d.email, d.tipo_cliente,\n"
        "    NULLIF(d.cp, ''), d.calle, d.numero, d.municipio, d.provincia,\n"
        "    d.comercial, d.jp_nombre, d.jp_apellidos, d.jp_mail, d.jp_telefono,\n"
        "    d.tpv, d.comentarios,\n"
        "    'rellenado', 'No', '{}'::text[]\n"
        "FROM datos d\n"
        "WHERE d.denominacion IS NOT NULL\n"
        "  AND NOT EXISTS (\n"
        "      SELECT 1 FROM fichas_alta f\n"
        "       WHERE d.cif IS NOT NULL\n"
        "         AND f.cif IS NOT NULL\n"
        "         AND UPPER(TRIM(f.cif)) = UPPER(TRIM(d.cif))\n"
        "         AND f.deleted_at IS NULL\n"
        "  )\n"
        "RETURNING id, denominacion, cif, tipo_cliente;\n"
    )
    return sql


def generar_locales(filas):
    """Genera el SQL para `locales` con JOIN por CIF a fichas_alta."""
    tuplas = []
    for n, row in enumerate(filas, start=2):
        validar_local(row, n)
        valores = [
            escape_sql(row.get('cliente_cif')),
            escape_sql(row.get('nombre')),
            escape_sql(row.get('email')),
            escape_sql(row.get('cp')),
            escape_sql(row.get('calle')),
            escape_sql(row.get('numero')),
            escape_sql(row.get('municipio')),
            escape_sql(row.get('sociedad_cif')),
            escape_sql(row.get('sociedad_denominacion')),
            escape_decimal(row.get('mensualidad')),
            escape_bool(row.get('es_cocina_central')),
        ]
        tuplas.append('        (' + ', '.join(valores) + ')')

    if not tuplas:
        raise ValueError('CSV vacío (0 filas de datos)')

    body = ',\n'.join(tuplas)
    sql = (
        "-- Generado automáticamente desde CSV — " + str(len(tuplas)) + " local(es)\n"
        "-- Pegar y ejecutar en Supabase SQL Editor. Los locales se enlazan al\n"
        "-- cliente padre matchando por CIF (case-insensitive).\n"
        "\n"
        "WITH datos AS (\n"
        "    SELECT * FROM (VALUES\n"
        + body + "\n"
        "    ) AS t(\n"
        "        cliente_cif, nombre, email,\n"
        "        cp, calle, numero, municipio,\n"
        "        sociedad_cif, sociedad_denominacion,\n"
        "        mensualidad, es_cocina_central\n"
        "    )\n"
        ")\n"
        "INSERT INTO locales (\n"
        "    ficha_id, nombre, email,\n"
        "    cp, calle, numero, municipio,\n"
        "    sociedad_cif, sociedad_denominacion,\n"
        "    mensualidad, es_cocina_central\n"
        ")\n"
        "SELECT\n"
        "    f.id,\n"
        "    d.nombre, d.email,\n"
        "    NULLIF(d.cp, ''), d.calle, d.numero, d.municipio,\n"
        "    d.sociedad_cif, d.sociedad_denominacion,\n"
        "    COALESCE(d.mensualidad, 0),\n"
        "    COALESCE(d.es_cocina_central, FALSE)\n"
        "FROM datos d\n"
        "JOIN fichas_alta f\n"
        "  ON f.cif IS NOT NULL\n"
        " AND UPPER(TRIM(f.cif)) = UPPER(TRIM(d.cliente_cif))\n"
        " AND f.deleted_at IS NULL\n"
        "WHERE d.cliente_cif IS NOT NULL\n"
        "  AND d.nombre IS NOT NULL\n"
        "RETURNING id, ficha_id, nombre;\n"
    )
    return sql


# ──────────────────────────────────────────────────────────
#  Main
# ──────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('csv_path', help='Ruta al fichero CSV')
    parser.add_argument('--tipo', choices=['clientes', 'locales'],
                        default='clientes',
                        help='Tipo de import (default: clientes)')
    args = parser.parse_args()

    columnas_esperadas = COLUMNAS_CLIENTES if args.tipo == 'clientes' else COLUMNAS_LOCALES

    try:
        with open(args.csv_path, encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            cabecera = set(reader.fieldnames or [])
            faltantes = [c for c in columnas_esperadas if c not in cabecera]
            if faltantes:
                print(f"ERROR: faltan columnas en el CSV: {faltantes}",
                      file=sys.stderr)
                print(f"  Cabecera esperada: {columnas_esperadas}", file=sys.stderr)
                sys.exit(1)

            filas = list(reader)

        if args.tipo == 'clientes':
            sql = generar_clientes(filas)
        else:
            sql = generar_locales(filas)

        sys.stdout.write(sql)

    except FileNotFoundError:
        print(f"ERROR: no existe el fichero {args.csv_path}", file=sys.stderr)
        sys.exit(1)
    except ValueError as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
