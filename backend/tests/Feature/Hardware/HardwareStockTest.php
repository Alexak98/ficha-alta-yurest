<?php

use App\Models\HardwareStock;
use App\Models\User;

beforeEach(function () {
    $this->admin = User::factory()->admin()->create();
});

it('lista catálogo ordenado por categoría+nombre', function () {
    HardwareStock::factory()->count(3)->create();

    $res = $this->actingAs($this->admin, 'sanctum')->getJson('/api/hardware/stock');

    $res->assertOk();
    expect($res->json('data'))->toHaveCount(3);
});

it('filtra por bajo_minimo', function () {
    HardwareStock::factory()->create(['stock_actual' => 0, 'stock_minimo' => 10]); // bajo
    HardwareStock::factory()->create(['stock_actual' => 50, 'stock_minimo' => 5]); // OK

    $res = $this->actingAs($this->admin, 'sanctum')
        ->getJson('/api/hardware/stock?bajo_minimo=1');

    expect($res->json('data'))->toHaveCount(1)
        ->and($res->json('data.0.bajo_minimo'))->toBeTrue();
});

it('crea artículo con stock inicial', function () {
    $res = $this->actingAs($this->admin, 'sanctum')
        ->postJson('/api/hardware/stock', [
            'nombre' => 'Tablet Samsung Tab A9+',
            'sku' => 'tablet_a9',
            'categoria' => 'tablet',
            'stock_actual' => 5,
            'stock_minimo' => 2,
            'precio_venta' => 250,
        ]);

    $res->assertCreated()
        ->assertJsonPath('data.sku', 'tablet_a9')
        ->assertJsonPath('data.stock_actual', 5);
});

it('rechaza categoría fuera del CHECK', function () {
    $this->actingAs($this->admin, 'sanctum')
        ->postJson('/api/hardware/stock', [
            'nombre' => 'X',
            'categoria' => 'inventada',
        ])
        ->assertStatus(422);
});

it('rechaza stock_actual negativo', function () {
    $this->actingAs($this->admin, 'sanctum')
        ->postJson('/api/hardware/stock', [
            'nombre' => 'X',
            'stock_actual' => -3,
        ])
        ->assertStatus(422);
});

it('actualiza stock_actual', function () {
    $a = HardwareStock::factory()->create(['stock_actual' => 5]);

    $this->actingAs($this->admin, 'sanctum')
        ->putJson("/api/hardware/stock/{$a->id}", ['stock_actual' => 12])
        ->assertOk()
        ->assertJsonPath('data.stock_actual', 12);
});

it('soft-deletea artículo', function () {
    $a = HardwareStock::factory()->create();

    $this->actingAs($this->admin, 'sanctum')
        ->deleteJson("/api/hardware/stock/{$a->id}")
        ->assertOk();

    expect(HardwareStock::find($a->id))->toBeNull();
});
