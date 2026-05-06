<?php

use App\Models\Promocion;
use App\Models\User;

beforeEach(function () {
    $this->admin = User::factory()->admin()->create();
});

it('lista promociones', function () {
    Promocion::factory()->count(3)->create();

    $this->actingAs($this->admin, 'sanctum')
        ->getJson('/api/promociones')
        ->assertOk()
        ->assertJsonCount(3, 'data');
});

it('crea promoción con plazas por defecto 8+8', function () {
    $res = $this->actingAs($this->admin, 'sanctum')
        ->postJson('/api/promociones', [
            'nombre' => 'Promo Mayo 2026',
            'fecha_inicio' => '2026-05-01',
        ]);

    $res->assertCreated()
        ->assertJsonPath('data.plazas_manana', 8)
        ->assertJsonPath('data.plazas_tarde', 8)
        ->assertJsonPath('data.estado', 'activa');
});

it('rechaza estado fuera del CHECK', function () {
    $this->actingAs($this->admin, 'sanctum')
        ->postJson('/api/promociones', ['nombre' => 'X', 'estado' => 'inventado'])
        ->assertStatus(422);
});

it('actualiza promoción', function () {
    $p = Promocion::factory()->create(['nombre' => 'Original']);

    $this->actingAs($this->admin, 'sanctum')
        ->putJson("/api/promociones/{$p->id}", ['estado' => 'cerrada'])
        ->assertOk()
        ->assertJsonPath('data.estado', 'cerrada')
        ->assertJsonPath('data.nombre', 'Original');
});

it('soft-deletea promoción', function () {
    $p = Promocion::factory()->create();

    $this->actingAs($this->admin, 'sanctum')
        ->deleteJson("/api/promociones/{$p->id}")
        ->assertOk();

    expect(Promocion::find($p->id))->toBeNull();
});
