<?php

use App\Models\FichaAlta;
use App\Models\User;

beforeEach(function () {
    $this->admin = User::factory()->admin()->create();
});

it('crea ficha enviando body en shape legacy del frontend (keys español)', function () {
    $payload = [
        // Subset real del shape que envía index.html línea 2695+
        'Comercial' => 'Ana Pérez',
        'Nombre Sociedad' => 'Restaurantes Mediterráneo SL',
        'Nombre Comercial' => 'Mediterráneo',
        'Calle' => 'Gran Vía',
        'Número' => '42',
        'CP' => '28013',
        'Municipio' => 'Madrid',
        'Provincia' => 'Madrid',
        'CIF/NIF' => 'B12345678',
        'Email' => 'info@mediterraneo.com',
        'Email Factura' => 'factura@mediterraneo.com',
        'Tipo Cliente' => 'corporate',
        'Firmas Contratadas' => '100',
        'JP Nombre' => 'Pedro',
        'JP Apellidos' => 'García',
        'JP Mail' => 'pedro@mediterraneo.com',
        'Firmante Nombre' => 'María',
        'Firmante Apellidos' => 'López',
        'Firmante Mail' => 'maria@mediterraneo.com',
        'Firmante DNI' => '12345678Z',
        'TPV' => 'Glop',
        'TPV No Integrado' => '',
        'Lite' => '',
        'Distribuidor' => 'Sí',
        'Dist. Empresa' => 'Distribuidor SL',
        'Dist. Comisión Implementación (%)' => 5.5,
        'ImporteSetup' => 1500,
        'Descuentosetup' => 100,
        'Mensualidad Total Locales' => 350.50,
        'Mensualidad Anualizada' => 4206,
        'Proyecto de Implementación' => 800,
        'Plan Producto BASIC' => 99,
        'Plan Producto PRO' => 199,
        'Integracion Financiera' => 'sage',
        'Int Fin Persona' => 'Contable',
        'Int Fin Email' => 'contable@mediterraneo.com',
        'Comentarios' => 'Cliente prioritario',
        'Estado' => 'Rellenado',
        'Baja' => 'No',
        'Módulos' => ['planes', 'rrhh'],
        'paquetes_carrito' => [['id' => 'plan_pro', 'precio' => 199]],
        'locales' => [],
    ];

    $res = $this->actingAs($this->admin, 'sanctum')
        ->postJson('/api/fichas', $payload);

    $res->assertCreated()
        ->assertJsonPath('data.denominacion', 'Restaurantes Mediterráneo SL')
        ->assertJsonPath('data.cif', 'B12345678')
        ->assertJsonPath('data.tipo_cliente', 'corporate')
        ->assertJsonPath('data.distribuidor', true)
        ->assertJsonPath('data.dist_comision', '5.50')
        ->assertJsonPath('data.importe_setup', '1500.00')
        ->assertJsonPath('data.mensualidad_total', '350.50')
        ->assertJsonPath('data.mensualidad_total_locales', '350.50')
        ->assertJsonPath('data.fin_basic', '99.00')
        ->assertJsonPath('data.fin_pro', '199.00')
        ->assertJsonPath('data.integracion_financiera', 'sage')
        ->assertJsonPath('data.int_fin_persona', 'Contable')
        ->assertJsonPath('data.modulos', ['planes', 'rrhh']);

    // El response también incluye los aliases legacy para que las pages que
    // leen con keys capitalizadas sigan funcionando sin tocar el frontend.
    $res->assertJsonPath('data.Nombre Sociedad', 'Restaurantes Mediterráneo SL')
        ->assertJsonPath('data.CIF/NIF', 'B12345678')
        ->assertJsonPath('data.Distribuidor', 'Sí')
        ->assertJsonPath('data.Lite', '');
});

it('acepta también shape moderno snake_case (no rompe lo que ya funciona)', function () {
    $res = $this->actingAs($this->admin, 'sanctum')
        ->postJson('/api/fichas', [
            'denominacion' => 'Pizzería Norte',
            'cif' => 'B98765432',
            'tipo_cliente' => 'lite',
            'lite' => true,
            'modulos' => ['lite'],
        ]);

    $res->assertCreated()
        ->assertJsonPath('data.denominacion', 'Pizzería Norte')
        ->assertJsonPath('data.lite', true)
        ->assertJsonPath('data.modulos', ['lite']);
});

it('booleans Sí/vacío se convierten a true/false correctamente', function () {
    $res = $this->actingAs($this->admin, 'sanctum')
        ->postJson('/api/fichas', [
            'Nombre Sociedad' => 'X',
            'Lite' => 'Sí',
            'TPV No Integrado' => '',
            'Distribuidor' => 'Sí',
        ]);

    $res->assertCreated()
        ->assertJsonPath('data.lite', true)
        ->assertJsonPath('data.tpv_no_integrado', false)
        ->assertJsonPath('data.distribuidor', true);
});

it('Mensualidad Total Locales setea ambos campos a la vez', function () {
    $res = $this->actingAs($this->admin, 'sanctum')
        ->postJson('/api/fichas', [
            'Nombre Sociedad' => 'X',
            'Mensualidad Total Locales' => 250.75,
        ]);

    $res->assertCreated()
        ->assertJsonPath('data.mensualidad_total', '250.75')
        ->assertJsonPath('data.mensualidad_total_locales', '250.75');
});

it('tipo_cliente vacío se normaliza a null (CHECK Postgres rechaza "")', function () {
    $res = $this->actingAs($this->admin, 'sanctum')
        ->postJson('/api/fichas', [
            'Nombre Sociedad' => 'X',
            'Tipo Cliente' => '',
        ]);

    $res->assertCreated()
        ->assertJsonPath('data.tipo_cliente', null);
});

it('rechaza Integración Financiera fuera del CHECK', function () {
    $this->actingAs($this->admin, 'sanctum')
        ->postJson('/api/fichas', [
            'Nombre Sociedad' => 'X',
            'Integracion Financiera' => 'inventado',
        ])
        ->assertStatus(422);
});

it('lectura: los aliases legacy aparecen en GET /fichas', function () {
    FichaAlta::factory()->create([
        'denominacion' => 'Test SL',
        'cif' => 'B99999999',
        'comercial' => 'Beatriz',
        'implementador' => 'Carlos',
    ]);

    $res = $this->actingAs($this->admin, 'sanctum')->getJson('/api/fichas');

    expect($res->json('data.0.Nombre Sociedad'))->toBe('Test SL')
        ->and($res->json('data.0.CIF/NIF'))->toBe('B99999999')
        ->and($res->json('data.0.Comercial'))->toBe('Beatriz')
        ->and($res->json('data.0.Implementador'))->toBe('Carlos');
});
