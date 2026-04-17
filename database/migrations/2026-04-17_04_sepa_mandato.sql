-- ─────────────────────────────────────────────────────────────────────────
-- Mandato SEPA: orden de domiciliación firmada por el cliente al rellenar
-- la solicitud. Se persiste como JSONB con todos los datos legales del
-- acreedor, los datos del deudor, IBAN/BIC, tipo de pago, fecha/localidad
-- de firma y la firma manuscrita en base64 (PNG).
-- Idempotente: re-ejecutable sin efectos secundarios.
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE fichas_alta
    ADD COLUMN IF NOT EXISTS sepa_mandato JSONB;

COMMENT ON COLUMN fichas_alta.sepa_mandato IS
    'Orden de domiciliación SEPA firmada por el cliente. Estructura: '
    '{ referencia, acreedor:{...}, deudor:{...}, swift, iban, tipo_pago, '
    'fecha_firma, localidad, firma_base64, firmado_at }.';
