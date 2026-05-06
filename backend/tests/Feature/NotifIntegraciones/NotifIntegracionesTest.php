<?php

use App\Models\NotifIntegracionesConfig;
use App\Models\NotifIntegracionesGrupo;
use App\Models\NotifIntegracionesHistorial;
use App\Models\User;

beforeEach(function () {
    $this->admin = User::factory()->admin()->create();
});

it('GET /config crea la fila si no existe', function () {
    $res = $this->actingAs($this->admin, 'sanctum')
        ->getJson('/api/notif-integraciones/config');

    $res->assertOk()
        ->assertJsonStructure(['config' => ['id', 'umbral_dias'], 'grupos']);

    expect(NotifIntegracionesConfig::count())->toBe(1);
});

it('PUT /config actualiza la fila', function () {
    $this->actingAs($this->admin, 'sanctum')
        ->putJson('/api/notif-integraciones/config', ['umbral_dias' => 14])
        ->assertOk()
        ->assertJsonPath('umbral_dias', 14);
});

it('POST /grupos action=create añade grupo', function () {
    $res = $this->actingAs($this->admin, 'sanctum')
        ->postJson('/api/notif-integraciones/grupos', [
            'action' => 'create',
            'grupo' => ['nombre' => 'Equipo X', 'destinatarios' => 'a@b.com'],
        ]);

    $res->assertCreated()->assertJsonPath('nombre', 'Equipo X');
});

it('POST /grupos action=update modifica', function () {
    $g = NotifIntegracionesGrupo::create(['nombre' => 'Old', 'destinatarios' => '']);

    $this->actingAs($this->admin, 'sanctum')
        ->postJson('/api/notif-integraciones/grupos', [
            'action' => 'update',
            'grupo' => ['id' => $g->id, 'nombre' => 'New'],
        ])
        ->assertOk()
        ->assertJsonPath('nombre', 'New');
});

it('POST /grupos action=delete soft-deletea', function () {
    $g = NotifIntegracionesGrupo::create(['nombre' => 'Borrar', 'destinatarios' => '']);

    $this->actingAs($this->admin, 'sanctum')
        ->postJson('/api/notif-integraciones/grupos', [
            'action' => 'delete',
            'grupo' => ['id' => $g->id],
        ])
        ->assertOk();

    expect(NotifIntegracionesGrupo::find($g->id))->toBeNull();
});

it('GET /historial devuelve últimas 200', function () {
    NotifIntegracionesHistorial::create([
        'grupo_nombre' => 'X', 'destinatarios' => 'a@b.com',
        'umbral_dias' => 7, 'tareas' => [],
    ]);

    $res = $this->actingAs($this->admin, 'sanctum')
        ->getJson('/api/notif-integraciones/historial');

    $res->assertOk();
    expect($res->json())->toHaveCount(1);
});
