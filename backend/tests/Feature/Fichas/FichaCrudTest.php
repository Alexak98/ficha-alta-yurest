<?php

use App\Models\FichaAlta;
use App\Models\Local;
use App\Models\User;

beforeEach(function () {
    $this->admin = User::factory()->admin()->create();
    $this->lector = User::factory()->create([
        'permisos' => ['read' => ['fichas'], 'write' => [], 'delete' => []],
    ]);
});

it('rechaza index sin auth', function () {
    $this->getJson('/api/fichas')->assertStatus(401);
});

it('lista fichas paginadas con locales embebidos', function () {
    $f = FichaAlta::factory()->create();
    Local::factory()->count(2)->create(['ficha_id' => $f->id]);
    FichaAlta::factory()->count(2)->create();

    $res = $this->actingAs($this->admin, 'sanctum')->getJson('/api/fichas');

    $res->assertOk()
        ->assertJsonStructure([
            'data' => [['id', 'denominacion', 'estado', 'locales', 'locales_count']],
            'links',
            'meta',
        ]);
    expect($res->json('data'))->toHaveCount(3);

    $primera = collect($res->json('data'))->firstWhere('id', $f->id);
    expect($primera['locales_count'])->toBe(2)
        ->and($primera['locales'])->toHaveCount(2);
});

it('aplica filtros estado, tipo_cliente y comercial', function () {
    FichaAlta::factory()->create(['estado' => 'pendiente', 'tipo_cliente' => 'lite', 'comercial' => 'Ana']);
    FichaAlta::factory()->create(['estado' => 'completada', 'tipo_cliente' => 'planes', 'comercial' => 'Bea']);
    FichaAlta::factory()->create(['estado' => 'pendiente', 'tipo_cliente' => 'planes', 'comercial' => 'Ana']);

    $res = $this->actingAs($this->admin, 'sanctum')
        ->getJson('/api/fichas?estado=pendiente&comercial=Ana');

    expect($res->json('data'))->toHaveCount(2);
});

it('busqueda fuzzy por denominacion/cif/email con q', function () {
    FichaAlta::factory()->create(['denominacion' => 'Restaurantes Mediterráneo SL']);
    FichaAlta::factory()->create(['denominacion' => 'Pizzerías Norte']);

    $res = $this->actingAs($this->admin, 'sanctum')->getJson('/api/fichas?q=mediter');

    expect($res->json('data'))->toHaveCount(1)
        ->and($res->json('data.0.denominacion'))->toContain('Mediter');
});

it('crea ficha con todos los campos opcionales en blanco', function () {
    $res = $this->actingAs($this->admin, 'sanctum')
        ->postJson('/api/fichas', ['denominacion' => 'Nueva SL']);

    $res->assertCreated()
        ->assertJsonPath('data.denominacion', 'Nueva SL')
        ->assertJsonPath('data.estado', 'pendiente')
        ->assertJsonPath('data.locales_count', 0);
});

it('rechaza store sin denominacion', function () {
    $this->actingAs($this->admin, 'sanctum')
        ->postJson('/api/fichas', [])
        ->assertStatus(422)
        ->assertJsonValidationErrors('denominacion');
});

it('rechaza store si el usuario solo tiene read', function () {
    $this->actingAs($this->lector, 'sanctum')
        ->postJson('/api/fichas', ['denominacion' => 'X'])
        ->assertStatus(403);
});

it('rechaza CP que no sean 5 dígitos', function () {
    $this->actingAs($this->admin, 'sanctum')
        ->postJson('/api/fichas', ['denominacion' => 'X', 'cp' => 'abc'])
        ->assertStatus(422)
        ->assertJsonValidationErrors('cp');
});

it('rechaza tipo_cliente fuera del CHECK', function () {
    $this->actingAs($this->admin, 'sanctum')
        ->postJson('/api/fichas', ['denominacion' => 'X', 'tipo_cliente' => 'invalido'])
        ->assertStatus(422)
        ->assertJsonValidationErrors('tipo_cliente');
});

it('update parcial no pisa otros campos', function () {
    $f = FichaAlta::factory()->create([
        'denominacion' => 'Original',
        'cif' => 'B12345678',
        'comercial' => 'Ana',
    ]);

    $this->actingAs($this->admin, 'sanctum')
        ->putJson("/api/fichas/{$f->id}", ['comercial' => 'Bea'])
        ->assertOk();

    $f->refresh();
    expect($f->comercial)->toBe('Bea')
        ->and($f->denominacion)->toBe('Original')
        ->and($f->cif)->toBe('B12345678');
});

it('show devuelve ficha con sus locales', function () {
    $f = FichaAlta::factory()->create();
    Local::factory()->create(['ficha_id' => $f->id, 'nombre' => 'Sede Central']);

    $res = $this->actingAs($this->admin, 'sanctum')->getJson("/api/fichas/{$f->id}");

    $res->assertOk()
        ->assertJsonPath('data.id', $f->id)
        ->assertJsonPath('data.locales.0.nombre', 'Sede Central');
});

it('soft-deletea ficha', function () {
    $f = FichaAlta::factory()->create();

    $this->actingAs($this->admin, 'sanctum')
        ->deleteJson("/api/fichas/{$f->id}")
        ->assertOk();

    expect(FichaAlta::withTrashed()->find($f->id))->not->toBeNull()
        ->and(FichaAlta::find($f->id))->toBeNull();
});

it('devuelve 404 al pedir una ficha inexistente', function () {
    $this->actingAs($this->admin, 'sanctum')
        ->getJson('/api/fichas/00000000-0000-0000-0000-000000000000')
        ->assertStatus(404);
});
