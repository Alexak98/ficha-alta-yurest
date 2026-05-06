<?php

namespace Database\Factories;

use App\Models\HardwareStock;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<HardwareStock>
 */
class HardwareStockFactory extends Factory
{
    protected $model = HardwareStock::class;

    public function definition(): array
    {
        return [
            'nombre' => fake()->words(3, true),
            'sku' => 'sku_'.fake()->unique()->bothify('??##'),
            'categoria' => fake()->randomElement([
                'tablet', 'soporte', 'impresora', 'lector', 'otro',
            ]),
            'unidad' => 'ud',
            'stock_actual' => fake()->numberBetween(0, 50),
            'stock_minimo' => fake()->numberBetween(0, 10),
            'precio_compra' => fake()->randomFloat(2, 1, 500),
            'precio_venta' => fake()->randomFloat(2, 5, 800),
        ];
    }
}
