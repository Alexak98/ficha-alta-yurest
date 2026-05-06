<?php

use App\Models\Proyecto;
use App\Models\User;

beforeEach(function () {
    $this->admin = User::factory()->admin()->create();
    $this->proyecto = Proyecto::factory()->create([
        'secciones' => [
            [
                'nombre' => 'Setup',
                'tareas' => [
                    ['id' => 't1', 'nombre' => 'Crear cuenta', 'completada' => false],
                    ['id' => 't2', 'nombre' => 'Config TPV', 'completada' => false, 'subtareas' => [
                        ['id' => 's1', 'nombre' => 'Driver', 'completada' => false],
                    ]],
                ],
            ],
            [
                'nombre' => 'Formación',
                'tareas' => [
                    ['id' => 't3', 'nombre' => 'Sesión 1', 'completada' => false],
                ],
            ],
        ],
    ]);
});

it('actualiza una tarea con merge campo a campo', function () {
    $res = $this->actingAs($this->admin, 'sanctum')
        ->putJson("/api/proyectos/{$this->proyecto->id}/tareas", [
            'seccionNombre' => 'Setup',
            'tarea' => ['id' => 't1', 'completada' => true, 'asignado' => 'Ana'],
        ]);

    $res->assertOk();

    $secciones = $this->proyecto->fresh()->secciones;
    $t1 = $secciones[0]['tareas'][0];
    expect($t1['completada'])->toBeTrue()
        ->and($t1['asignado'])->toBe('Ana')
        ->and($t1['nombre'])->toBe('Crear cuenta'); // preservado
});

it('actualiza una subtarea buscando dentro de tareas[].subtareas[]', function () {
    $res = $this->actingAs($this->admin, 'sanctum')
        ->putJson("/api/proyectos/{$this->proyecto->id}/tareas", [
            'seccionNombre' => 'Setup',
            'tarea' => ['id' => 's1', 'completada' => true],
        ]);

    $res->assertOk();

    $sub = $this->proyecto->fresh()->secciones[0]['tareas'][1]['subtareas'][0];
    expect($sub['completada'])->toBeTrue();
});

it('falla 422 si la tarea no existe en ninguna sección', function () {
    $this->actingAs($this->admin, 'sanctum')
        ->putJson("/api/proyectos/{$this->proyecto->id}/tareas", [
            'seccionNombre' => 'Setup',
            'tarea' => ['id' => 'inexistente'],
        ])
        ->assertStatus(422);
});

it('mueve una tarea de una sección a otra', function () {
    $res = $this->actingAs($this->admin, 'sanctum')
        ->putJson("/api/proyectos/{$this->proyecto->id}/tareas/mover", [
            'tareaId' => 't1',
            'seccionOrigen' => 'Setup',
            'seccionDestino' => 'Formación',
        ]);

    $res->assertOk();

    $secciones = $this->proyecto->fresh()->secciones;
    $idsSetup = collect($secciones[0]['tareas'])->pluck('id')->all();
    $idsForm = collect($secciones[1]['tareas'])->pluck('id')->all();

    expect($idsSetup)->not->toContain('t1')
        ->and($idsForm)->toContain('t1');
});

it('actualiza la bitácora de anotaciones', function () {
    $anotaciones = [
        ['id' => 'a1', 'texto' => 'Hola', 'usuario' => 'Ana', 'fechaCreacion' => '2026-05-06T10:00:00Z'],
    ];

    $this->actingAs($this->admin, 'sanctum')
        ->putJson("/api/proyectos/{$this->proyecto->id}/anotaciones", [
            'anotaciones' => $anotaciones,
        ])
        ->assertOk();

    expect($this->proyecto->fresh()->anotaciones)->toBe($anotaciones);
});
