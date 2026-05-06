<?php

use App\Models\Proyecto;
use App\Models\ProyectoHistorial;
use App\Models\User;

beforeEach(function () {
    $this->admin = User::factory()->admin()->create();
    $this->proyecto = Proyecto::factory()->create();
});

it('lista las últimas N entradas ordenadas por fecha desc', function () {
    ProyectoHistorial::factory()->count(3)->create([
        'proyecto_id' => $this->proyecto->id,
    ]);

    $res = $this->actingAs($this->admin, 'sanctum')
        ->getJson("/api/proyectos/{$this->proyecto->id}/historial?limit=2");

    $res->assertOk();
    expect($res->json('data'))->toHaveCount(2);
});

it('inserta una entrada con acción válida', function () {
    $res = $this->actingAs($this->admin, 'sanctum')
        ->postJson("/api/proyectos/{$this->proyecto->id}/historial", [
            'accion' => 'tarea_completada',
            'usuario' => ['id' => $this->admin->id, 'nombre' => 'Alex', 'rol' => 'admin'],
            'tarea_id' => 't1',
            'tarea_nombre' => 'Crear cuenta',
            'descripcion' => 'Marcada como completada',
            'cambios' => ['completada' => [false, true]],
        ]);

    $res->assertCreated()
        ->assertJsonPath('data.accion', 'tarea_completada')
        ->assertJsonPath('data.usuario_nombre', 'Alex')
        ->assertJsonPath('data.usuario_rol', 'admin');
});

it('rechaza una acción no listada', function () {
    $this->actingAs($this->admin, 'sanctum')
        ->postJson("/api/proyectos/{$this->proyecto->id}/historial", [
            'accion' => 'inventada',
        ])
        ->assertStatus(422);
});

it('cae a usuario_rol=user si llega un rol inválido', function () {
    $this->actingAs($this->admin, 'sanctum')
        ->postJson("/api/proyectos/{$this->proyecto->id}/historial", [
            'accion' => 'otro',
            'usuario' => ['nombre' => 'X', 'rol' => 'hacker'],
        ])
        ->assertStatus(422); // por la regla de validación

    // Ahora con rol válido pero sin nada más
    $res = $this->actingAs($this->admin, 'sanctum')
        ->postJson("/api/proyectos/{$this->proyecto->id}/historial", [
            'accion' => 'otro',
            'usuario' => ['nombre' => 'Sistema'],
        ]);

    $res->assertCreated()->assertJsonPath('data.usuario_rol', 'user');
});
