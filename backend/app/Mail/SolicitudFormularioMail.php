<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Address;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * Email enviado al cliente cuando un comercial crea una solicitud de
 * formulario de alta. Replica el "Envio de mail al cliente" del workflow
 * 08-solicitudes.json.
 *
 * El asunto y cuerpo los pasa el frontend en el body del POST. Mantenemos
 * texto plano para que el cliente lea el link sin riesgo de spam-filter.
 */
class SolicitudFormularioMail extends Mailable
{
    use Queueable;
    use SerializesModels;

    public function __construct(
        public readonly string $asunto,
        public readonly string $cuerpo,
        public readonly ?string $fromName = null,
    ) {}

    public function envelope(): Envelope
    {
        $fromAddr = config('mail.from.address');
        $fromName = $this->fromName ?? config('mail.from.name');

        return new Envelope(
            subject: $this->asunto,
            from: $fromAddr ? new Address($fromAddr, $fromName) : null,
        );
    }

    public function content(): Content
    {
        // Cuerpo plano (no HTML). El frontend manda saltos de línea
        // que Mailable convierte a <br> en el textBody automáticamente.
        return new Content(
            text: 'emails.solicitud-formulario',
            with: ['cuerpo' => $this->cuerpo],
        );
    }
}
