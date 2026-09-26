SET search_path TO banco_audit, banco_security, public;
CREATE TABLE IF NOT EXISTS banco_audit.auditoria_operacion (
 id_auditoria BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 nombre_tabla VARCHAR(50) NOT NULL,
 operacion VARCHAR(10) NOT NULL CHECK (operacion IN ('INSERT',
'UPDATE', 'DELETE')),
 id_registro BIGINT NOT NULL,
 id_usuario_interno INT REFERENCES
banco_security.usuario_interno(id_usuario),
 fecha_hora TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 datos_anteriores JSONB,
 datos_nuevos JSONB
);
COMMENT ON TABLE banco_audit.auditoria_operacion IS 'Log inmutable
de auditoría para cambios en entidades críticas';
