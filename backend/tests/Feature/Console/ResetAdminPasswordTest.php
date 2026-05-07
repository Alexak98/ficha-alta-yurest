<?php

use App\Models\User;
use Illuminate\Support\Facades\Hash;

it('resetea la contraseña de un usuario existente', function () {
    $u = User::factory()->create([
        'username' => 'alex',
        'password' => Hash::make('viejo'),
    ]);

    $this->artisan('yurest:reset-admin-password', [
        'username' => 'alex',
        '--password' => 'nueva-pass-segura-2026',
    ])->assertSuccessful();

    $u->refresh();
    expect(Hash::check('nueva-pass-segura-2026', $u->password))->toBeTrue()
        ->and($u->password_algo)->toBe('bcrypt');
});

it('falla si el usuario no existe', function () {
    $this->artisan('yurest:reset-admin-password', [
        'username' => 'no-existe',
        '--password' => 'whatever1234',
    ])->assertFailed();
});

it('rechaza contraseñas demasiado cortas', function () {
    User::factory()->create(['username' => 'alex']);

    $this->artisan('yurest:reset-admin-password', [
        'username' => 'alex',
        '--password' => 'corta',
    ])->assertFailed();
});

it('normaliza username en minúsculas', function () {
    $u = User::factory()->create(['username' => 'maria']);

    $this->artisan('yurest:reset-admin-password', [
        'username' => 'MARIA',
        '--password' => 'pass-12345-segura',
    ])->assertSuccessful();

    expect(Hash::check('pass-12345-segura', $u->fresh()->password))->toBeTrue();
});
