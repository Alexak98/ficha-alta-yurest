<?php

use App\Mail\SolicitudFormularioMail;
use App\Models\Solicitud;
use App\Models\User;
use Illuminate\Support\Facades\Mail;

beforeEach(function () {
    $this->admin = User::factory()->admin()->create();
    Mail::fake();
});

it('envía email al cliente al crear solicitud (shape legacy)', function () {
    $payload = [
        'access_token' => str_repeat('a', 32),
        'Nombre Sociedad' => 'Mediterráneo SL',
        'CIF/NIF' => 'B12345678',
        'Nombre' => 'Pedro García',
        'Email' => 'pedro@mediterraneo.com',
        'Comercial' => 'Ana Pérez',
        'Tipo Cliente' => 'corporate',
        'Estado' => 'Pendiente',
        'email_to' => 'pedro@mediterraneo.com',
        'email_subject' => 'Solicitud de creación de ficha',
        'email_body' => "Hola Pedro,\n\nRellena el formulario...",
        'form_url' => 'https://alexak98.github.io/yurest/solicitud.html?t=abc',
    ];

    $res = $this->actingAs($this->admin, 'sanctum')
        ->postJson('/api/solicitudes', $payload);

    $res->assertCreated();

    Mail::assertSent(SolicitudFormularioMail::class, function ($mail) {
        return $mail->hasTo('pedro@mediterraneo.com')
            && $mail->asunto === 'Solicitud de creación de ficha'
            && str_contains($mail->cuerpo, 'Rellena el formulario');
    });
});

it('crea la solicitud aunque no venga info de email (no falla)', function () {
    $res = $this->actingAs($this->admin, 'sanctum')
        ->postJson('/api/solicitudes', [
            'tipo' => 'documentos',
        ]);

    $res->assertCreated();
    Mail::assertNothingSent();
});

it('si el SMTP falla, la solicitud sí se crea (tolerante)', function () {
    Mail::fake();
    Mail::shouldReceive('to')->andThrow(new RuntimeException('smtp down'));

    // No esperamos exception, esperamos que la solicitud se cree y se loguee
    $res = $this->actingAs($this->admin, 'sanctum')
        ->postJson('/api/solicitudes', [
            'Email' => 'cliente@x.com',
            'email_to' => 'cliente@x.com',
            'email_subject' => 'Test',
            'email_body' => 'Body',
        ]);

    $res->assertCreated();
});

it('reenviar email funciona contra una solicitud existente', function () {
    $sol = Solicitud::factory()->create();

    $res = $this->actingAs($this->admin, 'sanctum')
        ->postJson("/api/solicitudes/{$sol->id}/reenviar", [
            'email_to' => 'reenviado@cliente.com',
            'email_subject' => 'Re: Solicitud',
            'email_body' => 'Te reenvío el formulario',
        ]);

    $res->assertOk()->assertJsonPath('ok', true);

    Mail::assertSent(SolicitudFormularioMail::class, function ($mail) {
        return $mail->hasTo('reenviado@cliente.com');
    });
});

it('reenviar valida que email_to es email', function () {
    $sol = Solicitud::factory()->create();

    $this->actingAs($this->admin, 'sanctum')
        ->postJson("/api/solicitudes/{$sol->id}/reenviar", [
            'email_to' => 'no-es-email',
            'email_subject' => 'X',
            'email_body' => 'X',
        ])
        ->assertStatus(422);
});
