<?php

namespace App\Models;

use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\HasApiTokens;

/**
 * Usuario del portal Yurest.
 *
 * Tabla `users` (renombrada desde `usuarios` en Supabase). El campo
 * `password_algo` permite el rehash gradual de hashes PBKDF2 heredados a
 * bcrypt nativo de Laravel — ver AuthController::login.
 *
 * @property string $id
 * @property string $username
 * @property string|null $nombre
 * @property string|null $email
 * @property string $password
 * @property string $password_algo
 * @property string $rol
 * @property array{read: array<int, string>, write: array<int, string>, delete: array<int, string>} $permisos
 * @property bool $activo
 * @property Carbon|null $sessions_revoked_at
 */
class User extends Authenticatable
{
    use HasApiTokens;

    /** @use HasFactory<UserFactory> */
    use HasFactory;

    use HasUuids;
    use Notifiable;
    use SoftDeletes;

    protected $fillable = [
        'username',
        'nombre',
        'email',
        'password',
        'password_algo',
        'rol',
        'permisos',
        'activo',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'permisos' => 'array',
            'activo' => 'boolean',
            'sessions_revoked_at' => 'datetime',
            'email_verified_at' => 'datetime',
        ];
    }

    /**
     * Devuelve true si el usuario tiene el permiso `<accion>` sobre la página `<pageId>`.
     * Los admins pasan todo. Cualquier otro rol consulta `permisos[$accion]`.
     */
    public function tienePermiso(string $pageId, string $accion): bool
    {
        if ($this->rol === 'admin') {
            return true;
        }
        $perms = $this->permisos ?? [];
        $lista = $perms[$accion] ?? [];

        return in_array($pageId, $lista, true);
    }
}
