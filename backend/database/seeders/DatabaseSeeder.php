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
     * Único usuario inicial del entorno: alex / alex08, rol admin.
     * Idempotente — si ya existe, lo deja intacto.
     */
    private function seedLocalAdmin(): void
    {
        if (User::query()->where('username', 'alex')->exists()) {
            return;
        }

        User::create([
            'username' => 'alex',
            'nombre' => 'Alex',
            'email' => 'alex@yurest.local',
            'password' => Hash::make('alex08'),
            'password_algo' => 'bcrypt',
            'rol' => 'admin',
            'permisos' => ['read' => [], 'write' => [], 'delete' => []],
            'activo' => true,
        ]);
    }
}
