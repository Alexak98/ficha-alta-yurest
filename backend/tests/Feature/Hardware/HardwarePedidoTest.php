<?php

use App\Models\HardwarePedido;
use App\Models\Proyecto;
use App\Models\User;

beforeEach(function () {
    $this->admin = User::factory()->admin()->create();
});

it('lista pedidos paginados con filtros', function () {
    HardwarePedido::factory()->count(3)->create(['estado' => 'solicitada']);
    HardwarePedido::factory()->create(['estado' => 'enviado']);

    $res = $this->actingAs($this->admin, 'sanctum')
        ->getJson('/api/hardware/pedidos?estado=solicitada');

    $res->assertOk();
    expect($res->json('data'))->toHaveCount(3);
});

it('crea pedido con items mínimos', function () {
    $proyecto = Proyecto::factory()->create();

    $res = $this->actingAs($this->admin, 'sanctum')
        ->postJson('/api/hardware/pedidos', [
            'proyecto_id' => $proyecto->id,
            'cliente' => 'Restaurantes Norte SL',
            'implementador' => 'Ana',
            'items' => [
                ['nombre' => 'Tablet Samsung Tab A9+', 'cantidad' => 2],
                ['nombre' => 'Soporte tablet', 'cantidad' => 2, 'unidad' => 'ud'],
            ],
        ]);

    $res->assertCreated()
        ->assertJsonPath('data.estado', 'solicitada');
    expect($res->json('data.items'))->toHaveCount(2);
});

it('rechaza item sin cantidad', function () {
    $this->actingAs($this->admin, 'sanctum')
        ->postJson('/api/hardware/pedidos', [
            'cliente' => 'X',
            'items' => [['nombre' => 'X']],
        ])
        ->assertStatus(422);
});

it('rechaza estado fuera del CHECK', function () {
    $this->actingAs($this->admin, 'sanctum')
        ->postJson('/api/hardware/pedidos', [
            'cliente' => 'X',
            'items' => [['nombre' => 'X', 'cantidad' => 1]],
            'estado' => 'inventado',
        ])
        ->assertStatus(422);
});

it('cambia de estado y sella el timestamp correspondiente', function () {
    $pedido = HardwarePedido::factory()->create(['estado' => 'pendiente_confirmar']);

    $this->actingAs($this->admin, 'sanctum')
        ->putJson("/api/hardware/pedidos/{$pedido->id}", [
            'estado' => 'lista_envio',
        ])
        ->assertOk()
        ->assertJsonPath('data.estado', 'lista_envio');

    expect($pedido->fresh()->confirmado_at)->not->toBeNull();
});

it('marcar como enviado setea enviado_at', function () {
    $pedido = HardwarePedido::factory()->create(['estado' => 'lista_envio']);

    $this->actingAs($this->admin, 'sanctum')
        ->putJson("/api/hardware/pedidos/{$pedido->id}", [
            'estado' => 'enviado',
            'enviado_por' => 'soporte_alex',
        ])
        ->assertOk();

    $p = $pedido->fresh();
    expect($p->estado)->toBe('enviado')
        ->and($p->enviado_at)->not->toBeNull()
        ->and($p->enviado_por)->toBe('soporte_alex');
});

it('soft-deletea pedido', function () {
    $p = HardwarePedido::factory()->create();

    $this->actingAs($this->admin, 'sanctum')
        ->deleteJson("/api/hardware/pedidos/{$p->id}")
        ->assertOk();

    expect(HardwarePedido::find($p->id))->toBeNull();
});
