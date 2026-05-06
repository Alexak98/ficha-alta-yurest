<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Integraciones sin avance</title></head>
<body style="font-family: Arial, sans-serif; color: #222; max-width: 720px; margin: 0 auto;">
    <h2>Integraciones sin avance — grupo {{ $grupo->nombre }}</h2>
    <p>Las siguientes tareas en Asana llevan más de {{ count($tareas) > 0 ? 'el umbral configurado' : 'X' }} sin actividad:</p>
    <table cellpadding="6" cellspacing="0" border="1" style="border-collapse: collapse; width: 100%;">
        <thead>
            <tr style="background:#f3f3f3">
                <th align="left">Tarea</th>
                <th align="left">Sección</th>
                <th align="left">Asignado</th>
                <th align="left">Última modificación</th>
            </tr>
        </thead>
        <tbody>
            @foreach ($tareas as $t)
                <tr>
                    <td>{{ $t['name'] ?? '—' }}</td>
                    <td>{{ $t['_seccion'] ?? '—' }}</td>
                    <td>{{ $t['assignee']['name'] ?? '—' }}</td>
                    <td>{{ $t['modified_at'] ?? $t['created_at'] ?? '—' }}</td>
                </tr>
            @endforeach
        </tbody>
    </table>
    <p style="font-size: 12px; color: #666; margin-top: 24px;">
        Generado automáticamente por Yurest. Para ajustar grupos o umbral,
        ve al panel <strong>Integraciones → Avisos automáticos</strong>.
    </p>
</body>
</html>
