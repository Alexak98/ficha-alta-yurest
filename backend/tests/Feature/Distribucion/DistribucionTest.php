<?php

use App\Models\Distribucion;
use App\Models\FichaAlta;
use App\Models\User;

beforeEach(function () {
    $this->admin = User::factory()->admin()->create();
});

it('asigna implementador a una ficha y registra en distribucion', function () {
    $ficha = FichaAlta::factory()->create(['implementador' => null]);

    $res = $this->actingAs($this->admin, 'sanctum')
        ->postJson('/api/distribucion', [
            'id' => $ficha->id,
            'implementador' => 'Ana Pérez',
        ]);

    $res->assertCreated()
        ->assertJsonPath('data.implementador', 'Ana Pérez')
        ->assertJsonPath('data.ficha_id', $ficha->id);

    expect($ficha->fresh()->implementador)->toBe('Ana Pérez');
    expect(Distribucion::where('ficha_id', $ficha->id)->count())->toBe(1);
});

it('acepta también `ficha_id` (alias de `id`)', function () {
    $ficha = FichaAlta::factory()->create();

    $this->actingAs($this->admin, 'sanctum')
        ->postJson('/api/distribucion', [
            'ficha_id' => $ficha->id,
            'implementador' => 'Bea',
        ])
        ->assertCreated();
});

it('cada reasignación crea una nueva fila en distribucion (audit trail)', function () {
    $ficha = FichaAlta::factory()->create();

    $this->actingAs($this->admin, 'sanctum')
        ->postJson('/api/distribucion', ['id' => $ficha->id, 'implementador' => 'Ana'])
        ->assertCreated();

    $this->actingAs($this->admin, 'sanctum')
        ->postJson('/api/distribucion', ['id' => $ficha->id, 'implementador' => 'Bea'])
        ->assertCreated();

    expect(Distribucion::where('ficha_id', $ficha->id)->count())->toBe(2)
        ->and($ficha->fresh()->implementador)->toBe('Bea');
});

it('rechaza sin id ni ficha_id', function () {
    $this->actingAs($this->admin, 'sanctum')
        ->postJson('/api/distribucion', ['implementador' => 'Ana'])
        ->assertStatus(422);
});

it('rechaza sin implementador', function () {
    $ficha = FichaAlta::factory()->create();

    $this->actingAs($this->admin, 'sanctum')
        ->postJson('/api/distribucion', ['id' => $ficha->id])
        ->assertStatus(422);
});

it('requiere permiso distribucion,write', function () {
    $sinPermiso = User::factory()->create([
        'permisos' => ['read' => ['distribucion'], 'write' => [], 'delete' => []],
    ]);

    $this->actingAs($sinPermiso, 'sanctum')
        ->postJson('/api/distribucion', [
            'id' => '00000000-0000-0000-0000-000000000000',
            'implementador' => 'X',
        ])
        ->assertStatus(403);
});
