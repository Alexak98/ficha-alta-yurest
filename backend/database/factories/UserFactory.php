<?php

namespace Database\Factories;

use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Facades\Hash;

/**
 * @extends Factory<User>
 */
class UserFactory extends Factory
{
    protected $model = User::class;

    protected static ?string $password = null;

    public function definition(): array
    {
        return [
            'username' => fake()->unique()->userName(),
            'nombre' => fake()->name(),
            'email' => fake()->unique()->safeEmail(),
            'password' => static::$password ??= Hash::make('password'),
            'password_algo' => 'bcrypt',
            'rol' => 'user',
            'permisos' => ['read' => [], 'write' => [], 'delete' => []],
            'activo' => true,
        ];
    }

    public function admin(): static
    {
        return $this->state(fn () => [
            'rol' => 'admin',
            'permisos' => ['read' => [], 'write' => [], 'delete' => []],
        ]);
    }
}
