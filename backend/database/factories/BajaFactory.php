<?php

namespace Database\Factories;

use App\Models\Baja;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Baja>
 */
class BajaFactory extends Factory
{
    protected $model = Baja::class;

    public function definition(): array
    {
        return [
            'cliente' => fake()->company(),
            'motivo' => fake()->randomElement(['precio', 'soporte', 'cierre', 'cambio_software']),
            'fecha_baja' => fake()->date(),
            'implementador' => fake()->name(),
            'tipo_cliente' => fake()->randomElement(['lite', 'planes', 'corporate']),
            'datos' => [],
        ];
    }
}
