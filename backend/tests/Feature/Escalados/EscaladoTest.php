<?php

use App\Models\Escalado;
use App\Models\FichaAlta;
use App\Models\User;

beforeEach(function () {
    $this->admin = User::factory()->admin()->create();
});

it('lista escalados con filtros', function () {
    $f1 = FichaAlta::factory()->create();
    $f2 = FichaAlta::factory()->create();
    Escalado::factory()->create(['ficha_id' => $f1->id, 'estado' => 'pendiente']);
    Escalado::factory()->create(['ficha_id' => $f1->id, 'estado' => 'aplicado']);
    Escalado::factory()->create(['ficha_id' => $f2->id, 'estado' => 'pendiente']);

    $res = $this->actingAs($this->admin, 'sanctum')
        ->getJson("/api/escalados?ficha_id={$f1->id}&estado=pendiente");

    expect($res->json('data'))->toHaveCount(1);
});

it('crea escalado tipo modulo', function () {
    $f = FichaAlta::factory()->create();

    $res = $this->actingAs($this->admin, 'sanctum')
        ->postJson('/api/escalados', [
            'ficha_id' => $f->id,
            'tipo' => 'modulo',
            'detalle' => ['modulos' => ['pro', 'rrhh'], 'locales_ids' => [], 'setup' => 500, 'recurrencia' => 120],
            'setup' => 500,
            'recurrencia' => 120,
        ]);

    $res->assertCreated()
        ->assertJsonPath('data.tipo', 'modulo')
        ->assertJsonPath('data.estado', 'pendiente');
});

it('rechaza tipo fuera del CHECK', function () {
    $f = FichaAlta::factory()->create();

    $this->actingAs($this->admin, 'sanctum')
        ->postJson('/api/escalados', [
            'ficha_id' => $f->id,
            'tipo' => 'inventado',
            'detalle' => [],
        ])
        ->assertStatus(422);
});

it('al pasar a aplicado se sella aplicado_at', function () {
    $e = Escalado::factory()->create(['estado' => 'pendiente']);

    $this->actingAs($this->admin, 'sanctum')
        ->putJson("/api/escalados/{$e->id}", ['estado' => 'aplicado'])
        ->assertOk();

    expect($e->fresh()->aplicado_at)->not->toBeNull();
});

it('soft-deletea escalado', function () {
    $e = Escalado::factory()->create();

    $this->actingAs($this->admin, 'sanctum')
        ->deleteJson("/api/escalados/{$e->id}")
        ->assertOk();

    expect(Escalado::find($e->id))->toBeNull();
});
