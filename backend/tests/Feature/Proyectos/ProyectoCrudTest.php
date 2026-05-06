<?php

use App\Models\FichaAlta;
use App\Models\Proyecto;
use App\Models\User;

beforeEach(function () {
    $this->admin = User::factory()->admin()->create();
    $this->lector = User::factory()->create([
        'permisos' => ['read' => ['proyectos'], 'write' => [], 'delete' => []],
    ]);
});

it('rechaza index sin auth', function () {
    $this->getJson('/api/proyectos')->assertStatus(401);
});

it('lista proyectos paginados ordenados por última actividad', function () {
    Proyecto::factory()->count(3)->create();

    $res = $this->actingAs($this->admin, 'sanctum')->getJson('/api/proyectos');

    $res->assertOk();
    expect($res->json('data'))->toHaveCount(3);
});

it('aplica filtros estado y tipo', function () {
    Proyecto::factory()->create(['estado' => 'activo', 'tipo' => 'Planes']);
    Proyecto::factory()->create(['estado' => 'pausado', 'tipo' => 'Planes']);
    Proyecto::factory()->create(['estado' => 'activo', 'tipo' => 'Corporate sin cocina']);

    $res = $this->actingAs($this->admin, 'sanctum')
        ->getJson('/api/proyectos?estado=activo&tipo=Planes');

    expect($res->json('data'))->toHaveCount(1);
});

it('crea proyecto con campos mínimos', function () {
    $ficha = FichaAlta::factory()->create();

    $res = $this->actingAs($this->admin, 'sanctum')
        ->postJson('/api/proyectos', [
            'ficha_id' => $ficha->id,
            'cliente' => 'Restaurantes Norte SL',
            'implementador' => 'Ana',
            'tipo' => 'Planes',
        ]);

    $res->assertCreated()
        ->assertJsonPath('data.cliente', 'Restaurantes Norte SL')
        ->assertJsonPath('data.estado', 'activo');
});

it('rechaza tipo fuera del CHECK', function () {
    $this->actingAs($this->admin, 'sanctum')
        ->postJson('/api/proyectos', [
            'cliente' => 'X',
            'implementador' => 'Y',
            'tipo' => 'Inválido',
        ])
        ->assertStatus(422);
});

it('rechaza store sin permiso write', function () {
    $this->actingAs($this->lector, 'sanctum')
        ->postJson('/api/proyectos', ['cliente' => 'X', 'implementador' => 'Y', 'tipo' => 'Planes'])
        ->assertStatus(403);
});

it('update parcial preserva otros campos', function () {
    $p = Proyecto::factory()->create([
        'cliente' => 'Original',
        'implementador' => 'Ana',
        'tipo' => 'Planes',
        'estado' => 'activo',
    ]);

    $this->actingAs($this->admin, 'sanctum')
        ->putJson("/api/proyectos/{$p->id}", ['estado' => 'pausado'])
        ->assertOk()
        ->assertJsonPath('data.estado', 'pausado')
        ->assertJsonPath('data.cliente', 'Original');
});

it('soft-deletea proyecto', function () {
    $p = Proyecto::factory()->create();

    $this->actingAs($this->admin, 'sanctum')
        ->deleteJson("/api/proyectos/{$p->id}")
        ->assertOk();

    expect(Proyecto::find($p->id))->toBeNull();
});
