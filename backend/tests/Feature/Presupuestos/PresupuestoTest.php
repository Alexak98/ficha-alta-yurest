<?php

use App\Models\Presupuesto;
use App\Models\User;

beforeEach(function () {
    $this->admin = User::factory()->admin()->create();
});

it('lista presupuestos paginados', function () {
    Presupuesto::factory()->count(3)->create();

    $this->actingAs($this->admin, 'sanctum')
        ->getJson('/api/presupuestos')
        ->assertOk()
        ->assertJsonCount(3, 'data');
});

it('crea presupuesto y auto-genera numero_doc', function () {
    $res = $this->actingAs($this->admin, 'sanctum')
        ->postJson('/api/presupuestos', [
            'cliente' => 'Restaurantes X',
            'entorno' => 'backoffice',
            'desarrollo' => 'Nuevo módulo de ventas',
        ]);

    $res->assertCreated()
        ->assertJsonPath('data.estado', 'en_espera')
        ->assertJsonPath('data.estado_entrega', 'pendiente');

    expect($res->json('data.numero_doc'))->toMatch('/^PRES-\d{4}$/');
});

it('rechaza entorno fuera del CHECK', function () {
    $this->actingAs($this->admin, 'sanctum')
        ->postJson('/api/presupuestos', [
            'cliente' => 'X',
            'entorno' => 'inventado',
            'desarrollo' => 'X',
        ])
        ->assertStatus(422);
});

it('rechaza descuento fuera de 0..100', function () {
    $this->actingAs($this->admin, 'sanctum')
        ->postJson('/api/presupuestos', [
            'cliente' => 'X',
            'entorno' => 'backoffice',
            'desarrollo' => 'X',
            'descuento_pct' => 150,
        ])
        ->assertStatus(422);
});

it('actualiza estado a pagado', function () {
    $p = Presupuesto::factory()->create();

    $this->actingAs($this->admin, 'sanctum')
        ->putJson("/api/presupuestos/{$p->id}", ['estado' => 'pagado'])
        ->assertOk()
        ->assertJsonPath('data.estado', 'pagado');
});

it('soft-deletea presupuesto', function () {
    $p = Presupuesto::factory()->create();

    $this->actingAs($this->admin, 'sanctum')
        ->deleteJson("/api/presupuestos/{$p->id}")
        ->assertOk();

    expect(Presupuesto::find($p->id))->toBeNull();
});

it('aplica filtros por cliente y estado', function () {
    Presupuesto::factory()->create(['cliente' => 'A', 'estado' => 'aceptado']);
    Presupuesto::factory()->create(['cliente' => 'A', 'estado' => 'en_espera']);
    Presupuesto::factory()->create(['cliente' => 'B', 'estado' => 'aceptado']);

    $res = $this->actingAs($this->admin, 'sanctum')
        ->getJson('/api/presupuestos?cliente=A&estado=aceptado');

    expect($res->json('data'))->toHaveCount(1);
});
