<?php

use App\Models\ChurnTecnico;
use App\Models\User;

beforeEach(function () {
    $this->admin = User::factory()->admin()->create();
});

it('lista clientes ordenados por fecha_resumen desc', function () {
    ChurnTecnico::create(['id_organizacion' => 'org-1', 'nombre' => 'Cliente A', 'nivel' => 5, 'fecha_resumen' => now()->subDays(2)]);
    ChurnTecnico::create(['id_organizacion' => 'org-2', 'nombre' => 'Cliente B', 'nivel' => 8, 'fecha_resumen' => now()]);

    $res = $this->actingAs($this->admin, 'sanctum')->getJson('/api/churn/clientes');

    $res->assertOk();
    expect($res->json())->toHaveCount(2)
        ->and($res->json('0.id_organizacion'))->toBe('org-2');
});

it('busca resumen por id_organizacion', function () {
    ChurnTecnico::create(['id_organizacion' => 'org-x', 'respuesta_ia' => '# Resumen X', 'nivel' => 3]);

    $this->actingAs($this->admin, 'sanctum')
        ->postJson('/api/churn/buscar-resumen', ['id_organizacion' => 'org-x'])
        ->assertOk()
        ->assertJsonPath('respuesta_ia', '# Resumen X')
        ->assertJsonPath('nivel', 3);
});

it('devuelve 404 si la org no existe', function () {
    $this->actingAs($this->admin, 'sanctum')
        ->postJson('/api/churn/buscar-resumen', ['id_organizacion' => 'no-existe'])
        ->assertStatus(404);
});

it('status devuelve contadores correctos', function () {
    ChurnTecnico::create(['id_organizacion' => 'a', 'nivel' => 5, 'fecha_resumen' => now()]);
    ChurnTecnico::create(['id_organizacion' => 'b', 'nivel' => null, 'fecha_resumen' => null]);
    ChurnTecnico::create(['id_organizacion' => 'c', 'nivel' => 7, 'fecha_resumen' => now()]);

    $res = $this->actingAs($this->admin, 'sanctum')->getJson('/api/churn/status');

    $res->assertOk()
        ->assertJsonPath('total', 3)
        ->assertJsonPath('sin_nivel', 1)
        ->assertJsonPath('sin_resumen', 1)
        ->assertJsonPath('actualizados_hoy', 2);
});

it('rechaza nivel fuera de 0..10', function () {
    expect(fn () => ChurnTecnico::create(['id_organizacion' => 'org-z', 'nivel' => 99]))
        ->toThrow(Throwable::class);
});

it('scan/refresh devuelven 503 stub', function () {
    $this->actingAs($this->admin, 'sanctum')
        ->postJson('/api/churn/scan')
        ->assertStatus(503);

    $this->actingAs($this->admin, 'sanctum')
        ->postJson('/api/churn/refresh')
        ->assertStatus(503);
});
