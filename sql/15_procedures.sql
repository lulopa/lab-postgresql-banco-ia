
SET search_path TO banco_core, banco_security, public;

@delimiter /;

-- 1. Crear Cliente
CREATE OR REPLACE PROCEDURE banco_core.sp_crear_cliente(
    IN p_tipo_cliente VARCHAR(10),
    IN p_id_oficina INT,
    IN p_id_tipo_documento INT,
    IN p_numero_documento VARCHAR(20),
    IN p_primer_nombre VARCHAR(50),
    IN p_primer_apellido VARCHAR(50),
    IN p_fecha_nacimiento DATE,
    IN p_nit VARCHAR(20),
    IN p_razon_social VARCHAR(150),
    OUT p_id_cliente BIGINT
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_codigo_cliente VARCHAR(20);
BEGIN
    v_codigo_cliente := 'CLI-' || LPAD((FLOOR(RANDOM() * 899999999) + 100000000)::TEXT, 10, '0');
    
    INSERT INTO banco_core.cliente (codigo_cliente, tipo_cliente, id_oficina_vinculacion, id_estado_cliente)
    VALUES (v_codigo_cliente, p_tipo_cliente, p_id_oficina, 2)
    RETURNING id_cliente INTO p_id_cliente;

    IF p_tipo_cliente = 'NATURAL' THEN
        INSERT INTO banco_core.persona_natural (id_cliente, id_tipo_documento, numero_documento, primer_nombre, primer_apellido, fecha_nacimiento)
        VALUES (p_id_cliente, p_id_tipo_documento, p_numero_documento, p_primer_nombre, p_primer_apellido, p_fecha_nacimiento);
    ELSIF p_tipo_cliente = 'JURIDICA' THEN
        INSERT INTO banco_core.persona_juridica (id_cliente, nit, razon_social)
        VALUES (p_id_cliente, p_nit, p_razon_social);
    ELSE
        RAISE EXCEPTION 'Tipo de cliente no válido: %', p_tipo_cliente;
    END IF;
END;
$$;
/

-- 2. Crear Cuenta
CREATE OR REPLACE PROCEDURE banco_core.sp_crear_cuenta(
    IN p_id_cliente BIGINT,
    IN p_id_producto INT,
    IN p_id_oficina INT,
    IN p_usuario_operador INT,
    OUT p_id_cuenta BIGINT,
    OUT p_numero_cuenta VARCHAR(20)
)
LANGUAGE plpgsql
AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM banco_core.cliente WHERE id_cliente = p_id_cliente AND id_estado_cliente = 2) THEN
        RAISE EXCEPTION 'Cliente % inexistente o no está en estado ACTIVO', p_id_cliente;
    END IF;

    p_numero_cuenta := banco_core.fn_generar_numero_cuenta(p_id_oficina, p_id_producto);

    INSERT INTO banco_core.cuenta (numero_cuenta, id_producto, id_oficina_apertura, id_estado_cuenta, saldo_disponible)
    VALUES (p_numero_cuenta, p_id_producto, p_id_oficina, 1, 0.00)
    RETURNING id_cuenta INTO p_id_cuenta;

    INSERT INTO banco_core.cuenta_titular (id_cuenta, id_cliente, tipo_titularidad, porcentaje_participacion)
    VALUES (p_id_cuenta, p_id_cliente, 'PRINCIPAL', 100.00);

    INSERT INTO banco_core.evento_cuenta (id_cuenta, id_tipo_evento, id_usuario_interno, motivo, id_estado_anterior, id_estado_nuevo)
    VALUES (p_id_cuenta, 1, p_usuario_operador, 'Apertura inicial de cuenta', NULL, 1);
END;
$$;
/

