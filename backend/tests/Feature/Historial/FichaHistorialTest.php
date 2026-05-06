<?php

use App\Models\FichaAlta;
use App\Models\FichaHistorial;
use App\Models\User;

beforeEach(function () {
    $this->admin = User::factory()->admin()->create();
});

it('rechaza GET sin fichaId ni solicitudId', function () {
    $this->actingAs($this->admin, 'sanctum')
        ->getJson('/api/historial')
        ->assertStatus(422);
});

it('lista historial filtrado por fichaId', function () {
    $f = FichaAlta::factory()->create();
    FichaHistorial::create(['ficha_id' => $f->id, 'accion' => 'create']);
    FichaHistorial::create(['ficha_id' => $f->id, 'accion' => 'update']);
    FichaHistorial::create(['ficha_id' => FichaAlta::factory()->create()->id, 'accion' => 'create']);

    $res = $this->actingAs($this->admin, 'sanctum')
        ->getJson("/api/historial?fichaId={$f->id}");

    $res->assertOk();
    expect($res->json('data'))->toHaveCount(2);
});

it('inserta entrada con cambios', function () {
    $f = FichaAlta::factory()->create();

    $res = $this->actingAs($this->admin, 'sanctum')
        ->postJson('/api/historial', [
            'ficha_id' => $f->id,
            'accion' => 'estado_change',
            'usuario' => ['nombre' => 'Alex', 'rol' => 'admin'],
            'descripcion' => 'Pasó a completada',
            'cambios' => ['estado' => ['before' => 'pendiente', 'after' => 'completada']],
        ]);

    $res->assertCreated()->assertJsonPath('success', true);
    expect(FichaHistorial::where('ficha_id', $f->id)->count())->toBe(1);
});

it('rechaza accion no listada', function () {
    $f = FichaAlta::factory()->create();

    $this->actingAs($this->admin, 'sanctum')
        ->postJson('/api/historial', [
            'ficha_id' => $f->id,
            'accion' => 'inventada',
        ])
        ->assertStatus(422);
});

it('rechaza POST sin ficha_id ni solicitud_id', function () {
    $this->actingAs($this->admin, 'sanctum')
        ->postJson('/api/historial', ['accion' => 'create'])
        ->assertStatus(422);
});
