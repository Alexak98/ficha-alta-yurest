<?php

use App\Models\User;
use Illuminate\Support\Facades\Hash;

it('DatabaseSeeder crea el usuario alex idempotente', function () {
    $this->seed();
    $this->seed(); // re-seed: no debe duplicar

    $rows = User::where('username', 'alex')->get();
    expect($rows)->toHaveCount(1);

    $alex = $rows->first();
    expect($alex->rol)->toBe('admin')
        ->and($alex->activo)->toBeTrue()
        ->and(Hash::check('alex08', $alex->password))->toBeTrue();
});
