
SET search_path TO banco_core, banco_audit, public;

@delimiter /;

-- 1. Trigger de inmutabilidad para transacciones financieras (POSTED)
CREATE OR REPLACE FUNCTION banco_core.fn_trg_inmutabilidad_transaccion()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF OLD.id_estado_transaccion = 2 AND TG_OP IN ('UPDATE', 'DELETE') THEN
        IF TG_OP = 'UPDATE' AND NEW.id_estado_transaccion = 4 THEN
            RETURN NEW;
        END IF;
        RAISE EXCEPTION 'VIOLACIÓN DE INMUTABILIDAD: Transacciones en estado POSTED no pueden ser modificadas ni eliminadas (ID: %)', OLD.id_transaccion;
    END IF;
    RETURN NEW;
END;
$$;
/

CREATE OR REPLACE TRIGGER trg_inmutabilidad_transaccion
BEFORE UPDATE OR DELETE ON banco_core.transaccion
FOR EACH ROW EXECUTE FUNCTION banco_core.fn_trg_inmutabilidad_transaccion();
/

-- 2. Trigger de inmutabilidad para el ledger de asientos contables
CREATE OR REPLACE FUNCTION banco_core.fn_trg_inmutabilidad_asiento()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'VIOLACIÓN DE INMUTABILIDAD: El ledger de asientos contables es estrictamente de solo inserción (ID Asiento: %)', OLD.id_asiento;
END;
$$;
/

CREATE OR REPLACE TRIGGER trg_inmutabilidad_asiento
BEFORE UPDATE OR DELETE ON banco_core.asiento_contable
FOR EACH ROW EXECUTE FUNCTION banco_core.fn_trg_inmutabilidad_asiento();
/

-- 3. Trigger de auditoría para cambios en la tabla de clientes
CREATE OR REPLACE FUNCTION banco_audit.fn_trg_auditoria_operacion()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_id_reg BIGINT;
    v_old JSONB := NULL;
    v_new JSONB := NULL;
BEGIN
    IF TG_OP = 'INSERT' THEN
        v_id_reg := NEW.id_cliente;
        v_new := to_jsonb(NEW);
    ELSIF TG_OP = 'UPDATE' THEN
        v_id_reg := NEW.id_cliente;
        v_old := to_jsonb(OLD);
        v_new := to_jsonb(NEW);
    ELSIF TG_OP = 'DELETE' THEN
        v_id_reg := OLD.id_cliente;
        v_old := to_jsonb(OLD);
    END IF;

    INSERT INTO banco_audit.auditoria_operacion (nombre_tabla, operacion, id_registro, fecha_hora, datos_anteriores, datos_nuevos)
    VALUES (TG_TABLE_NAME, TG_OP, v_id_reg, CURRENT_TIMESTAMP, v_old, v_new);

    RETURN NULL;
END;
$$;
/

CREATE OR REPLACE TRIGGER trg_audit_cliente
AFTER INSERT OR UPDATE OR DELETE ON banco_core.cliente
FOR EACH ROW EXECUTE FUNCTION banco_audit.fn_trg_auditoria_operacion();
/

@delimiter ;/