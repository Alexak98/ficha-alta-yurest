<?php

namespace Database\Factories;

use App\Models\Proyecto;
use App\Models\ProyectoHistorial;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<ProyectoHistorial>
 */
class ProyectoHistorialFactory extends Factory
{
    protected $model = ProyectoHistorial::class;

    public function definition(): array
    {
        return [
            'proyecto_id' => Proyecto::factory(),
            'usuario_nombre' => fake()->name(),
            'usuario_rol' => 'user',
            'accion' => fake()->randomElement([
                'tarea_completada', 'tarea_actualizada', 'anotacion_added',
            ]),
            'descripcion' => fake()->sentence(),
            'cambios' => [],
            'metadata' => [],
            'creado_at' => now(),
        ];
    }
}
