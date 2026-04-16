# Migraciones de base de datos

`schema.sql` es el esquema **inicial**, pensado para levantar una base limpia.

En esta carpeta van los `.sql` de cambios incrementales, numerados por fecha:

```
2026-04-16_01_add_deleted_at.sql
2026-04-16_02_add_check_tipo_cliente.sql
...
```

## Convenciones

- Cada archivo debe ser **idempotente** cuando sea razonable (usar `IF NOT EXISTS`,
  `ADD COLUMN IF NOT EXISTS`, `DROP CONSTRAINT IF EXISTS`).
- No borrar migraciones ya aplicadas en producción — crear siempre una nueva.
- Commits que modifican el schema deben añadir la migración correspondiente.

## Aplicación

Ejecutar manualmente en orden, o vía herramienta (`supabase db push`, `dbmate`, etc).
