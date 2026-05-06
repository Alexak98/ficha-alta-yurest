<?php

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;

uses(RefreshDatabase::class);

/**
 * Tests del comando yurest:import-users.
 *
 * Para no depender de Supabase real, montamos una segunda BD Postgres
 * "supabase_fake" sobre la misma instancia local del CI/Sail. Le creamos
 * una tabla `usuarios` con el mismo shape que la heredada, le metemos
 * fixtures, y apuntamos el comando a esa BD vía --dsn.
 *
 * En CI: la BD `yurest_supabase_test` la creamos al vuelo aquí; el service
 * de Postgres acepta CREATE DATABASE.
 */
beforeEach(function () {
    $sourceDb = 'yurest_supabase_test';
    $defaultConfig = config('database.connections.pgsql');

    // Crea la BD origen si no existe (idempotente entre tests).
    Config::set('database.connections.supabase_admin', array_merge($defaultConfig, [
        'database' => 'postgres',
    ]));
    DB::purge('supabase_admin');
    try {
        DB::connection('supabase_admin')->statement("CREATE DATABASE \"$sourceDb\"");
    } catch (Throwable) {
        // ya existe
    }

    Config::set('database.connections.supabase_fake', array_merge($defaultConfig, [
        'database' => $sourceDb,
    ]));
    DB::purge('supabase_fake');

    // Schema mínimo replicando la tabla heredada
    DB::connection('supabase_fake')->statement('DROP TABLE IF EXISTS usuarios');
    DB::connection('supabase_fake')->statement('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');
    DB::connection('supabase_fake')->statement(<<<'SQL'
        CREATE TABLE usuarios (
            id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
            username      TEXT         NOT NULL UNIQUE,
            password_hash TEXT         NOT NULL,
            nombre        TEXT,
            email         TEXT,
            rol           TEXT         NOT NULL DEFAULT 'user',
            permisos      JSONB        NOT NULL DEFAULT '[]'::jsonb,
            activo        BOOLEAN      NOT NULL DEFAULT TRUE,
            last_login_at TIMESTAMPTZ,
            created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
            updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
            deleted_at    TIMESTAMPTZ
        )
    SQL);

    // DSN que apunta a la BD fake
    $cfg = config('database.connections.pgsql');
    $this->fakeDsn = sprintf(
        'postgres://%s:%s@%s:%d/%s',
        $cfg['username'],
        $cfg['password'],
        $cfg['host'],
        $cfg['port'],
        $sourceDb,
    );
});

afterEach(function () {
    DB::connection('supabase_fake')->statement('DROP TABLE IF EXISTS usuarios');
    DB::purge('supabase_fake');
});

function seedSourceUser(array $overrides = []): void
{
    DB::connection('supabase_fake')->table('usuarios')->insert(array_merge([
        'username' => 'ana',
        'password_hash' => 'pbkdf2$100000$c2FsdHNhbHRzYWx0c2FsdA==$dummy',
        'nombre' => 'Ana Pérez',
        'email' => 'ana@yurest.com',
        'rol' => 'user',
        'permisos' => json_encode(['read' => ['lista'], 'write' => [], 'delete' => []]),
        'activo' => true,
    ], $overrides));
}

it('falla si no se pasa DSN ni hay SUPABASE_DSN', function () {
    config(['yurest.supabase_dsn' => null]);
    $this->artisan('yurest:import-users')
        ->expectsOutputToContain('Falta DSN')
        ->assertFailed();
});

it('importa usuarios nuevos con password_algo correcto', function () {
    seedSourceUser();
    seedSourceUser(['username' => 'BOB', 'password_hash' => bcrypt('x')]);

    $this->artisan('yurest:import-users', ['--dsn' => $this->fakeDsn])
        ->assertSuccessful();

    $ana = User::where('username', 'ana')->first();
    expect($ana)->not->toBeNull()
        ->and($ana->password_algo)->toBe('pbkdf2')
        ->and($ana->permisos['read'])->toBe(['lista']);

    $bob = User::where('username', 'bob')->first();
    expect($bob->password_algo)->toBe('bcrypt');
});

it('expande permisos legacy (array plano) a granular', function () {
    seedSourceUser([
        'username' => 'legacy',
        'permisos' => json_encode(['lista', 'bajas']),
    ]);

    $this->artisan('yurest:import-users', ['--dsn' => $this->fakeDsn])
        ->assertSuccessful();

    $u = User::where('username', 'legacy')->first();
    expect($u->permisos)->toBe([
        'read' => ['lista', 'bajas'],
        'write' => ['lista', 'bajas'],
        'delete' => ['lista', 'bajas'],
    ]);
});

