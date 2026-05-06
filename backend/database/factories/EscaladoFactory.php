<?php

namespace Database\Factories;

use App\Models\Escalado;
use App\Models\FichaAlta;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Escalado>
 */
class EscaladoFactory extends Factory
{
    protected $model = Escalado::class;

    public function definition(): array
    {
        return [
            'ficha_id' => FichaAlta::factory(),
            'tipo' => fake()->randomElement(['modulo', 'local']),
            'estado' => 'pendiente',
            'detalle' => ['modulos' => ['pro'], 'locales_ids' => []],
            'setup' => fake()->randomFloat(2, 0, 1000),
            'recurrencia' => fake()->randomFloat(2, 0, 500),
        ];
    }
}
