SET search_path TO banco_core, banco_audit, public;
CREATE INDEX IF NOT EXISTS idx_cuenta_numero ON
banco_core.cuenta(numero_cuenta);
CREATE INDEX IF NOT EXISTS idx_cuenta_titular_cliente ON
banco_core.cuenta_titular(id_cliente);
CREATE INDEX IF NOT EXISTS idx_cuenta_titular_activo ON
banco_core.cuenta_titular(id_cuenta, id_cliente) WHERE activo IS
TRUE;
CREATE INDEX IF NOT EXISTS idx_transaccion_cuenta_origen ON
banco_core.transaccion(id_cuenta_origen, fecha_transaccion DESC);
CREATE INDEX IF NOT EXISTS idx_transaccion_cuenta_destino ON
banco_core.transaccion(id_cuenta_destino, fecha_transaccion DESC);
CREATE INDEX IF NOT EXISTS idx_transaccion_idempotency ON
banco_core.transaccion(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_asiento_transaccion ON
banco_core.asiento_contable(id_transaccion);
CREATE INDEX IF NOT EXISTS idx_persona_natural_doc ON
banco_core.persona_natural(id_tipo_documento, numero_documento);
CREATE INDEX IF NOT EXISTS idx_auditoria_tabla_fecha ON
banco_audit.auditoria_operacion(nombre_tabla, fecha_hora DESC);