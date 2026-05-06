<?php

use App\Models\FichaAlta;
use App\Models\User;

beforeEach(function () {
    $this->admin = User::factory()->admin()->create();
});

it('marca la ficha como notificada y propone enviar drive', function () {
    $f = FichaAlta::factory()->create(['tpv_no_integrado' => false]);

    $res = $this->actingAs($this->admin, 'sanctum')
        ->postJson("/api/fichas/{$f->id}/notificar-completa", ['ficha_id' => $f->id]);

    $res->assertOk()
        ->assertJsonPath('success', true)
        ->assertJsonPath('ya_notificada', false)
        ->assertJsonPath('enviar_drive', true)
        ->assertJsonPath('enviar_integraciones', false);

    expect($f->fresh()->getAttribute('notificada_completa_at'))->not->toBeNull();
});

it('si TPV no integrado, propone enviar integraciones también', function () {
    $f = FichaAlta::factory()->create(['tpv_no_integrado' => true]);

    $this->actingAs($this->admin, 'sanctum')
        ->postJson("/api/fichas/{$f->id}/notificar-completa", ['ficha_id' => $f->id])
        ->assertOk()
        ->assertJsonPath('enviar_integraciones', true);
});

it('idempotente: una segunda llamada no re-envía', function () {
    $f = FichaAlta::factory()->create();

    $this->actingAs($this->admin, 'sanctum')
        ->postJson("/api/fichas/{$f->id}/notificar-completa", ['ficha_id' => $f->id])
        ->assertOk();

    $res = $this->actingAs($this->admin, 'sanctum')
        ->postJson("/api/fichas/{$f->id}/notificar-completa", ['ficha_id' => $f->id]);

    $res->assertOk()
        ->assertJsonPath('ya_notificada', true)
        ->assertJsonPath('enviar_drive', false);
});
