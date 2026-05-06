<?php

namespace App\Mail;

use App\Models\NotifIntegracionesGrupo;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * Email semanal con las tareas Asana sin avance dentro del umbral.
 *
 * @property array<int, array<string, mixed>> $tareas
 */
class IntegracionesSinAvanceMail extends Mailable
{
    use Queueable;
    use SerializesModels;

    /** @param  array<int, array<string, mixed>>  $tareas */
    public function __construct(
        public NotifIntegracionesGrupo $grupo,
        public array $tareas,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Integraciones sin avance — '.now()->format('d/m/Y'),
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.integraciones-sin-avance',
            with: [
                'grupo' => $this->grupo,
                'tareas' => $this->tareas,
            ],
        );
    }
}
