<?php

namespace Database\Factories;

use App\Models\FichaAlta;
use App\Models\Local;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Local>
 */
class LocalFactory extends Factory
{
    protected $model = Local::class;

    public function definition(): array
    {
        return [
            'ficha_id' => FichaAlta::factory(),
            'nombre' => fake()->company().' Local',
            'email' => fake()->safeEmail(),
            'cp' => fake()->numerify('#####'),
            'mensualidad' => fake()->randomFloat(2, 50, 500),
        ];
    }
}
