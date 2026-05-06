<?php

it('responde /api/health con metadata del entorno', function () {
    $res = $this->getJson('/api/health');

    $res->assertOk()
        ->assertJsonStructure(['status', 'app', 'env', 'time'])
        ->assertJsonPath('status', 'ok');
});

it('expone /up para health checks de Forge', function () {
    $this->get('/up')->assertOk();
});
