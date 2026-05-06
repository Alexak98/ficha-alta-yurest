<?php

namespace Database\Factories;

use App\Models\FichaAlta;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<FichaAlta>
 */
class FichaAltaFactory extends Factory
{
    protected $model = FichaAlta::class;

    public function definition(): array
    {
        return [
            'denominacion' => fake()->company(),
            'cif' => 'B'.fake()->numerify('########'),
            'email' => fake()->companyEmail(),
            'tipo_cliente' => fake()->randomElement(['lite', 'planes', 'corporate']),
            'cp' => fake()->numerify('#####'),
            'estado' => 'pendiente',
            'baja' => 'No',
            'modulos' => [],
            'paquetes_carrito' => [],
        ];
    }
}
