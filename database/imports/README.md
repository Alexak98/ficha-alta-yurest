# Importación masiva de datos en Supabase

Toolkit para meter clientes y locales existentes de un Excel/CSV
directamente en `fichas_alta` y `locales`, sin pasar por el flujo
solicitud→rellenado→completar del portal.

> **Cuándo usar esto:** carga inicial de cartera, migración desde
> sistema antiguo, importación de un cliente con muchas franquicias.
> **Cuándo NO:** altas individuales del día a día → usa el flujo
> normal del portal (Comercial → Fichas de cliente).

## Ficheros

| Fichero                            | Para qué                                                                                |
|------------------------------------|------------------------------------------------------------------------------------------|
| `import-clientes-template.sql`     | Plantilla con VALUES — pegas los datos como tuplas y lo lanzas en SQL Editor.            |
| `import-locales-template.sql`      | Igual pero para locales asociados a clientes ya importados (matching por CIF).           |
| `csv-to-sql.py`                    | Convierte tu .csv → SQL listo para pegar. Útil cuando son > 30 filas.                    |
| `clientes-template.csv`            | Cabeceras del CSV con el orden exacto de columnas que espera `csv-to-sql.py`.            |
| `locales-template.csv`             | Cabeceras CSV para locales.                                                              |

## Procedimiento recomendado

### 1. Prepara el CSV con las columnas exactas

Abre `clientes-template.csv` en Excel o Numbers, copia tus datos
respetando el orden de columnas y los formatos:

- **`cif`**: opcional, pero si lo das se usa para deduplicar (mismo
  CIF = no duplica).
- **`tipo_cliente`**: uno de `lite` · `planes` · `corporate` ·
  `corporate_cp` · `corp_cocina`. Vacío si no se sabe.
- **`cp`**: exactamente 5 dígitos o vacío. La BD lo rechaza con un
  CHECK si pones 4 o 6.
- **`firmas_contratadas`**: `''` · `100` · `200` · `300` (cualquier
  otro valor revienta el CHECK).
- Booleanos (`tpv_no_integrado`, `lite`, `distribuidor`): `true` /
  `false` o vacío.

Guárdalo como `clientes.csv` (UTF-8, separador coma).

### 2. Genera el SQL

```bash
cd database/imports
python3 csv-to-sql.py clientes.csv > import-clientes.sql
```

El script:
- Valida cada fila (CP 5 dígitos, tipo_cliente del enum, etc).
- Aborta si alguna fila no cumple — te dice cuál y por qué.
- Escapa apóstrofes y caracteres raros para SQL.
- Genera un único INSERT con dedup por CIF (`WHERE NOT EXISTS`).

### 3. Ejecuta en Supabase

1. Abre el panel Supabase → SQL Editor → New query.
2. Pega el contenido de `import-clientes.sql`.
3. Pulsa Run. Te devolverá las filas insertadas con `id` + `denominacion`
   + `cif`.
4. Si alguna línea cae por CHECK constraint, lee el `details` del
   error (Postgres dice qué columna y qué valor falló), corrige el
   CSV y repite — la dedup por CIF garantiza que no metes duplicados
   al re-ejecutar.

### 4. (Opcional) Importa los locales

Si tu fuente tiene los locales por separado, repite los pasos 1–3
con `locales-template.csv` y `import-locales-template.sql`. Cada local
se enlaza al cliente por su CIF (campo `cliente_cif` en el CSV) — el
SQL hace `JOIN fichas_alta ON cif = cliente_cif` para resolver el
`ficha_id`. Si un local tiene un CIF que no encuentra cliente, lo salta
y te lo lista al final.

## Si los datos son muy poco (< 30 filas)

Puedes pegar los `VALUES` a mano directamente en
`import-clientes-template.sql` y ejecutarlo, sin pasar por el script.
La plantilla incluye 2 filas de ejemplo comentadas para que veas el
formato.

## Si el import falla a medio camino

Cada SQL está envuelto en una transacción implícita (Supabase ejecuta
cada query como una transacción). Si una fila revienta un CHECK, **se
hace rollback de TODAS las filas del batch** — no quedan inserts
parciales. Corrige el CSV y vuelves a lanzar.

## Estado de las fichas importadas

Las fichas se crean con `estado = 'rellenado'` por defecto — el
significado en el portal es "ficha completada por comercial". Así
aparecen en lista.html como cualquier ficha activa, sin pedirte que
las completes. Si quieres empujarlas un paso más a `'completada'`
(rellenada por cliente), cambia el valor en el CSV.

## Notas de seguridad / RLS

`fichas_alta` y `locales` tienen RLS activado con política
`service_role_all`. El SQL Editor de Supabase corre como `postgres`
(superusuario), saltándose RLS — los inserts pasan sin problema. Si
quieres lanzar la query desde fuera (psql remoto o un cliente con
JWT), necesitas la `service_role` key en el header.
