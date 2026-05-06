<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

/**
 * Sustituye los nodos Asana del workflow `07-calendar-asana.json`.
 *
 * Endpoints:
 *   GET /api/asana/tasks?projectId=...           (proxy /projects/{id}/tasks)
 *   GET /api/asana/tasks/{gid}/stories           (proxy /tasks/{gid}/stories)
 *
 * El PAT (Personal Access Token) sale de config('yurest.asana_pat').
 * Si falta, devuelve 503 — el frontend caerá a n8n mientras tanto.
 */
class AsanaController extends Controller
{
    private const BASE_URL = 'https://app.asana.com/api/1.0';

    public function tasks(Request $request): JsonResponse
    {
        $pat = $this->pat();
        if (! $pat) {
            return $this->noPatResponse();
        }

        $data = $request->validate([
            'projectId' => ['required', 'string'],
            'opt_fields' => ['nullable', 'string'],
        ]);

        $res = Http::withToken($pat)
            ->get(self::BASE_URL.'/projects/'.urlencode($data['projectId']).'/tasks', [
                'opt_fields' => $data['opt_fields'] ?? 'name,completed,assignee.name,modified_at,created_at,memberships.section.name',
                'limit' => 100,
            ]);

        if (! $res->successful()) {
            return response()->json(['error' => 'asana_error', 'status' => $res->status()], 502);
        }

        return response()->json($res->json('data') ?: []);
    }

    public function stories(Request $request, string $taskId): JsonResponse
    {
        $pat = $this->pat();
        if (! $pat) {
            return $this->noPatResponse();
        }

        $res = Http::withToken($pat)
            ->get(self::BASE_URL.'/tasks/'.urlencode($taskId).'/stories', [
                'opt_fields' => 'created_at,resource_subtype,text,created_by.name',
                'limit' => 100,
            ]);

        if (! $res->successful()) {
            return response()->json(['error' => 'asana_error', 'status' => $res->status()], 502);
        }

        return response()->json($res->json('data') ?: []);
    }

    private function pat(): ?string
    {
        return config('yurest.asana_pat');
    }

    private function noPatResponse(): JsonResponse
    {
        return response()->json([
            'error' => 'asana_pat_missing',
            'message' => 'ASANA_PAT no configurado en .env. Mientras tanto el frontend debe usar n8n para esta ruta.',
        ], 503);
    }
}
