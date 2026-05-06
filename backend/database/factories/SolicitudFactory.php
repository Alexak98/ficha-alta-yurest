<?php

namespace Database\Factories;

use App\Models\FichaAlta;
use App\Models\Solicitud;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Solicitud>
 */
class SolicitudFactory extends Factory
{
    protected $model = Solicitud::class;

    public function definition(): array
    {
        return [
            'ficha_id' => FichaAlta::factory(),
            'tipo' => fake()->randomElement(['documentos', 'sepa', 'datos-fiscales']),
            'estado' => 'pendiente',
            'asignado_a' => fake()->name(),
            'documentos' => [],
            'datos' => [],
        ];
    }
}
