<?php

use App\Jobs\ProcesarNotifIntegracionesJob;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

/*
 * Cron del workflow 14-notif-integraciones-semanal:
 * lunes 09:00 (Europe/Madrid) → encola el job que procesa todos los grupos.
 */
Schedule::job(new ProcesarNotifIntegracionesJob('cron'))
    ->weeklyOn(1, '09:00')
    ->timezone('Europe/Madrid')
    ->name('notif-integraciones-semanal')
    ->withoutOverlapping();

/*
 * Backups con spatie/laravel-backup. Solo activos en prod (BACKUP_DESTINATION_DISK
 * setea el disco real; en dev se queda en 'local'). Más detalles en docs/BACKUPS.md.
 *
 *   03:00 UTC → genera + sube backup.
 *   04:00 UTC → limpia según política de retención.
 *   05:00 UTC → verifica salud (avisa si llevan días sin backup).
 */
Schedule::command('backup:clean')
    ->daily()->at('04:00')
    ->name('backup-clean')
    ->withoutOverlapping();

Schedule::command('backup:run')
    ->daily()->at('03:00')
    ->name('backup-run')
    ->withoutOverlapping()
    ->onOneServer();

Schedule::command('backup:monitor')
    ->daily()->at('05:00')
    ->name('backup-monitor')
    ->withoutOverlapping();
