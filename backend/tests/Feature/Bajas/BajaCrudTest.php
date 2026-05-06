<?php

use App\Models\Baja;
use App\Models\FichaAlta;
use App\Models\User;

beforeEach(function () {
    $this->admin = User::factory()->admin()->create();
    $this->lector = User::factory()->create([
        'permisos' => ['read' => ['bajas'], 'write' => [], 'delete' => []],
    ]);
});

it('rechaza index sin auth', function () {
    $this->getJson('/api/bajas')->assertStatus(401);
});

it('lista bajas ordenadas por fecha desc', function () {
    Baja::factory()->create(['fecha_baja' => '2026-01-01']);
    Baja::factory()->create(['fecha_baja' => '2026-03-15']);
    Baja::factory()->create(['fecha_baja' => '2026-02-10']);

    $res = $this->actingAs($this->admin, 'sanctum')->getJson('/api/bajas');

    $res->assertOk();
    expect($res->json('data'))->toHaveCount(3)
        ->and($res->json('data.0.fecha_baja'))->toBe('2026-03-15');
});

it('aplana campos de datos JSONB al nivel raíz en la respuesta', function () {
    Baja::factory()->create([
        'cliente' => 'X',
        'datos' => [
            'cliente_nombre' => 'X',
            'cliente_cif' => 'B12345678',
            'mrr' => 250.50,
            'modulos' => ['planes', 'rrhh'],
        ],
    ]);

    $res = $this->actingAs($this->admin, 'sanctum')->getJson('/api/bajas');

    expect($res->json('data.0.cliente_cif'))->toBe('B12345678')
        ->and($res->json('data.0.mrr'))->toBe(250.50)
        ->and($res->json('data.0.modulos'))->toBe(['planes', 'rrhh']);
});

it('crea baja con campos del frontend (cliente_nombre)', function () {
    $res = $this->actingAs($this->admin, 'sanctum')
        ->postJson('/api/bajas', [
            'cliente_nombre' => 'Restaurantes Norte SL',
            'motivo' => 'precio',
            'cliente_cif' => 'B98765432',
            'modulos' => ['planes'],
            'mrr' => 199.99,
            'tipo' => 'corporate',
        ]);

    $res->assertCreated()
        ->assertJsonPath('data.cliente', 'Restaurantes Norte SL')
        ->assertJsonPath('data.motivo', 'precio')
        ->assertJsonPath('data.tipo_cliente', 'corporate')
        ->assertJsonPath('data.cliente_cif', 'B98765432')
        ->assertJsonPath('data.mrr', 199.99);
});

it('vincula ficha_id si cliente_id es UUID válido', function () {
    $ficha = FichaAlta::factory()->create();

    $res = $this->actingAs($this->admin, 'sanctum')
        ->postJson('/api/bajas', [
            'cliente_nombre' => 'X',
            'cliente_id' => $ficha->id,
        ]);

    $res->assertCreated()->assertJsonPath('data.ficha_id', $ficha->id);
});

it('NO vincula ficha_id si cliente_id no es UUID', function () {
    $res = $this->actingAs($this->admin, 'sanctum')
        ->postJson('/api/bajas', [
            'cliente_nombre' => 'X',
            'cliente_id' => 'not-a-uuid-just-numeric-id',
        ]);

    $res->assertCreated()->assertJsonPath('data.ficha_id', null);
});

it('rechaza store sin permiso write', function () {
    $this->actingAs($this->lector, 'sanctum')
        ->postJson('/api/bajas', ['cliente_nombre' => 'X'])
        ->assertStatus(403);
});

it('actualiza una baja', function () {
    $baja = Baja::factory()->create(['cliente' => 'Original']);

    $this->actingAs($this->admin, 'sanctum')
        ->putJson("/api/bajas/{$baja->id}", [
            'cliente_nombre' => 'Renombrado',
            'motivo' => 'cierre',
        ])
        ->assertOk()
        ->assertJsonPath('data.cliente', 'Renombrado')
        ->assertJsonPath('data.motivo', 'cierre');
});

it('soft-deletea una baja', function () {
    $baja = Baja::factory()->create();

    $this->actingAs($this->admin, 'sanctum')
        ->deleteJson("/api/bajas/{$baja->id}")
        ->assertOk();

    expect(Baja::find($baja->id))->toBeNull();
});
