<?php

use App\Models\FichaAlta;
use App\Models\Proyecto;
use App\Models\Solicitud;
use App\Models\User;

beforeEach(function () {
    $this->admin = User::factory()->admin()->create();
});

it('soft-deletea ficha con entity explícito', function () {
    $f = FichaAlta::factory()->create();

    $this->actingAs($this->admin, 'sanctum')
        ->postJson('/api/eliminar', ['id' => $f->id, 'entity' => 'ficha'])
        ->assertOk()
        ->assertJsonPath('success', true)
        ->assertJsonPath('affected', 1);

    expect(FichaAlta::find($f->id))->toBeNull();
});

it('descubre la entidad correcta sin entity', function () {
    $s = Solicitud::factory()->create();

    $this->actingAs($this->admin, 'sanctum')
        ->postJson('/api/eliminar', ['id' => $s->id])
        ->assertOk()
        ->assertJsonPath('success', true);

    expect(Solicitud::find($s->id))->toBeNull();
});

it('busca en proyectos también', function () {
    $p = Proyecto::factory()->create();

    $this->actingAs($this->admin, 'sanctum')
        ->postJson('/api/eliminar', ['id' => $p->id])
        ->assertOk();

    expect(Proyecto::find($p->id))->toBeNull();
});

it('devuelve 404 si el id no existe en ninguna tabla', function () {
    $this->actingAs($this->admin, 'sanctum')
        ->postJson('/api/eliminar', ['id' => '00000000-0000-0000-0000-000000000000'])
        ->assertStatus(404)
        ->assertJsonPath('success', false);
});

it('rechaza sin id', function () {
    $this->actingAs($this->admin, 'sanctum')
        ->postJson('/api/eliminar', [])
        ->assertStatus(422);
});

it('rechaza id no UUID', function () {
    $this->actingAs($this->admin, 'sanctum')
        ->postJson('/api/eliminar', ['id' => 'not-a-uuid'])
        ->assertStatus(422);
});
