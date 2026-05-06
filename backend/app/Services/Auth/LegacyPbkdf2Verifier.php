<?php

namespace App\Services\Auth;

/**
 * Verificador del hash heredado del workflow `16-auth.json`.
 *
 * Formato: `pbkdf2$<iter>$<salt_b64>$<hash_b64>`.
 * Algoritmo: PBKDF2-HMAC-SHA256 (100k iter por defecto, 32 bytes).
 *
 * Solo se usa para validar logins de usuarios cuya `password_algo='pbkdf2'`;
 * tras un login exitoso, AuthController rehashea con bcrypt y actualiza la
 * columna. Cuando la migración esté completa, este servicio puede borrarse.
 */
final class LegacyPbkdf2Verifier
{
    public function verify(string $password, string $stored): bool
    {
        $parts = explode('$', $stored);
        if (count($parts) !== 4 || $parts[0] !== 'pbkdf2') {
            return false;
        }

        $iterations = (int) $parts[1];
        $salt = base64_decode($parts[2], true);
        $expected = base64_decode($parts[3], true);

        if ($iterations <= 0 || $salt === false || $expected === false || $expected === '') {
            return false;
        }

        $derived = hash_pbkdf2('sha256', $password, $salt, $iterations, strlen($expected), true);

        return hash_equals($expected, $derived);
    }
}
