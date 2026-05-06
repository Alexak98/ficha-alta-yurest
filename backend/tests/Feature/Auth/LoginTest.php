<?php

use App\Models\User;
use Illuminate\Support\Facades\Hash;

it('rechaza credenciales inválidas', function () {
    User::factory()->create([
        'username' => 'ana',
        'password' => Hash::make('correcto'),
    ]);

    $this->postJson('/api/auth/login', [
        'username' => 'ana',
        'password' => 'malo',
    ])->assertStatus(422);
});

it('emite token Sanctum y devuelve usuario en login bcrypt', function () {
    $user = User::factory()->create([
        'username' => 'ana',
        'password' => Hash::make('correcto'),
        'rol' => 'admin',
        'permisos' => ['read' => [], 'write' => [], 'delete' => []],
    ]);

    $res = $this->postJson('/api/auth/login', [
        'username' => 'ANA  ',  // se trimea + lowercase
        'password' => 'correcto',
    ]);

    $res->assertOk()
        ->assertJsonStructure(['success', 'token', 'user' => ['id', 'username', 'rol', 'permisos']])
        ->assertJsonPath('success', true)
        ->assertJsonPath('user.username', 'ana')
        ->assertJsonPath('user.rol', 'admin');

    expect($user->tokens()->count())->toBe(1);
});

it('rehashea PBKDF2 heredado a bcrypt en el primer login exitoso', function () {
    // Hash precomputado con el algoritmo del workflow 16-auth.json
    // password = "secret", iter = 100000, salt = "saltsaltsaltsalt" (16 bytes)
    $password = 'secret';
    $salt = 'saltsaltsaltsalt';
    $iter = 100000;
    $hash = hash_pbkdf2('sha256', $password, $salt, $iter, 32, true);
    $stored = sprintf(
        'pbkdf2$%d$%s$%s',
        $iter,
        base64_encode($salt),
        base64_encode($hash),
    );

    $user = User::factory()->create([
        'username' => 'legado',
        'password' => $stored,
        'password_algo' => 'pbkdf2',
    ]);

    $this->postJson('/api/auth/login', [
        'username' => 'legado',
        'password' => $password,
    ])->assertOk();

    $user->refresh();
    expect($user->password_algo)->toBe('bcrypt')
        ->and(Hash::check($password, $user->password))->toBeTrue();
});

it('me() devuelve datos del usuario autenticado', function () {
    $user = User::factory()->create();

    $this->actingAs($user, 'sanctum')
        ->getJson('/api/auth/me')
        ->assertOk()
        ->assertJsonPath('ok', true)
        ->assertJsonPath('user.username', $user->username);
});

it('me() rechaza usuario inactivo', function () {
    $user = User::factory()->create(['activo' => false]);

    $this->actingAs($user, 'sanctum')
        ->getJson('/api/auth/me')
        ->assertStatus(401);
});
