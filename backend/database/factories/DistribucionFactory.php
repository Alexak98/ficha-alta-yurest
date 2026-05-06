<?php

namespace Database\Factories;

use App\Models\Distribucion;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Distribucion>
 */
class DistribucionFactory extends Factory
{
    protected $model = Distribucion::class;

    public function definition(): array
    {
        return [
            'implementador' => fake()->name(),
            'datos' => [],
        ];
    }
}
