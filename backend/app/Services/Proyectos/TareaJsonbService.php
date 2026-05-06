<?php

namespace App\Services\Proyectos;

use RuntimeException;

/**
 * Manipula tareas dentro del JSONB `proyectos.secciones`.
 *
 * `secciones` es un array de:
 *   { nombre: string, tareas: [{ id, ..., subtareas?: [{ id, ... }] }] }
 *
 * Replica la lógica del workflow `02-proyectos-tareas.json` (nodos
 * "Actualizar Tarea en JSONB" y "Mover Tarea en JSONB"). Las funciones
 * son puras: reciben el array, devuelven el array modificado, sin tocar
 * BD ni dispatch de eventos.
 */
final class TareaJsonbService
{
    /**
     * Hace merge de los campos de `tarea` sobre la tarea (o subtarea)
     * existente con el mismo id, dentro de la sección indicada.
     *
     * Si no la encuentra en esa sección, busca en cualquier otra (para
     * tolerar renombres del frontend que no se hayan sincronizado).
     *
     * @param  array<int, array<string, mixed>>  $secciones
     * @param  array<string, mixed>  $tarea
     * @return array<int, array<string, mixed>>
     *
     * @throws RuntimeException si la tarea no se encuentra en ninguna sección.
     */
    public function actualizarTarea(array $secciones, string $seccionNombre, array $tarea): array
    {
        if (! isset($tarea['id'])) {
            throw new RuntimeException('tarea.id es obligatorio');
        }

        $tareaId = (string) $tarea['id'];

        // 1. Intenta primero en la sección indicada (tareas + subtareas).
        foreach ($secciones as &$seccion) {
            if (($seccion['nombre'] ?? null) !== $seccionNombre) {
                continue;
            }
            if ($this->mergeTarea($seccion['tareas'] ?? [], $tareaId, $tarea, $seccion['tareas'])) {
                return $secciones;
            }
            // Búsqueda en subtareas dentro de la sección
            /** @var array<int, array<string, mixed>> $tareasArr */
            $tareasArr = $seccion['tareas'];
            foreach ($tareasArr as &$t) {
                if (! isset($t['subtareas'])) {
                    continue;
                }
                if ($this->mergeTarea($t['subtareas'], $tareaId, $tarea, $t['subtareas'])) {
                    $seccion['tareas'] = $tareasArr;

                    return $secciones;
                }
            }
            unset($t);
            $seccion['tareas'] = $tareasArr;
        }
        unset($seccion);

        // 2. Fallback: buscar en cualquier sección.
        foreach ($secciones as &$seccion) {
            if ($this->mergeTarea($seccion['tareas'] ?? [], $tareaId, $tarea, $seccion['tareas'])) {
                return $secciones;
            }
        }
        unset($seccion);

        throw new RuntimeException("Tarea $tareaId no encontrada en sección $seccionNombre");
    }

    /**
     * Mueve una tarea (top-level) de una sección a otra.
     *
     * @param  array<int, array<string, mixed>>  $secciones
     * @return array<int, array<string, mixed>>
     *
     * @throws RuntimeException si origen/destino/tarea no existen.
     */
    public function moverTarea(array $secciones, string $tareaId, string $seccionOrigen, string $seccionDestino): array
    {
        if ($seccionOrigen === $seccionDestino) {
            return $secciones;
        }

        $origenIdx = $this->findSeccionIdx($secciones, $seccionOrigen);
        $destinoIdx = $this->findSeccionIdx($secciones, $seccionDestino);

        if ($origenIdx === null) {
            throw new RuntimeException("Sección origen no encontrada: $seccionOrigen");
        }
        if ($destinoIdx === null) {
            throw new RuntimeException("Sección destino no encontrada: $seccionDestino");
        }

        $tareas = $secciones[$origenIdx]['tareas'] ?? [];
        $tareaPos = null;
        foreach ($tareas as $i => $t) {
            if (($t['id'] ?? null) === $tareaId) {
                $tareaPos = $i;
                break;
            }
        }
        if ($tareaPos === null) {
            throw new RuntimeException("Tarea $tareaId no encontrada en $seccionOrigen");
        }

        $tarea = $tareas[$tareaPos];
        array_splice($tareas, $tareaPos, 1);
        $secciones[$origenIdx]['tareas'] = array_values($tareas);

        $secciones[$destinoIdx]['tareas'][] = $tarea;

        return $secciones;
    }

    /**
     * Helper: hace merge en el primer elemento del array con id == $id.
     * Devuelve true si encontró y actualizó, false si no.
     *
     * @param  array<int, array<string, mixed>>  $arr  (no se modifica directamente)
     * @param  array<string, mixed>  $patch
     * @param  array<int, array<string, mixed>>  &$ref  referencia donde escribir el merge
     */
    private function mergeTarea(array $arr, string $id, array $patch, array &$ref): bool
    {
        foreach ($arr as $i => $t) {
            if (($t['id'] ?? null) === $id) {
                $ref[$i] = array_replace($t, $patch);

                return true;
            }
        }

        return false;
    }

    /** @param  array<int, array<string, mixed>>  $secciones */
    private function findSeccionIdx(array $secciones, string $nombre): ?int
    {
        foreach ($secciones as $i => $s) {
            if (($s['nombre'] ?? null) === $nombre) {
                return $i;
            }
        }

        return null;
    }
}
