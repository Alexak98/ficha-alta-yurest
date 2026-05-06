<?php

namespace Database\Factories;

use App\Models\Promocion;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Promocion>
 */
class PromocionFactory extends Factory
{
    protected $model = Promocion::class;

    public function definition(): array
    {
        return [
            'nombre' => 'Promo '.fake()->month().' '.fake()->year(),
            'fecha_inicio' => fake()->date(),
            'estado' => 'activa',
            'plazas_manana' => 8,
            'plazas_tarde' => 8,
        ];
    }
}
