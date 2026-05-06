<?php

use App\Models\FichaAlta;
use App\Models\Local;
use App\Models\User;

beforeEach(function () {
    $this->admin = User::factory()->admin()->create();
    $this->ficha = FichaAlta::factory()->create();
});

it('lista locales de una ficha', function () {
    Local::factory()->count(3)->create(['ficha_id' => $this->ficha->id]);
    Local::factory()->create(); // de otra ficha — no debe aparecer

    $res = $this->actingAs($this->admin, 'sanctum')
        ->getJson("/api/fichas/{$this->ficha->id}/locales");

    $res->assertOk();
    expect($res->json('data'))->toHaveCount(3);
});

it('crea un local nested', function () {
    $res = $this->actingAs($this->admin, 'sanctum')
        ->postJson("/api/fichas/{$this->ficha->id}/locales", [
            'nombre' => 'Sede Norte',
            'cp' => '28001',
            'mensualidad' => 150.50,
        ]);

    $res->assertCreated()
        ->assertJsonPath('data.nombre', 'Sede Norte')
        ->assertJsonPath('data.cp', '28001');

    expect($this->ficha->fresh()->locales()->count())->toBe(1);
});

it('rechaza local sin nombre', function () {
    $this->actingAs($this->admin, 'sanctum')
        ->postJson("/api/fichas/{$this->ficha->id}/locales", [])
        ->assertStatus(422)
        ->assertJsonValidationErrors('nombre');
});

it('actualiza un local', function () {
    $local = Local::factory()->create(['ficha_id' => $this->ficha->id, 'nombre' => 'Antiguo']);

    $this->actingAs($this->admin, 'sanctum')
        ->putJson("/api/fichas/{$this->ficha->id}/locales/{$local->id}", [
            'nombre' => 'Renombrado',
        ])
        ->assertOk()
        ->assertJsonPath('data.nombre', 'Renombrado');
});

it('rechaza update si el local pertenece a otra ficha', function () {
    $otraFicha = FichaAlta::factory()->create();
    $local = Local::factory()->create(['ficha_id' => $otraFicha->id]);

    $this->actingAs($this->admin, 'sanctum')
        ->putJson("/api/fichas/{$this->ficha->id}/locales/{$local->id}", [
            'nombre' => 'Hack',
        ])
        ->assertStatus(404);
});

it('soft-deletea un local', function () {
    $local = Local::factory()->create(['ficha_id' => $this->ficha->id]);

    $this->actingAs($this->admin, 'sanctum')
        ->deleteJson("/api/fichas/{$this->ficha->id}/locales/{$local->id}")
        ->assertOk();

    expect(Local::find($local->id))->toBeNull()
        ->and(Local::withTrashed()->find($local->id))->not->toBeNull();
});
