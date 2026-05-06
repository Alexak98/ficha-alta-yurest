<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\NotifIntegracionesConfig;
use App\Models\NotifIntegracionesGrupo;
use App\Models\NotifIntegracionesHistorial;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Sustituye el workflow `15-notif-integraciones-api.json`.
 *
 * Endpoints:
 *   GET  /api/notif-integraciones/config       devuelve { config, grupos }
 *   PUT  /api/notif-integraciones/config       upsert de la fila única
 *   POST /api/notif-integraciones/grupos       { action: 'create'|'update'|'delete', grupo: {...} }
 *   GET  /api/notif-integraciones/historial    últimas 200 ejecuciones
 */
class NotifIntegracionesController extends Controller
{
    public function getConfig(): JsonResponse
    {
        /** @var NotifIntegracionesConfig $config */
        $config = NotifIntegracionesConfig::query()->first()
            ?? tap(NotifIntegracionesConfig::create([]))->refresh();

        $grupos = NotifIntegracionesGrupo::query()
            ->whereNull('deleted_at')
            ->orderBy('orden')
            ->get();

        return response()->json([
            'config' => $config,
            'grupos' => $grupos,
        ]);
    }

    public function updateConfig(Request $request): JsonResponse
    {
        $data = $request->validate([
            'asana_project_id' => ['nullable', 'string'],
            'umbral_dias' => ['nullable', 'integer', 'min:1', 'max:365'],
            'secciones_seguimiento' => ['nullable', 'array'],
            'activo' => ['nullable', 'boolean'],
            'updated_by' => ['nullable', 'string'],
        ]);

        /** @var NotifIntegracionesConfig $config */
        $config = NotifIntegracionesConfig::query()->first()
            ?? tap(NotifIntegracionesConfig::create([]))->refresh();
        $config->update($data);

        return response()->json($config->refresh());
    }

    public function gruposAction(Request $request): JsonResponse
    {
        $data = $request->validate([
            'action' => ['required', 'in:create,update,delete'],
            'grupo' => ['required', 'array'],
            'grupo.id' => ['required_unless:action,create', 'uuid'],
            'grupo.nombre' => ['nullable', 'string', 'max:200'],
            'grupo.destinatarios' => ['nullable', 'string'],
            'grupo.filtro_tpv' => ['nullable', 'array'],
            'grupo.filtro_secciones' => ['nullable', 'array'],
            'grupo.activo' => ['nullable', 'boolean'],
            'grupo.orden' => ['nullable', 'integer'],
        ]);

        $grupo = $data['grupo'];

        return match ($data['action']) {
            'create' => $this->createGrupo($grupo),
            'update' => $this->updateGrupo($grupo),
            'delete' => $this->deleteGrupo($grupo),
            default => response()->json(['error' => 'unknown_action'], 422),
        };
    }

    public function getHistorial(): JsonResponse
    {
        $rows = NotifIntegracionesHistorial::query()
            ->orderByDesc('ejecutado_at')
            ->limit(200)
            ->get();

        return response()->json($rows);
    }

    /** @param  array<string, mixed>  $g */
    private function createGrupo(array $g): JsonResponse
    {
        $row = NotifIntegracionesGrupo::create([
            'nombre' => $g['nombre'] ?? 'Sin nombre',
            'destinatarios' => $g['destinatarios'] ?? '',
            'filtro_tpv' => $g['filtro_tpv'] ?? [],
            'filtro_secciones' => $g['filtro_secciones'] ?? [],
            'activo' => $g['activo'] ?? true,
            'orden' => $g['orden'] ?? 0,
        ]);

        return response()->json($row->refresh(), 201);
    }

    /** @param  array<string, mixed>  $g */
    private function updateGrupo(array $g): JsonResponse
    {
        /** @var NotifIntegracionesGrupo $row */
        $row = NotifIntegracionesGrupo::query()->findOrFail($g['id']);
        $row->update([
            'nombre' => $g['nombre'] ?? $row->nombre,
            'destinatarios' => $g['destinatarios'] ?? $row->destinatarios,
            'filtro_tpv' => $g['filtro_tpv'] ?? $row->filtro_tpv,
            'filtro_secciones' => $g['filtro_secciones'] ?? $row->filtro_secciones,
            'activo' => $g['activo'] ?? $row->activo,
            'orden' => $g['orden'] ?? $row->orden,
        ]);

        return response()->json($row->refresh());
    }

    /** @param  array<string, mixed>  $g */
    private function deleteGrupo(array $g): JsonResponse
    {
        /** @var NotifIntegracionesGrupo $row */
        $row = NotifIntegracionesGrupo::query()->findOrFail($g['id']);
        $row->delete();

        return response()->json(['ok' => true]);
    }
}
