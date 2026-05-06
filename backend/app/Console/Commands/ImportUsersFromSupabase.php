<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use PDOException;

/**
 * Importa usuarios desde la BD `usuarios` heredada de Supabase a la nueva
 * tabla `users` local. Mantiene UUIDs originales, hashes PBKDF2 (con
 * password_algo='pbkdf2' para que el rehash gradual al primer login los
 * pase a bcrypt), permisos granulares y sessions_revoked_at.
 *
 * Uso:
 *   php artisan yurest:import-users --dsn=postgres://user:pass@host/db
 *   php artisan yurest:import-users                       # lee SUPABASE_DSN del .env
 *   php artisan yurest:import-users --dry-run             # no escribe nada
 *   php artisan yurest:import-users --force               # sobrescribe duplicados
 *
 * Para importar desde un dump SQL en vez de DSN:
 *   1. Crea una BD temporal en tu Postgres local: `createdb yurest_supabase_dump`
 *   2. Carga el dump:                            `psql yurest_supabase_dump < dump.sql`
 *   3. Pasa esa BD como DSN al comando.
 *   4. Borra la BD temporal cuando termines.
 */
class ImportUsersFromSupabase extends Command
{
    protected $signature = 'yurest:import-users
        {--dsn= : Postgres DSN de origen (si se omite, lee SUPABASE_DSN del .env)}
        {--dry-run : Lista lo que importaría sin escribir nada}
        {--force : Sobrescribe usuarios locales con el mismo username}';

    protected $description = 'Importa usuarios desde Supabase (tabla `usuarios`) a la tabla local `users`.';

    public function handle(): int
    {
        $dsn = $this->option('dsn') ?: config('yurest.supabase_dsn');
        if (! $dsn) {
            $this->error('Falta DSN: pasa --dsn=... o define SUPABASE_DSN en .env');

            return self::FAILURE;
        }

        $dryRun = (bool) $this->option('dry-run');
        $force = (bool) $this->option('force');

        $this->info('Conectando al origen...');
        $rows = $this->fetchSourceRows($dsn);
        if ($rows === null) {
            return self::FAILURE;
        }
        $this->info(sprintf('  %d usuarios encontrados.', count($rows)));

        $stats = ['imported' => 0, 'skipped' => 0, 'overwritten' => 0, 'errors' => 0];

        foreach ($rows as $row) {
            $username = strtolower(trim((string) $row['username']));
            $existing = User::query()->where('username', $username)->first();

            if ($existing && ! $force) {
                $this->line("  [skip]  $username (ya existe — usa --force para sobrescribir)");
                $stats['skipped']++;

                continue;
            }

            $payload = $this->mapRow($row, $username);

            if ($dryRun) {
                $this->line("  [dry]   $username  algo={$payload['password_algo']} rol={$payload['rol']}");
                $stats['imported']++;

                continue;
            }

            try {
                if ($existing) {
                    $existing->forceFill($payload)->saveQuietly();
                    $stats['overwritten']++;
                    $this->line("  [over]  $username");
                } else {
                    User::query()->insert($payload + ['id' => $row['id']]);
                    $stats['imported']++;
                    $this->line("  [new]   $username");
                }
            } catch (\Throwable $e) {
                $stats['errors']++;
                $this->error("  [err]   $username: ".$e->getMessage());
            }
        }

        $this->newLine();
        $this->info(sprintf(
            'Resumen: %d nuevos, %d sobrescritos, %d omitidos, %d errores',
            $stats['imported'],
            $stats['overwritten'],
            $stats['skipped'],
            $stats['errors'],
        ));

        return $stats['errors'] > 0 ? self::FAILURE : self::SUCCESS;
    }

    /**
     * Conecta al Postgres origen y devuelve filas de `usuarios`.
     *
     * @return array<int, array<string, mixed>>|null
     */
    private function fetchSourceRows(string $dsn): ?array
    {
        // Configura una conexión temporal "supabase_source" con el DSN dado.
        $parsed = parse_url($dsn);
        if ($parsed === false || empty($parsed['host'])) {
            $this->error('DSN inválido — formato esperado: postgres://user:pass@host:port/database');

            return null;
        }

        Config::set('database.connections.supabase_source', [
            'driver' => 'pgsql',
            'host' => $parsed['host'],
            'port' => $parsed['port'] ?? 5432,
            'database' => ltrim($parsed['path'] ?? '', '/'),
            'username' => $parsed['user'] ?? '',
            'password' => $parsed['pass'] ?? '',
            'charset' => 'utf8',
            'prefix' => '',
            'schema' => 'public',
            'sslmode' => 'prefer',
        ]);

        try {
            $rows = DB::connection('supabase_source')
                ->table('usuarios')
                ->select([
                    'id', 'username', 'password_hash', 'nombre', 'email',
                    'rol', 'permisos', 'activo', 'last_login_at',
                    'created_at', 'updated_at', 'deleted_at',
                ])
                ->whereNull('deleted_at')
                ->get();
        } catch (PDOException $e) {
            $this->error('No se pudo conectar/leer al origen: '.$e->getMessage());

            return null;
        }

        return array_map(fn ($r) => (array) $r, $rows->all());
    }

    /**
     * Normaliza una fila del origen al shape de la tabla `users` local.
     *
     * @param  array<string, mixed>  $row
     * @return array<string, mixed>
     */
    private function mapRow(array $row, string $username): array
    {
        $permisos = $this->normalizePermisos($row['permisos'] ?? null);
        $algo = str_starts_with((string) $row['password_hash'], 'pbkdf2$') ? 'pbkdf2' : 'bcrypt';

        return [
            'username' => $username,
            'nombre' => $row['nombre'] ?? null,
            'email' => $row['email'] ?? null,
            'password' => $row['password_hash'],
            'password_algo' => $algo,
            'rol' => in_array($row['rol'] ?? 'user', ['admin', 'user', 'implementador'], true)
                ? $row['rol']
                : 'user',
            'permisos' => json_encode($permisos),
            'activo' => (bool) ($row['activo'] ?? true),
            'sessions_revoked_at' => null,
            'created_at' => $row['created_at'] ?? now(),
            'updated_at' => $row['updated_at'] ?? now(),
        ];
    }

    /**
     * Normaliza el JSONB `permisos` al shape granular {read, write, delete}.
     *
     * Acepta:
     *   - Array plano legacy (`["clientes","lista"]`) → expande a r/w/d.
     *   - Objeto granular ya correcto.
     *   - null o cualquier otra cosa → `{read:[], write:[], delete:[]}`.
     *
     * @return array{read: array<int, string>, write: array<int, string>, delete: array<int, string>}
     */
    private function normalizePermisos(mixed $raw): array
    {
        if (is_string($raw)) {
            $raw = json_decode($raw, true);
        }
        $empty = ['read' => [], 'write' => [], 'delete' => []];

        if (is_array($raw) && array_is_list($raw)) {
            $list = array_values(array_filter($raw, 'is_string'));

            return ['read' => $list, 'write' => $list, 'delete' => $list];
        }

        if (is_array($raw)) {
            return [
                'read' => $this->stringList($raw['read'] ?? []),
                'write' => $this->stringList($raw['write'] ?? []),
                'delete' => $this->stringList($raw['delete'] ?? []),
            ];
        }

        return $empty;
    }

    /**
     * @return array<int, string>
     */
    private function stringList(mixed $v): array
    {
        if (! is_array($v)) {
            return [];
        }

        return array_values(array_filter($v, 'is_string'));
    }
}
