<?php

use App\Models\User;
use Illuminate\Support\Facades\Http;

beforeEach(function () {
    $this->admin = User::factory()->admin()->create();
});

it('devuelve 503 si ASANA_PAT no está configurado', function () {
    config(['yurest.asana_pat' => null]);

    $this->actingAs($this->admin, 'sanctum')
        ->getJson('/api/asana/tasks?projectId=12345')
        ->assertStatus(503)
        ->assertJsonPath('error', 'asana_pat_missing');
});

it('proxyea tasks a Asana cuando hay PAT', function () {
    config(['yurest.asana_pat' => 'fake-pat']);
    Http::fake([
        'app.asana.com/*' => Http::response([
            'data' => [
                ['gid' => '1', 'name' => 'Tarea A', 'completed' => false],
                ['gid' => '2', 'name' => 'Tarea B', 'completed' => true],
            ],
        ]),
    ]);

    $res = $this->actingAs($this->admin, 'sanctum')
        ->getJson('/api/asana/tasks?projectId=12345');

    $res->assertOk();
    expect($res->json())->toHaveCount(2)
        ->and($res->json('0.name'))->toBe('Tarea A');

    Http::assertSent(fn ($req) => str_contains($req->url(), '/projects/12345/tasks')
        && $req->hasHeader('Authorization', 'Bearer fake-pat'));
});

it('proxyea stories a Asana', function () {
    config(['yurest.asana_pat' => 'fake-pat']);
    Http::fake([
        'app.asana.com/*' => Http::response([
            'data' => [['gid' => 'a', 'text' => 'Comentario', 'resource_subtype' => 'comment_added']],
        ]),
    ]);

    $this->actingAs($this->admin, 'sanctum')
        ->getJson('/api/asana/tasks/abc123/stories')
        ->assertOk()
        ->assertJsonPath('0.text', 'Comentario');
});

it('devuelve 502 si Asana responde con error', function () {
    config(['yurest.asana_pat' => 'fake-pat']);
    Http::fake(['app.asana.com/*' => Http::response('boom', 500)]);

    $this->actingAs($this->admin, 'sanctum')
        ->getJson('/api/asana/tasks?projectId=12345')
        ->assertStatus(502)
        ->assertJsonPath('error', 'asana_error');
});

it('rechaza tasks sin projectId', function () {
    config(['yurest.asana_pat' => 'fake-pat']);

    $this->actingAs($this->admin, 'sanctum')
        ->getJson('/api/asana/tasks')
        ->assertStatus(422);
});
