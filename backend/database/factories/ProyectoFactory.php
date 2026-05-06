<?php

namespace Database\Factories;

use App\Models\Proyecto;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Proyecto>
 */
class ProyectoFactory extends Factory
{
    protected $model = Proyecto::class;

    public function definition(): array
    {
        return [
            'cliente' => fake()->company(),
            'implementador' => fake()->name(),
            'tipo' => fake()->randomElement(['Planes', 'Corporate sin cocina', 'Corporate con cocina']),
            'estado' => 'activo',
            'fecha_inicio' => fake()->date(),
            'ultima_actividad' => fake()->date(),
            'anotaciones' => [],
            'contactos' => [],
            'adjuntos' => [],
            'secciones' => [],
        ];
    }
}
