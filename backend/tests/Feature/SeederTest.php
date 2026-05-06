<?php

use App\Models\User;
use Illuminate\Support\Facades\Hash;

it('DatabaseSeeder crea un admin local idempotente', function () {
    $this->seed();
    $this->seed(); // re-seed: no debe duplicar

    $admins = User::where('username', 'admin')->get();
    expect($admins)->toHaveCount(1);

    $admin = $admins->first();
    expect($admin->rol)->toBe('admin')
        ->and($admin->activo)->toBeTrue()
        ->and(Hash::check('password', $admin->password))->toBeTrue();
});
