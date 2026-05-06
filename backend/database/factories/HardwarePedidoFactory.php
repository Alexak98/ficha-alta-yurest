<?php

namespace Database\Factories;

use App\Models\HardwarePedido;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<HardwarePedido>
 */
class HardwarePedidoFactory extends Factory
{
    protected $model = HardwarePedido::class;

    public function definition(): array
    {
        return [
            'cliente' => fake()->company(),
            'implementador' => fake()->name(),
            'items' => [
                ['nombre' => 'Tablet Samsung Tab A9+', 'cantidad' => 2, 'unidad' => 'ud'],
            ],
            'estado' => 'solicitada',
            'solicitado_por' => fake()->userName(),
            'solicitado_at' => now(),
        ];
    }
}
