<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Sustituye el nodo Calendar del workflow `07-calendar-asana.json`.
 *
 * Stub 503 hasta que se configure el cliente Google Calendar (Service
 * Account + scope https://www.googleapis.com/auth/calendar). Mientras
 * tanto el frontend usa n8n para crear eventos.
 *
 * TODO (fase 6): integrar google/apiclient con GOOGLE_SERVICE_ACCOUNT_JSON
 * y emitir el POST a /calendar/v3/calendars/{id}/events.
 */
class CalendarController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'summary' => ['required', 'string', 'max:200'],
            'start' => ['required'],
            'end' => ['required'],
            'attendees' => ['nullable', 'array'],
        ]);

        return response()->json([
            'error' => 'calendar_not_implemented',
            'message' => 'Google Calendar aún no está integrado en Laravel. Sigue usando n8n para esta ruta.',
        ], 503);
    }
}
