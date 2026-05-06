<?php

namespace App\Jobs;

use App\Mail\IntegracionesSinAvanceMail;
use App\Models\NotifIntegracionesConfig;
use App\Models\NotifIntegracionesGrupo;
use App\Models\NotifIntegracionesHistorial;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

/**
 * Sustituye el cron del workflow `14-notif-integraciones-semanal.json`.
 *
 * Programado lunes 09:00 desde routes/console.php. Lee la config, consulta
 * Asana por las tareas en secciones de seguimiento sin actividad reciente,
 * compone un email por grupo destinatario, lo envía y guarda historial.
 *
 * Si ASANA_PAT o el SMTP no están configurados, el job loggea y registra
 * el fallo en el historial sin crashear (idempotencia para reintento manual).
 */
class ProcesarNotifIntegracionesJob implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public readonly string $disparador = 'cron',
    ) {}

    public function handle(): void
    {
        $config = NotifIntegracionesConfig::query()->first();
        if (! $config || ! $config->activo) {
            Log::info('NotifIntegraciones: config inactiva, abortando');

            return;
        }

        $pat = config('yurest.asana_pat');
        if (! $pat) {
            $this->logHistorial(null, 'sin grupo', '', 0, $config->umbral_dias, [], false, 'asana_pat_missing');

            return;
        }

        $tareasFiltradas = $this->fetchTareasAsana($pat, $config);

        $grupos = NotifIntegracionesGrupo::query()
            ->whereNull('deleted_at')
            ->where('activo', true)
            ->orderBy('orden')
            ->get();

        foreach ($grupos as $grupo) {
            $tareasGrupo = $this->filtrarParaGrupo($tareasFiltradas, $grupo);

            if (count($tareasGrupo) === 0) {
                continue; // sin tareas que matcheen → no enviamos email
            }

            $error = null;
            $enviado = false;
            try {
                Mail::to(array_filter(array_map('trim', explode(',', $grupo->destinatarios))))
                    ->send(new IntegracionesSinAvanceMail($grupo, $tareasGrupo));
                $enviado = true;
            } catch (\Throwable $e) {
                $error = $e->getMessage();
            }

            $this->logHistorial(
                grupoId: $grupo->id,
                grupoNombre: $grupo->nombre,
                destinatarios: $grupo->destinatarios,
                totalTareas: count($tareasGrupo),
                umbralDias: $config->umbral_dias,
                tareas: $tareasGrupo,
                emailEnviado: $enviado,
                error: $error,
            );
        }
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function fetchTareasAsana(string $pat, NotifIntegracionesConfig $config): array
    {
        $url = 'https://app.asana.com/api/1.0/projects/'.urlencode($config->asana_project_id).'/tasks';
        $res = Http::withToken($pat)->get($url, [
            'opt_fields' => 'name,completed,modified_at,created_at,memberships.section.name,assignee.name',
            'limit' => 100,
        ]);
        if (! $res->successful()) {
            Log::warning('NotifIntegraciones: Asana respondió '.$res->status());

            return [];
        }

        $umbralTs = now()->subDays($config->umbral_dias)->timestamp;
        $secciones = $config->secciones_seguimiento ?? [];

        $out = [];
        foreach (($res->json('data') ?: []) as $t) {
            if ($t['completed'] ?? false) {
                continue;
            }
            $secNombre = $t['memberships'][0]['section']['name'] ?? null;
            if (! in_array($secNombre, $secciones, true)) {
                continue;
            }
            $modTs = strtotime($t['modified_at'] ?? $t['created_at'] ?? 'now');
            if ($modTs > $umbralTs) {
                continue;
            }
            $out[] = $t + ['_seccion' => $secNombre];
        }

        return $out;
    }

    /**
     * @param  array<int, array<string, mixed>>  $tareas
     * @return array<int, array<string, mixed>>
     */
    private function filtrarParaGrupo(array $tareas, NotifIntegracionesGrupo $grupo): array
    {
        /** @var array<int, string> $filtroSec */
        $filtroSec = $grupo->filtro_secciones ?? [];

        return array_values(array_filter($tareas, function (array $t) use ($filtroSec) {
            if (count($filtroSec) === 0) {
                return true; // sin filtro = todas
            }

            return in_array($t['_seccion'] ?? null, $filtroSec, true);
        }));
    }

    /** @param  array<int, array<string, mixed>>  $tareas */
    private function logHistorial(
        ?string $grupoId,
        string $grupoNombre,
        string $destinatarios,
        int $totalTareas,
        int $umbralDias,
        array $tareas,
        bool $emailEnviado,
        ?string $error,
    ): void {
        NotifIntegracionesHistorial::create([
            'grupo_id' => $grupoId,
            'grupo_nombre' => $grupoNombre,
            'destinatarios' => $destinatarios,
            'total_tareas' => $totalTareas,
            'umbral_dias' => $umbralDias,
            'tareas' => $tareas,
            'email_enviado' => $emailEnviado,
            'error' => $error,
            'disparador' => $this->disparador,
        ]);
    }
}
