<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\Auth\LegacyPbkdf2Verifier;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

/**
 * Sustituye los webhooks `/auth/login`, `/auth/verify` del workflow 16.
 *
 * - login(): valida credenciales, rehashea pbkdf2 → bcrypt si toca, emite
 *   token Sanctum. Mismo shape de respuesta que el workflow original
 *   ({ success, token, user }) para que el frontend no tenga que cambiar.
 * - me(): equivalente a /auth/verify, devuelve estado actual del usuario.
 * - logout(): revoca el token Sanctum activo.
 */
class AuthController extends Controller
{
    public function __construct(
        private readonly LegacyPbkdf2Verifier $legacyVerifier,
    ) {}

    public function login(Request $request): JsonResponse
    {
        $data = $request->validate([
            'username' => ['required', 'string'],
            'password' => ['required', 'string'],
        ]);

        $username = mb_strtolower(trim($data['username']));

        $user = User::query()
            ->where('username', $username)
            ->where('activo', true)
            ->whereNull('deleted_at')
            ->first();

        if (! $user || ! $this->verifyPassword($user, $data['password'])) {
            throw ValidationException::withMessages([
                'username' => ['Credenciales incorrectas'],
            ]);
        }

        $token = $user->createToken('portal', expiresAt: now()->addDays(30))->plainTextToken;

        return response()->json([
            'success' => true,
            'token' => $token,
            'user' => [
                'id' => $user->id,
                'username' => $user->username,
                'nombre' => $user->nombre ?: $user->username,
                'email' => $user->email ?: '',
                'rol' => $user->rol,
                'permisos' => $user->permisos,
                'sessions_revoked_at' => $user->sessions_revoked_at?->toIso8601String(),
            ],
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        $user = $request->user();

        if (! $user || $user->deleted_at !== null || ! $user->activo) {
            return response()->json(['ok' => false, 'reason' => 'usuario inactivo o no encontrado'], 401);
        }

        // Shape FLAT (no envuelto en `user`) para mantener compat con el
        // frontend, que ya consumía /auth/verify de n8n con este formato:
        //   { ok, id, username, nombre, email, rol, permisos, sessions_revoked_at }
        // Si en el futuro queremos un shape más limpio, cambiarlo aquí y en
        // config.js::_validateSessionFresh a la vez.
        return response()->json([
            'ok' => true,
            'id' => $user->id,
            'username' => $user->username,
            'nombre' => $user->nombre ?: $user->username,
            'email' => $user->email ?: '',
            'rol' => $user->rol,
            'permisos' => $user->permisos,
            'sessions_revoked_at' => $user->sessions_revoked_at?->toIso8601String(),
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()?->currentAccessToken()?->delete();

        return response()->json(['ok' => true]);
    }

    /**
     * Verifica la contraseña contra bcrypt (caso normal) o contra el hash
     * PBKDF2 heredado. Si el hash era PBKDF2, lo rehashea con bcrypt al
     * vuelo para que la próxima vez ya use la ruta nativa.
     */
    private function verifyPassword(User $user, string $password): bool
    {
        if ($user->password_algo === 'pbkdf2') {
            if (! $this->legacyVerifier->verify($password, $user->password)) {
                return false;
            }
            // Rehash a bcrypt para futuros logins.
            $user->forceFill([
                'password' => Hash::make($password),
                'password_algo' => 'bcrypt',
            ])->saveQuietly();

            return true;
        }

        return Hash::check($password, $user->password);
    }
}
