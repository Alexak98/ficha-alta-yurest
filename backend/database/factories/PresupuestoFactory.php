<?php

namespace Database\Factories;

use App\Models\Presupuesto;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Presupuesto>
 */
class PresupuestoFactory extends Factory
{
    protected $model = Presupuesto::class;

    public function definition(): array
    {
        return [
            'cliente' => fake()->company(),
            'entorno' => fake()->randomElement(['backoffice', 'app_cliente']),
            'desarrollo' => fake()->sentence(4),
            'enviado' => false,
            'quien_abona' => 'cliente',
            'estado' => 'en_espera',
            'estado_entrega' => 'pendiente',
            'horas_yurest' => fake()->numberBetween(0, 50),
            'horas_cliente' => fake()->numberBetween(0, 100),
        ];
    }
}