it('omite usuarios soft-deleted del origen', function () {
    seedSourceUser(['username' => 'activo']);
    seedSourceUser(['username' => 'borrado', 'deleted_at' => now()]);

    $this->artisan('yurest:import-users', ['--dsn' => $this->fakeDsn])
        ->assertSuccessful();

    expect(User::where('username', 'activo')->exists())->toBeTrue()
        ->and(User::where('username', 'borrado')->exists())->toBeFalse();
});

it('no sobrescribe usuario existente sin --force', function () {
    User::factory()->create([
        'username' => 'ana',
        'nombre' => 'Original local',
    ]);
    seedSourceUser(['nombre' => 'Versión Supabase']);

    $this->artisan('yurest:import-users', ['--dsn' => $this->fakeDsn])
        ->assertSuccessful();

    expect(User::where('username', 'ana')->first()->nombre)
        ->toBe('Original local');
});

it('sobrescribe con --force', function () {
    User::factory()->create([
        'username' => 'ana',
        'nombre' => 'Original local',
    ]);
    seedSourceUser(['nombre' => 'Versión Supabase']);

    $this->artisan('yurest:import-users', ['--dsn' => $this->fakeDsn, '--force' => true])
        ->assertSuccessful();

    expect(User::where('username', 'ana')->first()->nombre)
        ->toBe('Versión Supabase');
});

it('--dry-run no escribe nada', function () {
    seedSourceUser();

    $this->artisan('yurest:import-users', ['--dsn' => $this->fakeDsn, '--dry-run' => true])
        ->assertSuccessful();

    expect(User::count())->toBe(0);
});

// === Modo --json (export desde Supabase Studio) ===

it('importa desde un archivo JSON con shape estándar', function () {
    $tmp = tempnam(sys_get_temp_dir(), 'usuarios-').'.json';
    file_put_contents($tmp, json_encode([
        [
            'id' => '11111111-1111-1111-1111-111111111111',
            'username' => 'carla',
            'password_hash' => 'pbkdf2$100000$abc==$xyz=',
            'nombre' => 'Carla Test',
            'email' => 'carla@yurest.com',
            'rol' => 'user',
            'permisos' => ['read' => ['lista'], 'write' => [], 'delete' => []],
            'activo' => true,
            'created_at' => '2026-01-01T00:00:00+00:00',
            'updated_at' => '2026-01-01T00:00:00+00:00',
        ],
    ]));

    $this->artisan('yurest:import-users', ['--json' => $tmp])
        ->assertSuccessful();

    $u = User::where('username', 'carla')->first();
    expect($u)->not->toBeNull()
        ->and($u->password_algo)->toBe('pbkdf2')
        ->and($u->permisos['read'])->toBe(['lista']);

    @unlink($tmp);
});

it('soporta JSON envuelto por json_agg (array dentro de array)', function () {
    $tmp = tempnam(sys_get_temp_dir(), 'usuarios-').'.json';
    file_put_contents($tmp, json_encode([[
        ['id' => '22222222-2222-2222-2222-222222222222', 'username' => 'dani', 'password_hash' => 'x', 'rol' => 'user'],
    ]]));

    $this->artisan('yurest:import-users', ['--json' => $tmp])
        ->assertSuccessful();

    expect(User::where('username', 'dani')->exists())->toBeTrue();

    @unlink($tmp);
});

it('omite filas soft-deleted del JSON', function () {
    $tmp = tempnam(sys_get_temp_dir(), 'usuarios-').'.json';
    file_put_contents($tmp, json_encode([
        ['id' => '33333333-3333-3333-3333-333333333333', 'username' => 'vivo',    'password_hash' => 'x', 'rol' => 'user'],
        ['id' => '44444444-4444-4444-4444-444444444444', 'username' => 'borrado', 'password_hash' => 'x', 'rol' => 'user', 'deleted_at' => '2026-01-01T00:00:00Z'],
    ]));

    $this->artisan('yurest:import-users', ['--json' => $tmp])
        ->assertSuccessful();

    expect(User::where('username', 'vivo')->exists())->toBeTrue()
        ->and(User::where('username', 'borrado')->exists())->toBeFalse();

    @unlink($tmp);
});

it('falla con error claro si el JSON no existe', function () {
    $this->artisan('yurest:import-users', ['--json' => '/no/existe.json'])
        ->expectsOutputToContain('Archivo no encontrado')
        ->assertFailed();
});

it('falla con error claro si el JSON está mal formateado', function () {
    $tmp = tempnam(sys_get_temp_dir(), 'usuarios-').'.json';
    file_put_contents($tmp, '{ esto no es json valido');

    $this->artisan('yurest:import-users', ['--json' => $tmp])
        ->expectsOutputToContain('JSON inválido')
        ->assertFailed();

    @unlink($tmp);
});
