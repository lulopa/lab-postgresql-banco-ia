SET search_path TO banco_core, banco_security, public;
CREATE TABLE IF NOT EXISTS banco_core.transaccion (
 id_transaccion BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 idempotency_key UUID NOT NULL UNIQUE,
 id_cuenta_origen BIGINT REFERENCES banco_core.cuenta(id_cuenta),
 id_cuenta_destino BIGINT REFERENCES
banco_core.cuenta(id_cuenta),
 id_tipo_transaccion INT NOT NULL REFERENCES
banco_core.tipo_transaccion(id_tipo_transaccion),
 id_estado_transaccion INT NOT NULL REFERENCES
banco_core.estado_transaccion(id_estado_transaccion),
 monto NUMERIC(18,2) NOT NULL CHECK (monto > 0.00),
 moneda VARCHAR(3) NOT NULL DEFAULT 'COP',
 fecha_transaccion TIMESTAMPTZ NOT NULL DEFAULT
CURRENT_TIMESTAMP,
 id_usuario_operador INT REFERENCES
banco_security.usuario_interno(id_usuario),
 CONSTRAINT chk_cuentas_distintas CHECK (id_cuenta_origen IS
DISTINCT FROM id_cuenta_destino),
 CONSTRAINT chk_al_menos_una_cuenta CHECK (id_cuenta_origen IS
NOT NULL OR id_cuenta_destino IS NOT NULL)
);
COMMENT ON TABLE banco_core.transaccion IS 'Registro central de
transacciones financieras con clave de idempotencia';