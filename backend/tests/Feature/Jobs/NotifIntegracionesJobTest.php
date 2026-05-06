<?php

use App\Jobs\ProcesarNotifIntegracionesJob;
use App\Mail\IntegracionesSinAvanceMail;
use App\Models\NotifIntegracionesConfig;
use App\Models\NotifIntegracionesGrupo;
use App\Models\NotifIntegracionesHistorial;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;

beforeEach(function () {
    NotifIntegracionesConfig::create([
        'asana_project_id' => '12345',
        'umbral_dias' => 7,
        'secciones_seguimiento' => ['Solicitud de datos realizada'],
        'activo' => true,
    ]);
});

it('aborta sin enviar nada si la config está desactivada', function () {
    NotifIntegracionesConfig::query()->update(['activo' => false]);

    Mail::fake();
    (new ProcesarNotifIntegracionesJob)->handle();

    Mail::assertNothingSent();
    expect(NotifIntegracionesHistorial::count())->toBe(0);
});

it('si falta ASANA_PAT registra historial con error y no envía', function () {
    config(['yurest.asana_pat' => null]);
    NotifIntegracionesGrupo::create([
        'nombre' => 'Soporte', 'destinatarios' => 'a@b.com', 'orden' => 0,
    ]);

    Mail::fake();
    (new ProcesarNotifIntegracionesJob)->handle();

    Mail::assertNothingSent();
    $h = NotifIntegracionesHistorial::first();
    expect($h)->not->toBeNull()
        ->and($h->error)->toBe('asana_pat_missing')
        ->and($h->email_enviado)->toBeFalse();
});

it('manda email a un grupo cuando hay tareas sin avance', function () {
    config(['yurest.asana_pat' => 'fake-pat']);
    NotifIntegracionesGrupo::create([
        'nombre' => 'Soporte', 'destinatarios' => 'a@b.com', 'orden' => 0,
    ]);

    Http::fake([
        'app.asana.com/*' => Http::response([
            'data' => [
                [
                    'gid' => '1',
                    'name' => 'Tarea pendiente',
                    'completed' => false,
                    'modified_at' => now()->subDays(15)->toIso8601String(),
                    'memberships' => [['section' => ['name' => 'Solicitud de datos realizada']]],
                    'assignee' => ['name' => 'Ana'],
                ],
            ],
        ]),
    ]);

    Mail::fake();
    (new ProcesarNotifIntegracionesJob)->handle();

    Mail::assertSent(IntegracionesSinAvanceMail::class);
    $h = NotifIntegracionesHistorial::first();
    expect($h->email_enviado)->toBeTrue()
        ->and($h->total_tareas)->toBe(1);
});

it('no envía email a un grupo sin tareas que matcheen', function () {
    config(['yurest.asana_pat' => 'fake-pat']);
    NotifIntegracionesGrupo::create([
        'nombre' => 'Vacío', 'destinatarios' => 'x@y.com', 'orden' => 0,
    ]);

    Http::fake(['app.asana.com/*' => Http::response(['data' => []])]);

    Mail::fake();
    (new ProcesarNotifIntegracionesJob)->handle();

    Mail::assertNothingSent();
    expect(NotifIntegracionesHistorial::count())->toBe(0);
});
