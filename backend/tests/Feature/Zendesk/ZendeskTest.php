<?php

use App\Models\ResumenSemanal;
use App\Models\User;

beforeEach(function () {
    $this->admin = User::factory()->admin()->create();
});

it('heatmap devuelve 503 (stub)', function () {
    $this->actingAs($this->admin, 'sanctum')
        ->getJson('/api/zendesk/heatmap')
        ->assertStatus(503);
});

it('heatmap IA devuelve 503', function () {
    $this->actingAs($this->admin, 'sanctum')
        ->getJson('/api/zendesk/heatmap/ia')
        ->assertStatus(503);
});

it('resumen lee de caché si existe', function () {
    ResumenSemanal::create([
        'anio' => 2026, 'semana' => 18,
        'fecha_desde' => '2026-04-27', 'fecha_hasta' => '2026-05-03',
        'total_tickets' => 42,
        'resumen_markdown' => '# Resumen',
    ]);

    $res = $this->actingAs($this->admin, 'sanctum')
        ->getJson('/api/zendesk/resumen?periodo=semana&anio=2026&semana=18');

    $res->assertOk()
        ->assertJsonPath('total_tickets', 42)
        ->assertJsonPath('resumen_markdown', '# Resumen');
});

it('resumen devuelve 503 si no hay caché', function () {
    $this->actingAs($this->admin, 'sanctum')
        ->getJson('/api/zendesk/resumen?periodo=mes&anio=2026&mes=4')
        ->assertStatus(503)
        ->assertJsonPath('error', 'resumen_no_cacheado');
});

it('rechaza periodo inválido', function () {
    $this->actingAs($this->admin, 'sanctum')
        ->getJson('/api/zendesk/resumen?periodo=invalid')
        ->assertStatus(422);
});
