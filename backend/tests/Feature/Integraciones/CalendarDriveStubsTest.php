<?php

use App\Models\User;

beforeEach(function () {
    $this->admin = User::factory()->admin()->create();
});

it('Calendar devuelve 503 con mensaje claro', function () {
    $this->actingAs($this->admin, 'sanctum')
        ->postJson('/api/calendar/events', [
            'summary' => 'Reunión',
            'start' => '2026-05-08T10:00:00Z',
            'end' => '2026-05-08T11:00:00Z',
        ])
        ->assertStatus(503)
        ->assertJsonPath('error', 'calendar_not_implemented');
});

it('Calendar valida campos antes de devolver 503', function () {
    $this->actingAs($this->admin, 'sanctum')
        ->postJson('/api/calendar/events', [])
        ->assertStatus(422);
});

it('Drive show devuelve 503', function () {
    $this->actingAs($this->admin, 'sanctum')
        ->getJson('/api/drive?carpetaId=abc')
        ->assertStatus(503)
        ->assertJsonPath('error', 'drive_not_implemented');
});

it('Drive docs-subidos devuelve 503', function () {
    $this->actingAs($this->admin, 'sanctum')
        ->getJson('/api/drive/docs-subidos')
        ->assertStatus(503);
});
