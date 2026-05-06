<?php

use App\Models\Proyecto;
use App\Models\User;

beforeEach(function () {
    $this->admin = User::factory()->admin()->create();
});

it('marca proyecto como grabado_a3 y sella el timestamp', function () {
    $p = Proyecto::factory()->create(['grabado_a3' => false]);

    $res = $this->actingAs($this->admin, 'sanctum')
        ->postJson("/api/proyectos/{$p->id}/grabado-a3", ['grabado_a3' => true]);

    $res->assertOk()
        ->assertJsonPath('success', true)
        ->assertJsonPath('grabado_a3', true);

    $fresh = $p->fresh();
    expect($fresh->grabado_a3)->toBeTrue()
        ->and($fresh->grabado_a3_at)->not->toBeNull();
});

it('al desmarcar grabado_a3 se limpia el timestamp', function () {
    $p = Proyecto::factory()->create();

    // Set true first
    $this->actingAs($this->admin, 'sanctum')
        ->postJson("/api/proyectos/{$p->id}/grabado-a3", ['grabado_a3' => true])
        ->assertOk();

    // Now clear
    $this->actingAs($this->admin, 'sanctum')
        ->postJson("/api/proyectos/{$p->id}/grabado-a3", ['grabado_a3' => false])
        ->assertOk();

    expect($p->fresh()->grabado_a3_at)->toBeNull();
});

it('rechaza valor no booleano', function () {
    $p = Proyecto::factory()->create();

    $this->actingAs($this->admin, 'sanctum')
        ->postJson("/api/proyectos/{$p->id}/grabado-a3", ['grabado_a3' => 'maybe'])
        ->assertStatus(422);
});
