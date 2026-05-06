<?php

use App\Models\CsEstadoHistorial;
use App\Models\FichaAlta;
use App\Models\User;

beforeEach(function () {
    $this->admin = User::factory()->admin()->create();
});

it('mueve a un cliente entre columnas y registra historial', function () {
    $f = FichaAlta::factory()->create();

    $this->actingAs($this->admin, 'sanctum')
        ->postJson('/api/cs/estado', [
            'ficha_id' => $f->id,
            'estado_hasta' => 'en_implementacion',
            'movido_por' => 'alex',
        ])
        ->assertOk()
        ->assertJsonPath('estado_desde', null)
        ->assertJsonPath('estado_hasta', 'en_implementacion');

    $h = CsEstadoHistorial::where('ficha_id', $f->id)->first();
    expect($h)->not->toBeNull()
        ->and($h->estado_hasta)->toBe('en_implementacion');
});

it('una segunda transición captura estado_desde', function () {
    $f = FichaAlta::factory()->create();

    $this->actingAs($this->admin, 'sanctum')
        ->postJson('/api/cs/estado', ['ficha_id' => $f->id, 'estado_hasta' => 'en_implementacion'])
        ->assertOk();

    $res = $this->actingAs($this->admin, 'sanctum')
        ->postJson('/api/cs/estado', ['ficha_id' => $f->id, 'estado_hasta' => 'stand_by']);

    $res->assertOk()->assertJsonPath('estado_desde', 'en_implementacion');

    expect(CsEstadoHistorial::where('ficha_id', $f->id)->count())->toBe(2);
});

it('rechaza estado fuera del CHECK', function () {
    $f = FichaAlta::factory()->create();

    $this->actingAs($this->admin, 'sanctum')
        ->postJson('/api/cs/estado', [
            'ficha_id' => $f->id,
            'estado_hasta' => 'inventado',
        ])
        ->assertStatus(422);
});