-- 3. Activar Cuenta
CREATE OR REPLACE PROCEDURE banco_core.sp_activar_cuenta(
    IN p_id_cuenta BIGINT,
    IN p_usuario_operador INT,
    IN p_motivo TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_estado_actual INT;
BEGIN
    SELECT id_estado_cuenta INTO v_estado_actual FROM banco_core.cuenta WHERE id_cuenta = p_id_cuenta FOR UPDATE;
    IF v_estado_actual != 1 THEN
        RAISE EXCEPTION 'Solo se pueden activar cuentas en estado PENDIENTE_ACTIVACION';
    END IF;

    UPDATE banco_core.cuenta SET id_estado_cuenta = 2 WHERE id_cuenta = p_id_cuenta;

    INSERT INTO banco_core.evento_cuenta (id_cuenta, id_tipo_evento, id_usuario_interno, motivo, id_estado_anterior, id_estado_nuevo)
    VALUES (p_id_cuenta, 2, p_usuario_operador, p_motivo, v_estado_actual, 2);
END;
$$;
/

-- 4. Bloquear Cuenta
CREATE OR REPLACE PROCEDURE banco_core.sp_bloquear_cuenta(
    IN p_id_cuenta BIGINT,
    IN p_tipo_bloqueo VARCHAR(20),
    IN p_usuario_operador INT,
    IN p_motivo TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_estado_actual INT;
    v_nuevo_estado INT;
BEGIN
    SELECT id_estado_cuenta INTO v_estado_actual FROM banco_core.cuenta WHERE id_cuenta = p_id_cuenta FOR UPDATE;
    
    IF p_tipo_bloqueo = 'PARCIAL' THEN v_nuevo_estado := 3;
    ELSIF p_tipo_bloqueo = 'TOTAL' THEN v_nuevo_estado := 4;
    ELSE RAISE EXCEPTION 'Tipo de bloqueo no válido: %', p_tipo_bloqueo;
    END IF;

    UPDATE banco_core.cuenta SET id_estado_cuenta = v_nuevo_estado WHERE id_cuenta = p_id_cuenta;

    INSERT INTO banco_core.evento_cuenta (id_cuenta, id_tipo_evento, id_usuario_interno, motivo, id_estado_anterior, id_estado_nuevo)
    VALUES (p_id_cuenta, CASE WHEN p_tipo_bloqueo='PARCIAL' THEN 3 ELSE 4 END, p_usuario_operador, p_motivo, v_estado_actual, v_nuevo_estado);
END;
$$;
/

-- 5. Desbloquear Cuenta
CREATE OR REPLACE PROCEDURE banco_core.sp_desbloquear_cuenta(
    IN p_id_cuenta BIGINT,
    IN p_usuario_operador INT,
    IN p_motivo TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_estado_actual INT;
BEGIN
    SELECT id_estado_cuenta INTO v_estado_actual FROM banco_core.cuenta WHERE id_cuenta = p_id_cuenta FOR UPDATE;
    IF v_estado_actual NOT IN (3, 4) THEN
        RAISE EXCEPTION 'La cuenta no se encuentra en estado bloqueado';
    END IF;

    UPDATE banco_core.cuenta SET id_estado_cuenta = 2 WHERE id_cuenta = p_id_cuenta;

    INSERT INTO banco_core.evento_cuenta (id_cuenta, id_tipo_evento, id_usuario_interno, motivo, id_estado_anterior, id_estado_nuevo)
    VALUES (p_id_cuenta, 5, p_usuario_operador, p_motivo, v_estado_actual, 2);
END;
$$;
/

-- 6. Consignar
CREATE OR REPLACE PROCEDURE banco_core.sp_consignar(
    IN p_idempotency_key UUID,
    IN p_id_cuenta_destino BIGINT,
    IN p_monto NUMERIC(18,2),
    IN p_usuario_operador INT,
    OUT p_id_transaccion BIGINT
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_estado_cuenta INT;
    v_puc_cuenta VARCHAR(20);
    v_tipo_prod INT;
BEGIN
    IF EXISTS (SELECT 1 FROM banco_core.transaccion WHERE idempotency_key = p_idempotency_key) THEN
        SELECT id_transaccion INTO p_id_transaccion FROM banco_core.transaccion WHERE idempotency_key = p_idempotency_key;
        RETURN;
    END IF;

    SELECT id_estado_cuenta, id_producto INTO v_estado_cuenta, v_tipo_prod 
    FROM banco_core.cuenta WHERE id_cuenta = p_id_cuenta_destino FOR UPDATE;

    IF v_estado_cuenta IN (4, 6) THEN
        RAISE EXCEPTION 'La cuenta destino % no puede recibir consignaciones', p_id_cuenta_destino;
    END IF;

    INSERT INTO banco_core.transaccion (idempotency_key, id_cuenta_destino, id_tipo_transaccion, id_estado_transaccion, monto, id_usuario_operador)
    VALUES (p_idempotency_key, p_id_cuenta_destino, 1, 2, p_monto, p_usuario_operador)
    RETURNING id_transaccion INTO p_id_transaccion;

    v_puc_cuenta := CASE WHEN v_tipo_prod = 2 THEN '210510' ELSE '210505' END;

    INSERT INTO banco_core.asiento_contable (id_transaccion, num_linea, codigo_cuenta_puc, tipo_movimiento, monto)
    VALUES 
    (p_id_transaccion, 1, '110505', 'DEBITO', p_monto),
    (p_id_transaccion, 2, v_puc_cuenta, 'CREDITO', p_monto);

    UPDATE banco_core.cuenta SET saldo_disponible = saldo_disponible + p_monto WHERE id_cuenta = p_id_cuenta_destino;
END;
$$;
/

-- 7. Retirar
CREATE OR REPLACE PROCEDURE banco_core.sp_retirar(
    IN p_idempotency_key UUID,
    IN p_id_cuenta_origen BIGINT,
    IN p_monto NUMERIC(18,2),
    IN p_usuario_operador INT,
    OUT p_id_transaccion BIGINT
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_estado_cuenta INT;
    v_saldo NUMERIC(18,2);
    v_sobregiro NUMERIC(18,2);
    v_puc_cuenta VARCHAR(20);
    v_tipo_prod INT;
BEGIN
    IF EXISTS (SELECT 1 FROM banco_core.transaccion WHERE idempotency_key = p_idempotency_key) THEN
        SELECT id_transaccion INTO p_id_transaccion FROM banco_core.transaccion WHERE idempotency_key = p_idempotency_key;
        RETURN;
    END IF;

    SELECT id_estado_cuenta, saldo_disponible, limite_sobregiro, id_producto 
    INTO v_estado_cuenta, v_saldo, v_sobregiro, v_tipo_prod
    FROM banco_core.cuenta WHERE id_cuenta = p_id_cuenta_origen FOR UPDATE;

    IF v_estado_cuenta != 2 THEN
        RAISE EXCEPTION 'La cuenta % no está activa para retiros', p_id_cuenta_origen;
    END IF;

    IF (v_saldo - p_monto) < (-v_sobregiro) THEN
        RAISE EXCEPTION 'Saldo insuficiente en cuenta % (Saldo: %, Sobregiro: %)', p_id_cuenta_origen, v_saldo, v_sobregiro;
    END IF;

    INSERT INTO banco_core.transaccion (idempotency_key, id_cuenta_origen, id_tipo_transaccion, id_estado_transaccion, monto, id_usuario_operador)
    VALUES (p_idempotency_key, p_id_cuenta_origen, 2, 2, p_monto, p_usuario_operador)
    RETURNING id_transaccion INTO p_id_transaccion;

    v_puc_cuenta := CASE WHEN v_tipo_prod = 2 THEN '210510' ELSE '210505' END;

    INSERT INTO banco_core.asiento_contable (id_transaccion, num_linea, codigo_cuenta_puc, tipo_movimiento, monto)
    VALUES 
    (p_id_transaccion, 1, v_puc_cuenta, 'DEBITO', p_monto),
    (p_id_transaccion, 2, '110505', 'CREDITO', p_monto);

    UPDATE banco_core.cuenta SET saldo_disponible = saldo_disponible - p_monto WHERE id_cuenta = p_id_cuenta_origen;
END;
$$;
/

-- 8. Transferir
CREATE OR REPLACE PROCEDURE banco_core.sp_transferir(
    IN p_idempotency_key UUID,
    IN p_id_cuenta_origen BIGINT,
    IN p_id_cuenta_destino BIGINT,
    IN p_monto NUMERIC(18,2),
    IN p_usuario_operador INT,
    OUT p_id_transaccion BIGINT
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_saldo_orig NUMERIC(18,2);
    v_sobregiro_orig NUMERIC(18,2);
    v_est_orig INT;
    v_est_dest INT;
    v_puc_orig VARCHAR(20);
    v_puc_dest VARCHAR(20);
    v_prod_orig INT;
    v_prod_dest INT;
BEGIN
    IF p_id_cuenta_origen = p_id_cuenta_destino THEN
        RAISE EXCEPTION 'Cuenta de origen y destino no pueden ser iguales';
    END IF;

    IF EXISTS (SELECT 1 FROM banco_core.transaccion WHERE idempotency_key = p_idempotency_key) THEN
        SELECT id_transaccion INTO p_id_transaccion FROM banco_core.transaccion WHERE idempotency_key = p_idempotency_key;
        RETURN;
    END IF;

    IF p_id_cuenta_origen < p_id_cuenta_destino THEN
        SELECT id_estado_cuenta, saldo_disponible, limite_sobregiro, id_producto INTO v_est_orig, v_saldo_orig, v_sobregiro_orig, v_prod_orig FROM banco_core.cuenta WHERE id_cuenta = p_id_cuenta_origen FOR UPDATE;
        SELECT id_estado_cuenta, id_producto INTO v_est_dest, v_prod_dest FROM banco_core.cuenta WHERE id_cuenta = p_id_cuenta_destino FOR UPDATE;
    ELSE
        SELECT id_estado_cuenta, id_producto INTO v_est_dest, v_prod_dest FROM banco_core.cuenta WHERE id_cuenta = p_id_cuenta_destino FOR UPDATE;
        SELECT id_estado_cuenta, saldo_disponible, limite_sobregiro, id_producto INTO v_est_orig, v_saldo_orig, v_sobregiro_orig, v_prod_orig FROM banco_core.cuenta WHERE id_cuenta = p_id_cuenta_origen FOR UPDATE;
    END IF;

    IF v_est_orig != 2 THEN RAISE EXCEPTION 'Cuenta de origen % inactiva', p_id_cuenta_origen; END IF;
    IF v_est_dest IN (4, 6) THEN RAISE EXCEPTION 'Cuenta destino % bloqueada o cerrada', p_id_cuenta_destino; END IF;

    IF (v_saldo_orig - p_monto) < (-v_sobregiro_orig) THEN
        RAISE EXCEPTION 'Saldo insuficiente para transferencia en cuenta origen %', p_id_cuenta_origen;
    END IF;

    INSERT INTO banco_core.transaccion (idempotency_key, id_cuenta_origen, id_cuenta_destino, id_tipo_transaccion, id_estado_transaccion, monto, id_usuario_operador)
    VALUES (p_idempotency_key, p_id_cuenta_origen, p_id_cuenta_destino, 3, 2, p_monto, p_usuario_operador)
    RETURNING id_transaccion INTO p_id_transaccion;

    v_puc_orig := CASE WHEN v_prod_orig = 2 THEN '210510' ELSE '210505' END;
    v_puc_dest := CASE WHEN v_prod_dest = 2 THEN '210510' ELSE '210505' END;

    INSERT INTO banco_core.asiento_contable (id_transaccion, num_linea, codigo_cuenta_puc, tipo_movimiento, monto)
    VALUES 
    (p_id_transaccion, 1, v_puc_orig, 'DEBITO', p_monto),
    (p_id_transaccion, 2, v_puc_dest, 'CREDITO', p_monto);

    UPDATE banco_core.cuenta SET saldo_disponible = saldo_disponible - p_monto WHERE id_cuenta = p_id_cuenta_origen;
    UPDATE banco_core.cuenta SET saldo_disponible = saldo_disponible + p_monto WHERE id_cuenta = p_id_cuenta_destino;
END;
$$;
/

-- 9. Reversar Transacción
CREATE OR REPLACE PROCEDURE banco_core.sp_reversar_transaccion(
    IN p_id_transaccion_original BIGINT,
    IN p_usuario_operador INT,
    IN p_motivo TEXT,
    OUT p_id_transaccion_reverso BIGINT
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_tx_orig RECORD;
    v_new_key UUID;
BEGIN
    SELECT * INTO v_tx_orig FROM banco_core.transaccion WHERE id_transaccion = p_id_transaccion_original FOR UPDATE;
    IF v_tx_orig.id_estado_transaccion != 2 THEN
        RAISE EXCEPTION 'Solo se pueden reversar transacciones en estado POSTED';
    END IF;

    v_new_key := uuid_generate_v4();

    INSERT INTO banco_core.transaccion (idempotency_key, id_cuenta_origen, id_cuenta_destino, id_tipo_transaccion, id_estado_transaccion, monto, id_usuario_operador)
    VALUES (v_new_key, v_tx_orig.id_cuenta_destino, v_tx_orig.id_cuenta_origen, 6, 2, v_tx_orig.monto, p_usuario_operador)
    RETURNING id_transaccion INTO p_id_transaccion_reverso;

    INSERT INTO banco_core.asiento_contable (id_transaccion, num_linea, codigo_cuenta_puc, tipo_movimiento, monto)
    SELECT p_id_transaccion_reverso, num_linea, codigo_cuenta_puc,
           CASE WHEN tipo_movimiento = 'DEBITO' THEN 'CREDITO' ELSE 'DEBITO' END, monto
    FROM banco_core.asiento_contable WHERE id_transaccion = p_id_transaccion_original;

    IF v_tx_orig.id_cuenta_origen IS NOT NULL THEN
        UPDATE banco_core.cuenta SET saldo_disponible = saldo_disponible + v_tx_orig.monto WHERE id_cuenta = v_tx_orig.id_cuenta_origen;
    END IF;
    IF v_tx_orig.id_cuenta_destino IS NOT NULL THEN
        UPDATE banco_core.cuenta SET saldo_disponible = saldo_disponible - v_tx_orig.monto WHERE id_cuenta = v_tx_orig.id_cuenta_destino;
    END IF;

    UPDATE banco_core.transaccion SET id_estado_transaccion = 4 WHERE id_transaccion = p_id_transaccion_original;
END;
$$;
/

-- 10. Cerrar Cuenta
CREATE OR REPLACE PROCEDURE banco_core.sp_cerrar_cuenta(
    IN p_id_cuenta BIGINT,
    IN p_usuario_operador INT,
    IN p_motivo TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_saldo NUMERIC(18,2);
    v_canje NUMERIC(18,2);
    v_est_actual INT;
BEGIN
    SELECT saldo_disponible, saldo_canje, id_estado_cuenta INTO v_saldo, v_canje, v_est_actual
    FROM banco_core.cuenta WHERE id_cuenta = p_id_cuenta FOR UPDATE;

    IF v_saldo != 0.00 OR v_canje != 0.00 THEN
        RAISE EXCEPTION 'No se puede cerrar una cuenta con saldo disponible (%) o canje (%) diferente de cero', v_saldo, v_canje;
    END IF;

    UPDATE banco_core.cuenta 
    SET id_estado_cuenta = 6, fecha_cierre = CURRENT_TIMESTAMP
    WHERE id_cuenta = p_id_cuenta;

    INSERT INTO banco_core.evento_cuenta (id_cuenta, id_tipo_evento, id_usuario_interno, motivo, id_estado_anterior, id_estado_nuevo)
    VALUES (p_id_cuenta, 7, p_usuario_operador, p_motivo, v_est_actual, 6);
END;
$$;
/

@delimiter ;/