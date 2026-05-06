<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    public function run(): void
    {
        $this->seedLocalAdmin();
    }

    /**
     * Crea un admin local para desarrollo. La contraseña sale de
     * env('SEED_ADMIN_PASSWORD'), default 'password' (nunca usar en prod).
     *
     * Si ya existe (seed re-ejecutado), lo deja intacto.
     */
    private function seedLocalAdmin(): void
    {
        if (User::query()->where('username', 'admin')->exists()) {
            return;
        }

        User::create([
            'username' => 'admin',
            'nombre' => 'Admin Local',
            'email' => 'admin@yurest.local',
            'password' => Hash::make(config('yurest.seed_admin_password')),
            'password_algo' => 'bcrypt',
            'rol' => 'admin',
            'permisos' => ['read' => [], 'write' => [], 'delete' => []],
            'activo' => true,
        ]);
    }
}
