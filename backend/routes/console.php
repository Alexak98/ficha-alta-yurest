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
