<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Hash;

/**
 * Cambia la contraseña del admin desde la línea de comandos. Útil tras
 * el primer deploy en prod para sustituir el `alex08` del seeder por
 * algo seguro, o para recuperar acceso si se olvida.
 *
 * Uso:
 *   php artisan yurest:reset-admin-password alex
 *   → te pide la nueva contraseña por stdin (no se loguea).
 *
 *   php artisan yurest:reset-admin-password alex --password=secret123
 *   → modo no-interactivo (útil para scripts; cuidado con history shell).
 */
class ResetAdminPassword extends Command
{
    protected $signature = 'yurest:reset-admin-password
        {username : Usuario al que cambiar la contraseña}
        {--password= : Nueva contraseña (si se omite, se pide por stdin)}';

    protected $description = 'Resetea la contraseña de un usuario del portal.';

    public function handle(): int
    {
        $username = strtolower(trim($this->argument('username')));

        $user = User::query()->where('username', $username)->first();
        if (! $user) {
            $this->error("Usuario '$username' no encontrado.");

            return self::FAILURE;
        }

        $password = (string) $this->option('password');
        if ($password === '') {
            $password = (string) $this->secret('Nueva contraseña');
            $confirm = (string) $this->secret('Confirma la contraseña');
            if ($password !== $confirm) {
                $this->error('Las contraseñas no coinciden.');

                return self::FAILURE;
            }
        }

        if (strlen($password) < 8) {
            $this->error('La contraseña debe tener al menos 8 caracteres.');

            return self::FAILURE;
        }

        $user->forceFill([
            'password' => Hash::make($password),
            'password_algo' => 'bcrypt',
        ])->saveQuietly();

        $this->info("Contraseña actualizada para '$username'.");

        return self::SUCCESS;
    }
}
