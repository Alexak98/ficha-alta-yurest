<?php

use App\Models\FichaAlta;
use App\Models\Solicitud;
use App\Models\User;

beforeEach(function () {
    $this->admin = User::factory()->create([
        'rol' => 'admin',
        'permisos' => ['read' => [], 'write' => [], 'delete' => []],
    ]);
    $this->lectorPuro = User::factory()->create([
        'rol' => 'user',
        'permisos' => [
            'read' => ['solicitudes'],
            'write' => [],
            'delete' => [],
        ],
    ]);
});

it('rechaza index sin autenticación', function () {
    $this->getJson('/api/solicitudes')->assertStatus(401);
});

it('lista solicitudes paginadas', function () {
    Solicitud::factory()->count(3)->create();

    $res = $this->actingAs($this->admin, 'sanctum')->getJson('/api/solicitudes');

    $res->assertOk()
        ->assertJsonStructure(['data' => [['id', 'estado', 'access_token']], 'links', 'meta']);
    expect($res->json('data'))->toHaveCount(3);
});

it('aplica filtro por estado', function () {
    Solicitud::factory()->create(['estado' => 'pendiente']);
    Solicitud::factory()->create(['estado' => 'completado']);

    $res = $this->actingAs($this->admin, 'sanctum')
        ->getJson('/api/solicitudes?estado=completado');

    expect($res->json('data'))->toHaveCount(1)
        ->and($res->json('data.0.estado'))->toBe('completado');
});

it('crea solicitud con access_token autogenerado', function () {
    $ficha = FichaAlta::factory()->create();

    $res = $this->actingAs($this->admin, 'sanctum')
        ->postJson('/api/solicitudes', [
            'ficha_id' => $ficha->id,
            'tipo' => 'documentos',
            'datos' => ['origen' => 'test'],
        ]);

    $res->assertCreated()
        ->assertJsonPath('data.tipo', 'documentos')
        ->assertJsonPath('data.estado', 'pendiente');

    expect(strlen($res->json('data.access_token')))->toBe(32);
});

it('rechaza store si el usuario no tiene permiso write', function () {
    $this->actingAs($this->lectorPuro, 'sanctum')
        ->postJson('/api/solicitudes', ['tipo' => 'x'])
        ->assertStatus(403);
});

it('responde solicitud pública mediante access_token', function () {
    $solicitud = Solicitud::factory()->create([
        'estado' => 'pendiente',
        'datos' => ['nombre' => null],
    ]);

    $res = $this->postJson('/api/solicitudes/responder', [
        'access_token' => $solicitud->access_token,
        'datos' => ['nombre' => 'Cliente Demo', 'iban' => 'ES00...'],
    ]);

    $res->assertOk()->assertJsonPath('ok', true);

    $solicitud->refresh();
    expect($solicitud->estado)->toBe('Rellenado')
        ->and($solicitud->datos['nombre'])->toBe('Cliente Demo')
        ->and($solicitud->datos['iban'])->toBe('ES00...');
});

it('rechaza responder con token inválido', function () {
    $this->postJson('/api/solicitudes/responder', [
        'access_token' => str_repeat('0', 32),
        'datos' => ['x' => 1],
    ])->assertStatus(404);
});

it('soft-deletea solicitud sin perder fila', function () {
    $solicitud = Solicitud::factory()->create();

    $this->actingAs($this->admin, 'sanctum')
        ->deleteJson("/api/solicitudes/{$solicitud->id}")
        ->assertOk();

    expect(Solicitud::withTrashed()->find($solicitud->id))->not->toBeNull()
        ->and(Solicitud::find($solicitud->id))->toBeNull();
});
