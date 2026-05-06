<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\FichaAlta;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Sustituye el workflow `19-notif-ficha-completa.json` (parcialmente).
 *
 * Marca la ficha como notificada (idempotencia) y devuelve los flags de
 * qué emails habría que enviar (Drive + Integraciones si TPV no integrado).
 *
 * El envío real de emails y la creación de la tarea Asana se mueven a
 * Jobs encolados en Horizon — ver fase 6 del plan de migración. Este
 * endpoint solo gestiona la idempotencia y deja los flags listos.
 */
class NotificarFichaCompletaController extends Controller
{
    public function notificar(Request $request): JsonResponse
    {
        $data = $request->validate([
            'ficha_id' => ['required', 'uuid', 'exists:fichas_alta,id'],
        ]);

        /** @var FichaAlta $ficha */
        $ficha = FichaAlta::query()->findOrFail($data['ficha_id']);

        $yaNotificada = $ficha->getAttribute('notificada_completa_at') !== null;
        $tpvNoIntegrado = (bool) $ficha->tpv_no_integrado;

        if (! $yaNotificada) {
            $ficha->forceFill(['notificada_completa_at' => now()])->save();
        }

        return response()->json([
            'success' => true,
            'ficha_id' => $ficha->id,
            'ya_notificada' => $yaNotificada,
            'enviar_drive' => ! $yaNotificada,
            'enviar_integraciones' => ! $yaNotificada && $tpvNoIntegrado,
            'tpv_ni_email' => $ficha->tpv_ni_email,
            // El envío efectivo se hará vía Jobs en Horizon (fase 6). Mientras
            // tanto, n8n sigue gestionando los emails de los workflows 14/15.
        ]);
    }
}
