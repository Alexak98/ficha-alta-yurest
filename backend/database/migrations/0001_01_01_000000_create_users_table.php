<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Tabla `users` (renombrada desde `usuarios` del schema Supabase original).
 *
 * Conserva todos los campos del schema histórico (rol, permisos granulares,
 * sessions_revoked_at) y añade los estándar de Laravel (email_verified_at,
 * remember_token).
 *
 * El campo password admite tanto bcrypt nativo como el formato heredado
 * `pbkdf2$<iter>$<salt_b64>$<hash_b64>`. La columna `password_algo` permite
 * el rehash gradual al primer login (ver AuthController).
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::statement('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

        Schema::create('users', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('username')->unique();
            $table->string('nombre')->nullable();
            $table->string('email')->nullable();
            $table->timestamp('email_verified_at')->nullable();
            $table->string('password');
            $table->string('password_algo', 16)->default('bcrypt');
            $table->string('rol', 32)->default('user');
            $table->jsonb('permisos')->default(DB::raw("'{\"read\":[],\"write\":[],\"delete\":[]}'::jsonb"));
            $table->boolean('activo')->default(true);
            $table->timestampTz('sessions_revoked_at')->nullable();
            $table->softDeletesTz();
            $table->rememberToken();
            $table->timestampsTz();
        });

        DB::statement(
            'ALTER TABLE users ADD CONSTRAINT users_password_min_length '.
            'CHECK (length(password) >= 40)'
        );
        DB::statement(
            'ALTER TABLE users ADD CONSTRAINT users_rol_check '.
            "CHECK (rol IN ('admin', 'user', 'implementador'))"
        );
        DB::statement(
            'ALTER TABLE users ADD CONSTRAINT users_password_algo_check '.
            "CHECK (password_algo IN ('bcrypt', 'pbkdf2'))"
        );

        Schema::create('password_reset_tokens', function (Blueprint $table) {
            $table->string('email')->primary();
            $table->string('token');
            $table->timestampTz('created_at')->nullable();
        });

        Schema::create('sessions', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->foreignUuid('user_id')->nullable()->index();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->longText('payload');
            $table->integer('last_activity')->index();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sessions');
        Schema::dropIfExists('password_reset_tokens');
        Schema::dropIfExists('users');
    }
};
