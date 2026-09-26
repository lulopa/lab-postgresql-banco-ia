--
-- PostgreSQL database dump
--

\restrict 6DzTlZ2u7UCghuJVI8EaDX32LKRxvYsaYlxiKYxQYnC2AzfBcoD3cZrqL2mQxgD

-- Dumped from database version 18.6
-- Dumped by pg_dump version 18.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: banco_audit; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA banco_audit;


ALTER SCHEMA banco_audit OWNER TO postgres;

--
-- Name: SCHEMA banco_audit; Type: COMMENT; Schema: -; Owner: postgres
--

COMMENT ON SCHEMA banco_audit IS 'Esquema aislado para tablas y logs de auditoría inmutable';


--
-- Name: banco_core; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA banco_core;


ALTER SCHEMA banco_core OWNER TO postgres;

--
-- Name: SCHEMA banco_core; Type: COMMENT; Schema: -; Owner: postgres
--

COMMENT ON SCHEMA banco_core IS 'Esquema principal con el modelo transaccional OLTP, geografía, clientes, cuentas y ledger';


--
-- Name: banco_security; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA banco_security;


ALTER SCHEMA banco_security OWNER TO postgres;

--
-- Name: SCHEMA banco_security; Type: COMMENT; Schema: -; Owner: postgres
--

COMMENT ON SCHEMA banco_security IS 'Esquema para la gestión RBAC de usuarios internos, roles y permisos';


--
-- Name: banco_seguridad; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA banco_seguridad;


ALTER SCHEMA banco_seguridad OWNER TO postgres;

--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pgcrypto IS 'Funciones criptográficas y hashing de seguridad';


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION "uuid-ossp" IS 'Generación de UUIDs v4 para idempotency keys y referencias externas';


--
-- Name: fn_trg_auditoria_operacion(); Type: FUNCTION; Schema: banco_audit; Owner: postgres
--

CREATE FUNCTION banco_audit.fn_trg_auditoria_operacion() RETURNS trigger
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


ALTER FUNCTION banco_audit.fn_trg_auditoria_operacion() OWNER TO postgres;

--
-- Name: fn_generar_numero_cuenta(integer, integer); Type: FUNCTION; Schema: banco_core; Owner: postgres
--

CREATE FUNCTION banco_core.fn_generar_numero_cuenta(p_id_oficina integer, p_id_producto integer) RETURNS character varying
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_cod_oficina VARCHAR(10);
    v_cod_producto VARCHAR(10);
    v_secuencial BIGINT;
    v_numero_cuenta VARCHAR(20);
BEGIN
    SELECT codigo_oficina INTO v_cod_oficina FROM banco_core.oficina WHERE id_oficina = p_id_oficina;
    SELECT codigo_producto INTO v_cod_producto FROM banco_core.producto WHERE id_producto = p_id_producto;
    
    SELECT COALESCE(MAX(id_cuenta), 0) + 1 INTO v_secuencial FROM banco_core.cuenta;
    
    v_numero_cuenta := LPAD(p_id_oficina::TEXT, 3, '0') || '-' || LPAD(p_id_producto::TEXT, 2, '0') || '-' || LPAD(v_secuencial::TEXT, 10, '0');
    RETURN v_numero_cuenta;
END;
$$;


ALTER FUNCTION banco_core.fn_generar_numero_cuenta(p_id_oficina integer, p_id_producto integer) OWNER TO postgres;

--
-- Name: fn_trg_inmutabilidad_asiento(); Type: FUNCTION; Schema: banco_core; Owner: postgres
--

CREATE FUNCTION banco_core.fn_trg_inmutabilidad_asiento() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    RAISE EXCEPTION 'VIOLACIÓN DE INMUTABILIDAD: El ledger de asientos contables es estrictamente de solo inserción (ID Asiento: %)', OLD.id_asiento;
END;
$$;


ALTER FUNCTION banco_core.fn_trg_inmutabilidad_asiento() OWNER TO postgres;

--
-- Name: fn_trg_inmutabilidad_transaccion(); Type: FUNCTION; Schema: banco_core; Owner: postgres
--

CREATE FUNCTION banco_core.fn_trg_inmutabilidad_transaccion() RETURNS trigger
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


ALTER FUNCTION banco_core.fn_trg_inmutabilidad_transaccion() OWNER TO postgres;

--
-- Name: fn_validar_doble_partida(bigint); Type: FUNCTION; Schema: banco_core; Owner: postgres
--

CREATE FUNCTION banco_core.fn_validar_doble_partida(p_id_transaccion bigint) RETURNS boolean
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_total_debito NUMERIC(18,2);
    v_total_credito NUMERIC(18,2);
BEGIN
    SELECT 
        COALESCE(SUM(CASE WHEN tipo_movimiento = 'DEBITO' THEN monto ELSE 0 END), 0.00),
        COALESCE(SUM(CASE WHEN tipo_movimiento = 'CREDITO' THEN monto ELSE 0 END), 0.00)
    INTO v_total_debito, v_total_credito
    FROM banco_core.asiento_contable
    WHERE id_transaccion = p_id_transaccion;

    RETURN (v_total_debito = v_total_credito AND v_total_debito > 0.00);
END;
$$;


ALTER FUNCTION banco_core.fn_validar_doble_partida(p_id_transaccion bigint) OWNER TO postgres;

--
-- Name: sp_activar_cuenta(bigint, integer, text); Type: PROCEDURE; Schema: banco_core; Owner: postgres
--

CREATE PROCEDURE banco_core.sp_activar_cuenta(IN p_id_cuenta bigint, IN p_usuario_operador integer, IN p_motivo text)
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


ALTER PROCEDURE banco_core.sp_activar_cuenta(IN p_id_cuenta bigint, IN p_usuario_operador integer, IN p_motivo text) OWNER TO postgres;

--
-- Name: sp_bloquear_cuenta(bigint, character varying, integer, text); Type: PROCEDURE; Schema: banco_core; Owner: postgres
--

CREATE PROCEDURE banco_core.sp_bloquear_cuenta(IN p_id_cuenta bigint, IN p_tipo_bloqueo character varying, IN p_usuario_operador integer, IN p_motivo text)
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


ALTER PROCEDURE banco_core.sp_bloquear_cuenta(IN p_id_cuenta bigint, IN p_tipo_bloqueo character varying, IN p_usuario_operador integer, IN p_motivo text) OWNER TO postgres;

--
-- Name: sp_cerrar_cuenta(bigint, integer, text); Type: PROCEDURE; Schema: banco_core; Owner: postgres
--

CREATE PROCEDURE banco_core.sp_cerrar_cuenta(IN p_id_cuenta bigint, IN p_usuario_operador integer, IN p_motivo text)
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


ALTER PROCEDURE banco_core.sp_cerrar_cuenta(IN p_id_cuenta bigint, IN p_usuario_operador integer, IN p_motivo text) OWNER TO postgres;

--
-- Name: sp_consignar(uuid, bigint, numeric, integer); Type: PROCEDURE; Schema: banco_core; Owner: postgres
--

CREATE PROCEDURE banco_core.sp_consignar(IN p_idempotency_key uuid, IN p_id_cuenta_destino bigint, IN p_monto numeric, IN p_usuario_operador integer, OUT p_id_transaccion bigint)
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


ALTER PROCEDURE banco_core.sp_consignar(IN p_idempotency_key uuid, IN p_id_cuenta_destino bigint, IN p_monto numeric, IN p_usuario_operador integer, OUT p_id_transaccion bigint) OWNER TO postgres;

--
-- Name: sp_crear_cliente(character varying, integer, integer, character varying, character varying, character varying, date, character varying, character varying); Type: PROCEDURE; Schema: banco_core; Owner: postgres
--

CREATE PROCEDURE banco_core.sp_crear_cliente(IN p_tipo_cliente character varying, IN p_id_oficina integer, IN p_id_tipo_documento integer, IN p_numero_documento character varying, IN p_primer_nombre character varying, IN p_primer_apellido character varying, IN p_fecha_nacimiento date, IN p_nit character varying, IN p_razon_social character varying, OUT p_id_cliente bigint)
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


ALTER PROCEDURE banco_core.sp_crear_cliente(IN p_tipo_cliente character varying, IN p_id_oficina integer, IN p_id_tipo_documento integer, IN p_numero_documento character varying, IN p_primer_nombre character varying, IN p_primer_apellido character varying, IN p_fecha_nacimiento date, IN p_nit character varying, IN p_razon_social character varying, OUT p_id_cliente bigint) OWNER TO postgres;

--
-- Name: sp_crear_cuenta(bigint, integer, integer, integer); Type: PROCEDURE; Schema: banco_core; Owner: postgres
--

CREATE PROCEDURE banco_core.sp_crear_cuenta(IN p_id_cliente bigint, IN p_id_producto integer, IN p_id_oficina integer, IN p_usuario_operador integer, OUT p_id_cuenta bigint, OUT p_numero_cuenta character varying)
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


ALTER PROCEDURE banco_core.sp_crear_cuenta(IN p_id_cliente bigint, IN p_id_producto integer, IN p_id_oficina integer, IN p_usuario_operador integer, OUT p_id_cuenta bigint, OUT p_numero_cuenta character varying) OWNER TO postgres;

--
-- Name: sp_desbloquear_cuenta(bigint, integer, text); Type: PROCEDURE; Schema: banco_core; Owner: postgres
--

CREATE PROCEDURE banco_core.sp_desbloquear_cuenta(IN p_id_cuenta bigint, IN p_usuario_operador integer, IN p_motivo text)
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


ALTER PROCEDURE banco_core.sp_desbloquear_cuenta(IN p_id_cuenta bigint, IN p_usuario_operador integer, IN p_motivo text) OWNER TO postgres;

--
-- Name: sp_retirar(uuid, bigint, numeric, integer); Type: PROCEDURE; Schema: banco_core; Owner: postgres
--

CREATE PROCEDURE banco_core.sp_retirar(IN p_idempotency_key uuid, IN p_id_cuenta_origen bigint, IN p_monto numeric, IN p_usuario_operador integer, OUT p_id_transaccion bigint)
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


ALTER PROCEDURE banco_core.sp_retirar(IN p_idempotency_key uuid, IN p_id_cuenta_origen bigint, IN p_monto numeric, IN p_usuario_operador integer, OUT p_id_transaccion bigint) OWNER TO postgres;

--
-- Name: sp_reversar_transaccion(bigint, integer, text); Type: PROCEDURE; Schema: banco_core; Owner: postgres
--

CREATE PROCEDURE banco_core.sp_reversar_transaccion(IN p_id_transaccion_original bigint, IN p_usuario_operador integer, IN p_motivo text, OUT p_id_transaccion_reverso bigint)
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


ALTER PROCEDURE banco_core.sp_reversar_transaccion(IN p_id_transaccion_original bigint, IN p_usuario_operador integer, IN p_motivo text, OUT p_id_transaccion_reverso bigint) OWNER TO postgres;

--
-- Name: sp_transferir(uuid, bigint, bigint, numeric, integer); Type: PROCEDURE; Schema: banco_core; Owner: postgres
--

CREATE PROCEDURE banco_core.sp_transferir(IN p_idempotency_key uuid, IN p_id_cuenta_origen bigint, IN p_id_cuenta_destino bigint, IN p_monto numeric, IN p_usuario_operador integer, OUT p_id_transaccion bigint)
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


ALTER PROCEDURE banco_core.sp_transferir(IN p_idempotency_key uuid, IN p_id_cuenta_origen bigint, IN p_id_cuenta_destino bigint, IN p_monto numeric, IN p_usuario_operador integer, OUT p_id_transaccion bigint) OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: auditoria_operacion; Type: TABLE; Schema: banco_audit; Owner: postgres
--

CREATE TABLE banco_audit.auditoria_operacion (
    id_auditoria bigint NOT NULL,
    nombre_tabla character varying(50) NOT NULL,
    operacion character varying(10) NOT NULL,
    id_registro bigint NOT NULL,
    id_usuario_interno integer,
    fecha_hora timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    datos_anteriores jsonb,
    datos_nuevos jsonb,
    CONSTRAINT auditoria_operacion_operacion_check CHECK (((operacion)::text = ANY ((ARRAY['INSERT'::character varying, 'UPDATE'::character varying, 'DELETE'::character varying])::text[])))
);


ALTER TABLE banco_audit.auditoria_operacion OWNER TO postgres;

--
-- Name: TABLE auditoria_operacion; Type: COMMENT; Schema: banco_audit; Owner: postgres
--

COMMENT ON TABLE banco_audit.auditoria_operacion IS 'Log inmutable
de auditoría para cambios en entidades críticas';


--
-- Name: auditoria_operacion_id_auditoria_seq; Type: SEQUENCE; Schema: banco_audit; Owner: postgres
--

ALTER TABLE banco_audit.auditoria_operacion ALTER COLUMN id_auditoria ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME banco_audit.auditoria_operacion_id_auditoria_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: resultado_quality_gate; Type: TABLE; Schema: banco_audit; Owner: postgres
--

CREATE TABLE banco_audit.resultado_quality_gate (
    test_id character varying(20) NOT NULL,
    categoria character varying(50) NOT NULL,
    regla text NOT NULL,
    tabla character varying(100) NOT NULL,
    esperado character varying(100) NOT NULL,
    obtenido character varying(100) NOT NULL,
    severidad character varying(20),
    estado character varying(10),
    detalle text,
    fecha_ejecucion timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT resultado_quality_gate_estado_check CHECK (((estado)::text = ANY ((ARRAY['PASS'::character varying, 'WARNING'::character varying, 'FAIL'::character varying])::text[]))),
    CONSTRAINT resultado_quality_gate_severidad_check CHECK (((severidad)::text = ANY ((ARRAY['CRITICA'::character varying, 'ALTA'::character varying, 'MEDIA'::character varying, 'BAJA'::character varying])::text[])))
);


ALTER TABLE banco_audit.resultado_quality_gate OWNER TO postgres;

--
-- Name: asiento_contable; Type: TABLE; Schema: banco_core; Owner: postgres
--

CREATE TABLE banco_core.asiento_contable (
    id_asiento bigint NOT NULL,
    id_transaccion bigint NOT NULL,
    num_linea integer NOT NULL,
    codigo_cuenta_puc character varying(20) NOT NULL,
    tipo_movimiento character varying(10) NOT NULL,
    monto numeric(18,2) NOT NULL,
    fecha_contable timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT asiento_contable_monto_check CHECK ((monto > 0.00)),
    CONSTRAINT asiento_contable_tipo_movimiento_check CHECK (((tipo_movimiento)::text = ANY ((ARRAY['DEBITO'::character varying, 'CREDITO'::character varying])::text[])))
);


ALTER TABLE banco_core.asiento_contable OWNER TO postgres;

--
-- Name: asiento_contable_id_asiento_seq; Type: SEQUENCE; Schema: banco_core; Owner: postgres
--

ALTER TABLE banco_core.asiento_contable ALTER COLUMN id_asiento ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME banco_core.asiento_contable_id_asiento_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: cliente; Type: TABLE; Schema: banco_core; Owner: postgres
--

CREATE TABLE banco_core.cliente (
    id_cliente bigint NOT NULL,
    codigo_cliente character varying(20) NOT NULL,
    tipo_cliente character varying(10) NOT NULL,
    id_oficina_vinculacion integer NOT NULL,
    id_estado_cliente integer NOT NULL,
    fecha_vinculacion timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT cliente_tipo_cliente_check CHECK (((tipo_cliente)::text = ANY ((ARRAY['NATURAL'::character varying, 'JURIDICA'::character varying])::text[])))
);


ALTER TABLE banco_core.cliente OWNER TO postgres;

--
-- Name: TABLE cliente; Type: COMMENT; Schema: banco_core; Owner: postgres
--

COMMENT ON TABLE banco_core.cliente IS 'Entidad principal maestra de clientes vinculados';


--
-- Name: cliente_contacto; Type: TABLE; Schema: banco_core; Owner: postgres
--

CREATE TABLE banco_core.cliente_contacto (
    id_contacto bigint NOT NULL,
    id_cliente bigint NOT NULL,
    id_municipio integer NOT NULL,
    direccion_residencia character varying(200) NOT NULL,
    telefono_principal character varying(20) NOT NULL,
    correo_electronico character varying(100) NOT NULL,
    es_principal boolean DEFAULT true NOT NULL
);


ALTER TABLE banco_core.cliente_contacto OWNER TO postgres;

--
-- Name: cliente_contacto_id_contacto_seq; Type: SEQUENCE; Schema: banco_core; Owner: postgres
--

ALTER TABLE banco_core.cliente_contacto ALTER COLUMN id_contacto ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME banco_core.cliente_contacto_id_contacto_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: cliente_id_cliente_seq; Type: SEQUENCE; Schema: banco_core; Owner: postgres
--

ALTER TABLE banco_core.cliente ALTER COLUMN id_cliente ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME banco_core.cliente_id_cliente_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: cuenta; Type: TABLE; Schema: banco_core; Owner: postgres
--

CREATE TABLE banco_core.cuenta (
    id_cuenta bigint NOT NULL,
    numero_cuenta character varying(20) NOT NULL,
    id_producto integer NOT NULL,
    id_oficina_apertura integer NOT NULL,
    id_estado_cuenta integer NOT NULL,
    moneda character varying(3) DEFAULT 'COP'::character varying NOT NULL,
    saldo_disponible numeric(18,2) DEFAULT 0.00 NOT NULL,
    saldo_canje numeric(18,2) DEFAULT 0.00 NOT NULL,
    limite_sobregiro numeric(18,2) DEFAULT 0.00 NOT NULL,
    fecha_apertura timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    fecha_cierre timestamp with time zone,
    CONSTRAINT chk_fechas_cuenta CHECK (((fecha_cierre IS NULL) OR (fecha_cierre >= fecha_apertura))),
    CONSTRAINT chk_saldo_disponible_minimo CHECK ((saldo_disponible >= (- limite_sobregiro))),
    CONSTRAINT cuenta_limite_sobregiro_check CHECK ((limite_sobregiro >= 0.00))
);


ALTER TABLE banco_core.cuenta OWNER TO postgres;

--
-- Name: CONSTRAINT chk_saldo_disponible_minimo ON cuenta; Type: COMMENT; Schema: banco_core; Owner: postgres
--

COMMENT ON CONSTRAINT chk_saldo_disponible_minimo ON banco_core.cuenta IS 'Garantiza que el saldo disponible no supere el límite de
sobregiro autorizado';


--
-- Name: cuenta_id_cuenta_seq; Type: SEQUENCE; Schema: banco_core; Owner: postgres
--

ALTER TABLE banco_core.cuenta ALTER COLUMN id_cuenta ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME banco_core.cuenta_id_cuenta_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: cuenta_titular; Type: TABLE; Schema: banco_core; Owner: postgres
--

CREATE TABLE banco_core.cuenta_titular (
    id_cuenta bigint NOT NULL,
    id_cliente bigint NOT NULL,
    tipo_titularidad character varying(25) NOT NULL,
    porcentaje_participacion numeric(5,2) NOT NULL,
    fecha_vinculacion timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    fecha_desvinculacion timestamp with time zone,
    activo boolean DEFAULT true NOT NULL,
    CONSTRAINT cuenta_titular_porcentaje_participacion_check CHECK (((porcentaje_participacion >= 0.00) AND (porcentaje_participacion <= 100.00))),
    CONSTRAINT cuenta_titular_tipo_titularidad_check CHECK (((tipo_titularidad)::text = ANY ((ARRAY['PRINCIPAL'::character varying, 'COTITULAR_CONJUNTO'::character varying, 'COTITULAR_INDISTINTO'::character varying, 'APODERADO'::character varying])::text[])))
);


ALTER TABLE banco_core.cuenta_titular OWNER TO postgres;

--
-- Name: departamento; Type: TABLE; Schema: banco_core; Owner: postgres
--

CREATE TABLE banco_core.departamento (
    id_departamento integer NOT NULL,
    codigo_dane character varying(5) NOT NULL,
    nombre character varying(100) NOT NULL
);


ALTER TABLE banco_core.departamento OWNER TO postgres;

--
-- Name: TABLE departamento; Type: COMMENT; Schema: banco_core; Owner: postgres
--

COMMENT ON TABLE banco_core.departamento IS 'Catálogo oficial de departamentos según DANE';


--
-- Name: departamento_id_departamento_seq; Type: SEQUENCE; Schema: banco_core; Owner: postgres
--

ALTER TABLE banco_core.departamento ALTER COLUMN id_departamento ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME banco_core.departamento_id_departamento_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: estado_cliente; Type: TABLE; Schema: banco_core; Owner: postgres
--

CREATE TABLE banco_core.estado_cliente (
    id_estado_cliente integer NOT NULL,
    codigo character varying(20) NOT NULL,
    descripcion character varying(100) NOT NULL
);


ALTER TABLE banco_core.estado_cliente OWNER TO postgres;

--
-- Name: TABLE estado_cliente; Type: COMMENT; Schema: banco_core; Owner: postgres
--

COMMENT ON TABLE banco_core.estado_cliente IS 'Catálogo oficial de estados del ciclo de vida del cliente';


--
-- Name: estado_cuenta; Type: TABLE; Schema: banco_core; Owner: postgres
--

CREATE TABLE banco_core.estado_cuenta (
    id_estado_cuenta integer NOT NULL,
    codigo character varying(25) NOT NULL,
    descripcion character varying(100) NOT NULL
);


ALTER TABLE banco_core.estado_cuenta OWNER TO postgres;

--
-- Name: TABLE estado_cuenta; Type: COMMENT; Schema: banco_core; Owner: postgres
--

COMMENT ON TABLE banco_core.estado_cuenta IS 'Estados posibles en el ciclo de vida de una cuenta bancaria';


--
-- Name: estado_transaccion; Type: TABLE; Schema: banco_core; Owner: postgres
--

CREATE TABLE banco_core.estado_transaccion (
    id_estado_transaccion integer NOT NULL,
    codigo character varying(20) NOT NULL,
    descripcion character varying(100) NOT NULL
);


ALTER TABLE banco_core.estado_transaccion OWNER TO postgres;

--
-- Name: TABLE estado_transaccion; Type: COMMENT; Schema: banco_core; Owner: postgres
--

COMMENT ON TABLE banco_core.estado_transaccion IS 'Ciclo de vida transaccional financiero';


--
-- Name: evento_cuenta; Type: TABLE; Schema: banco_core; Owner: postgres
--

CREATE TABLE banco_core.evento_cuenta (
    id_evento bigint NOT NULL,
    id_cuenta bigint NOT NULL,
    id_tipo_evento integer NOT NULL,
    id_usuario_interno integer NOT NULL,
    fecha_hora timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    motivo text NOT NULL,
    id_estado_anterior integer,
    id_estado_nuevo integer NOT NULL
);


ALTER TABLE banco_core.evento_cuenta OWNER TO postgres;

--
-- Name: evento_cuenta_id_evento_seq; Type: SEQUENCE; Schema: banco_core; Owner: postgres
--

ALTER TABLE banco_core.evento_cuenta ALTER COLUMN id_evento ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME banco_core.evento_cuenta_id_evento_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: historico_representante_legal; Type: TABLE; Schema: banco_core; Owner: postgres
--

CREATE TABLE banco_core.historico_representante_legal (
    id_historico_rep bigint NOT NULL,
    id_cliente_juridico bigint NOT NULL,
    id_cliente_natural_rep bigint NOT NULL,
    fecha_inicio date NOT NULL,
    fecha_fin date,
    activo boolean DEFAULT true NOT NULL,
    CONSTRAINT chk_fechas_rep CHECK (((fecha_fin IS NULL) OR (fecha_fin >= fecha_inicio)))
);


ALTER TABLE banco_core.historico_representante_legal OWNER TO postgres;

--
-- Name: historico_representante_legal_id_historico_rep_seq; Type: SEQUENCE; Schema: banco_core; Owner: postgres
--

ALTER TABLE banco_core.historico_representante_legal ALTER COLUMN id_historico_rep ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME banco_core.historico_representante_legal_id_historico_rep_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: municipio; Type: TABLE; Schema: banco_core; Owner: postgres
--

CREATE TABLE banco_core.municipio (
    id_municipio integer NOT NULL,
    id_departamento integer NOT NULL,
    codigo_dane character varying(5) NOT NULL,
    nombre character varying(100) NOT NULL
);


ALTER TABLE banco_core.municipio OWNER TO postgres;

--
-- Name: TABLE municipio; Type: COMMENT; Schema: banco_core; Owner: postgres
--

COMMENT ON TABLE banco_core.municipio IS 'Catálogo oficial de municipios colombianos';


--
-- Name: municipio_id_municipio_seq; Type: SEQUENCE; Schema: banco_core; Owner: postgres
--

ALTER TABLE banco_core.municipio ALTER COLUMN id_municipio ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME banco_core.municipio_id_municipio_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: transaccion; Type: TABLE; Schema: banco_core; Owner: postgres
--

CREATE TABLE banco_core.transaccion (
    id_transaccion bigint NOT NULL,
    idempotency_key uuid NOT NULL,
    id_cuenta_origen bigint,
    id_cuenta_destino bigint,
    id_tipo_transaccion integer NOT NULL,
    id_estado_transaccion integer NOT NULL,
    monto numeric(18,2) NOT NULL,
    moneda character varying(3) DEFAULT 'COP'::character varying NOT NULL,
    fecha_transaccion timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    id_usuario_operador integer,
    CONSTRAINT chk_al_menos_una_cuenta CHECK (((id_cuenta_origen IS NOT NULL) OR (id_cuenta_destino IS NOT NULL))),
    CONSTRAINT chk_cuentas_distintas CHECK ((id_cuenta_origen IS DISTINCT FROM id_cuenta_destino)),
    CONSTRAINT transaccion_monto_check CHECK ((monto > 0.00))
);


ALTER TABLE banco_core.transaccion OWNER TO postgres;

--
-- Name: TABLE transaccion; Type: COMMENT; Schema: banco_core; Owner: postgres
--

COMMENT ON TABLE banco_core.transaccion IS 'Registro central de
transacciones financieras con clave de idempotencia';


--
-- Name: mv_volumen_mensual_posted; Type: MATERIALIZED VIEW; Schema: banco_core; Owner: postgres
--

CREATE MATERIALIZED VIEW banco_core.mv_volumen_mensual_posted AS
 SELECT date_trunc('month'::text, t.fecha_transaccion) AS mes_fecha,
    sum(t.monto) AS volumen_actual,
    count(t.id_transaccion) AS total_transacciones
   FROM (banco_core.transaccion t
     JOIN banco_core.estado_transaccion et ON ((t.id_estado_transaccion = et.id_estado_transaccion)))
  WHERE ((et.codigo)::text = 'POSTED'::text)
  GROUP BY (date_trunc('month'::text, t.fecha_transaccion))
  WITH NO DATA;


ALTER MATERIALIZED VIEW banco_core.mv_volumen_mensual_posted OWNER TO postgres;

--
-- Name: oficina; Type: TABLE; Schema: banco_core; Owner: postgres
--

CREATE TABLE banco_core.oficina (
    id_oficina integer NOT NULL,
    id_municipio integer NOT NULL,
    codigo_oficina character varying(10) NOT NULL,
    nombre character varying(100) NOT NULL,
    direccion character varying(200) NOT NULL,
    activa boolean DEFAULT true NOT NULL
);


ALTER TABLE banco_core.oficina OWNER TO postgres;

--
-- Name: TABLE oficina; Type: COMMENT; Schema: banco_core; Owner: postgres
--

COMMENT ON TABLE banco_core.oficina IS 'Red de oficinas físicas del Banco Andino Colombia';


--
-- Name: oficina_id_oficina_seq; Type: SEQUENCE; Schema: banco_core; Owner: postgres
--

ALTER TABLE banco_core.oficina ALTER COLUMN id_oficina ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME banco_core.oficina_id_oficina_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: persona_juridica; Type: TABLE; Schema: banco_core; Owner: postgres
--

CREATE TABLE banco_core.persona_juridica (
    id_cliente bigint NOT NULL,
    nit character varying(20) NOT NULL,
    razon_social character varying(150) NOT NULL
);


ALTER TABLE banco_core.persona_juridica OWNER TO postgres;

--
-- Name: TABLE persona_juridica; Type: COMMENT; Schema: banco_core; Owner: postgres
--

COMMENT ON TABLE banco_core.persona_juridica IS 'Extensión de atributos de clientes Persona Jurídica';


--
-- Name: persona_natural; Type: TABLE; Schema: banco_core; Owner: postgres
--

CREATE TABLE banco_core.persona_natural (
    id_cliente bigint NOT NULL,
    id_tipo_documento integer NOT NULL,
    numero_documento character varying(20) NOT NULL,
    primer_nombre character varying(50) NOT NULL,
    segundo_nombre character varying(50),
    primer_apellido character varying(50) NOT NULL,
    segundo_apellido character varying(50),
    fecha_nacimiento date NOT NULL
);


ALTER TABLE banco_core.persona_natural OWNER TO postgres;

--
-- Name: TABLE persona_natural; Type: COMMENT; Schema: banco_core; Owner: postgres
--

COMMENT ON TABLE banco_core.persona_natural IS 'Extensión de atributos de clientes Persona Natural';


--
-- Name: plan_cuentas; Type: TABLE; Schema: banco_core; Owner: postgres
--

CREATE TABLE banco_core.plan_cuentas (
    codigo_cuenta_puc character varying(20) NOT NULL,
    nombre_cuenta character varying(150) NOT NULL,
    tipo_cuenta character varying(20) NOT NULL,
    CONSTRAINT plan_cuentas_tipo_cuenta_check CHECK (((tipo_cuenta)::text = ANY ((ARRAY['ACTIVO'::character varying, 'PASIVO'::character varying, 'PATRIMONIO'::character varying, 'INGRESO'::character varying, 'GASTO'::character varying])::text[])))
);


ALTER TABLE banco_core.plan_cuentas OWNER TO postgres;

--
-- Name: producto; Type: TABLE; Schema: banco_core; Owner: postgres
--

CREATE TABLE banco_core.producto (
    id_producto integer NOT NULL,
    codigo_producto character varying(10) NOT NULL,
    nombre character varying(50) NOT NULL,
    tipo_producto character varying(20) NOT NULL,
    CONSTRAINT producto_tipo_producto_check CHECK (((tipo_producto)::text = ANY ((ARRAY['AHORROS'::character varying, 'CORRIENTE'::character varying, 'NOMINA'::character varying])::text[])))
);


ALTER TABLE banco_core.producto OWNER TO postgres;

--
-- Name: TABLE producto; Type: COMMENT; Schema: banco_core; Owner: postgres
--

COMMENT ON TABLE banco_core.producto IS 'Catálogo de productos financieros del banco';


--
-- Name: producto_id_producto_seq; Type: SEQUENCE; Schema: banco_core; Owner: postgres
--

ALTER TABLE banco_core.producto ALTER COLUMN id_producto ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME banco_core.producto_id_producto_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: tipo_documento; Type: TABLE; Schema: banco_core; Owner: postgres
--

CREATE TABLE banco_core.tipo_documento (
    id_tipo_documento integer NOT NULL,
    codigo character varying(10) NOT NULL,
    nombre character varying(50) NOT NULL
);


ALTER TABLE banco_core.tipo_documento OWNER TO postgres;

--
-- Name: TABLE tipo_documento; Type: COMMENT; Schema: banco_core; Owner: postgres
--

COMMENT ON TABLE banco_core.tipo_documento IS 'Tipos de documento de identidad oficial en Colombia';


--
-- Name: tipo_evento_cuenta; Type: TABLE; Schema: banco_core; Owner: postgres
--

CREATE TABLE banco_core.tipo_evento_cuenta (
    id_tipo_evento integer NOT NULL,
    codigo character varying(30) NOT NULL,
    nombre character varying(100) NOT NULL
);


ALTER TABLE banco_core.tipo_evento_cuenta OWNER TO postgres;

--
-- Name: TABLE tipo_evento_cuenta; Type: COMMENT; Schema: banco_core; Owner: postgres
--

COMMENT ON TABLE banco_core.tipo_evento_cuenta IS 'Catálogo de eventos administrativos sobre el contrato de cuenta';


--
-- Name: tipo_transaccion; Type: TABLE; Schema: banco_core; Owner: postgres
--

CREATE TABLE banco_core.tipo_transaccion (
    id_tipo_transaccion integer NOT NULL,
    codigo character varying(20) NOT NULL,
    nombre character varying(50) NOT NULL
);


ALTER TABLE banco_core.tipo_transaccion OWNER TO postgres;

--
-- Name: TABLE tipo_transaccion; Type: COMMENT; Schema: banco_core; Owner: postgres
--

COMMENT ON TABLE banco_core.tipo_transaccion IS 'Tipos de operaciones financieras reconocidas en el core';


--
-- Name: transaccion_id_transaccion_seq; Type: SEQUENCE; Schema: banco_core; Owner: postgres
--

ALTER TABLE banco_core.transaccion ALTER COLUMN id_transaccion ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME banco_core.transaccion_id_transaccion_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: v_secuencial; Type: TABLE; Schema: banco_core; Owner: postgres
--

CREATE TABLE banco_core.v_secuencial (
    id_secuencial bigint NOT NULL
);


ALTER TABLE banco_core.v_secuencial OWNER TO postgres;

--
-- Name: vw_reconciliacion_saldos; Type: VIEW; Schema: banco_core; Owner: postgres
--

CREATE VIEW banco_core.vw_reconciliacion_saldos AS
 WITH calculo_ledger AS (
         SELECT c_1.id_cuenta,
            sum(
                CASE
                    WHEN ((ac.tipo_movimiento)::text = 'CREDITO'::text) THEN ac.monto
                    WHEN ((ac.tipo_movimiento)::text = 'DEBITO'::text) THEN (- ac.monto)
                    ELSE 0.00
                END) AS saldo_calculado_ledger
           FROM ((banco_core.cuenta c_1
             LEFT JOIN banco_core.transaccion t ON ((((c_1.id_cuenta = t.id_cuenta_origen) OR (c_1.id_cuenta = t.id_cuenta_destino)) AND (t.id_estado_transaccion = 2))))
             LEFT JOIN banco_core.asiento_contable ac ON (((t.id_transaccion = ac.id_transaccion) AND ((ac.codigo_cuenta_puc)::text = ANY ((ARRAY['210505'::character varying, '210510'::character varying])::text[])))))
          GROUP BY c_1.id_cuenta
        )
 SELECT c.id_cuenta,
    c.numero_cuenta,
    c.saldo_disponible AS saldo_persistido,
    COALESCE(cl.saldo_calculado_ledger, 0.00) AS saldo_ledger,
    (c.saldo_disponible - COALESCE(cl.saldo_calculado_ledger, 0.00)) AS diferencia
   FROM (banco_core.cuenta c
     LEFT JOIN calculo_ledger cl ON ((c.id_cuenta = cl.id_cuenta)));


ALTER VIEW banco_core.vw_reconciliacion_saldos OWNER TO postgres;

--
-- Name: vw_resumen_cliente; Type: VIEW; Schema: banco_core; Owner: postgres
--

CREATE VIEW banco_core.vw_resumen_cliente AS
 SELECT c.id_cliente,
    c.codigo_cliente,
    c.tipo_cliente,
    ec.codigo AS estado_cliente,
    COALESCE(pn.numero_documento, pj.nit) AS identificacion_oficial,
    COALESCE((((pn.primer_nombre)::text || ' '::text) || (pn.primer_apellido)::text), (pj.razon_social)::text) AS nombre_o_razon_social,
    o.nombre AS oficina_vinculacion,
    c.fecha_vinculacion
   FROM ((((banco_core.cliente c
     JOIN banco_core.estado_cliente ec ON ((c.id_estado_cliente = ec.id_estado_cliente)))
     JOIN banco_core.oficina o ON ((c.id_oficina_vinculacion = o.id_oficina)))
     LEFT JOIN banco_core.persona_natural pn ON ((c.id_cliente = pn.id_cliente)))
     LEFT JOIN banco_core.persona_juridica pj ON ((c.id_cliente = pj.id_cliente)));


ALTER VIEW banco_core.vw_resumen_cliente OWNER TO postgres;

--
-- Name: permiso; Type: TABLE; Schema: banco_security; Owner: postgres
--

CREATE TABLE banco_security.permiso (
    id_permiso integer NOT NULL,
    codigo character varying(50) NOT NULL,
    descripcion character varying(150)
);


ALTER TABLE banco_security.permiso OWNER TO postgres;

--
-- Name: permiso_id_permiso_seq; Type: SEQUENCE; Schema: banco_security; Owner: postgres
--

ALTER TABLE banco_security.permiso ALTER COLUMN id_permiso ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME banco_security.permiso_id_permiso_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: rol; Type: TABLE; Schema: banco_security; Owner: postgres
--

CREATE TABLE banco_security.rol (
    id_rol integer NOT NULL,
    nombre character varying(50) NOT NULL,
    descripcion character varying(150)
);


ALTER TABLE banco_security.rol OWNER TO postgres;

--
-- Name: rol_id_rol_seq; Type: SEQUENCE; Schema: banco_security; Owner: postgres
--

ALTER TABLE banco_security.rol ALTER COLUMN id_rol ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME banco_security.rol_id_rol_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: rol_permiso; Type: TABLE; Schema: banco_security; Owner: postgres
--

CREATE TABLE banco_security.rol_permiso (
    id_rol integer NOT NULL,
    id_permiso integer NOT NULL
);


ALTER TABLE banco_security.rol_permiso OWNER TO postgres;

--
-- Name: usuario_interno; Type: TABLE; Schema: banco_security; Owner: postgres
--

CREATE TABLE banco_security.usuario_interno (
    id_usuario integer NOT NULL,
    username character varying(50) NOT NULL,
    email character varying(100) NOT NULL,
    id_oficina integer NOT NULL,
    activo boolean DEFAULT true NOT NULL
);


ALTER TABLE banco_security.usuario_interno OWNER TO postgres;

--
-- Name: usuario_interno_id_usuario_seq; Type: SEQUENCE; Schema: banco_security; Owner: postgres
--

ALTER TABLE banco_security.usuario_interno ALTER COLUMN id_usuario ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME banco_security.usuario_interno_id_usuario_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: usuario_rol; Type: TABLE; Schema: banco_security; Owner: postgres
--

CREATE TABLE banco_security.usuario_rol (
    id_usuario integer NOT NULL,
    id_rol integer NOT NULL
);


ALTER TABLE banco_security.usuario_rol OWNER TO postgres;

--
-- Name: auditoria_operacion auditoria_operacion_pkey; Type: CONSTRAINT; Schema: banco_audit; Owner: postgres
--

ALTER TABLE ONLY banco_audit.auditoria_operacion
    ADD CONSTRAINT auditoria_operacion_pkey PRIMARY KEY (id_auditoria);


--
-- Name: resultado_quality_gate resultado_quality_gate_pkey; Type: CONSTRAINT; Schema: banco_audit; Owner: postgres
--

ALTER TABLE ONLY banco_audit.resultado_quality_gate
    ADD CONSTRAINT resultado_quality_gate_pkey PRIMARY KEY (test_id);


--
-- Name: asiento_contable asiento_contable_pkey; Type: CONSTRAINT; Schema: banco_core; Owner: postgres
--

ALTER TABLE ONLY banco_core.asiento_contable
    ADD CONSTRAINT asiento_contable_pkey PRIMARY KEY (id_asiento);


--
-- Name: cliente cliente_codigo_cliente_key; Type: CONSTRAINT; Schema: banco_core; Owner: postgres
--

ALTER TABLE ONLY banco_core.cliente
    ADD CONSTRAINT cliente_codigo_cliente_key UNIQUE (codigo_cliente);


--
-- Name: cliente_contacto cliente_contacto_pkey; Type: CONSTRAINT; Schema: banco_core; Owner: postgres
--

ALTER TABLE ONLY banco_core.cliente_contacto
    ADD CONSTRAINT cliente_contacto_pkey PRIMARY KEY (id_contacto);


--
-- Name: cliente cliente_pkey; Type: CONSTRAINT; Schema: banco_core; Owner: postgres
--

ALTER TABLE ONLY banco_core.cliente
    ADD CONSTRAINT cliente_pkey PRIMARY KEY (id_cliente);


--
-- Name: cuenta cuenta_numero_cuenta_key; Type: CONSTRAINT; Schema: banco_core; Owner: postgres
--

ALTER TABLE ONLY banco_core.cuenta
    ADD CONSTRAINT cuenta_numero_cuenta_key UNIQUE (numero_cuenta);


--
-- Name: cuenta cuenta_pkey; Type: CONSTRAINT; Schema: banco_core; Owner: postgres
--

ALTER TABLE ONLY banco_core.cuenta
    ADD CONSTRAINT cuenta_pkey PRIMARY KEY (id_cuenta);


--
-- Name: cuenta_titular cuenta_titular_pkey; Type: CONSTRAINT; Schema: banco_core; Owner: postgres
--

ALTER TABLE ONLY banco_core.cuenta_titular
    ADD CONSTRAINT cuenta_titular_pkey PRIMARY KEY (id_cuenta, id_cliente, fecha_vinculacion);


--
-- Name: departamento departamento_codigo_dane_key; Type: CONSTRAINT; Schema: banco_core; Owner: postgres
--

ALTER TABLE ONLY banco_core.departamento
    ADD CONSTRAINT departamento_codigo_dane_key UNIQUE (codigo_dane);


--
-- Name: departamento departamento_pkey; Type: CONSTRAINT; Schema: banco_core; Owner: postgres
--

ALTER TABLE ONLY banco_core.departamento
    ADD CONSTRAINT departamento_pkey PRIMARY KEY (id_departamento);


--
-- Name: estado_cliente estado_cliente_codigo_key; Type: CONSTRAINT; Schema: banco_core; Owner: postgres
--

ALTER TABLE ONLY banco_core.estado_cliente
    ADD CONSTRAINT estado_cliente_codigo_key UNIQUE (codigo);


--
-- Name: estado_cliente estado_cliente_pkey; Type: CONSTRAINT; Schema: banco_core; Owner: postgres
--

ALTER TABLE ONLY banco_core.estado_cliente
    ADD CONSTRAINT estado_cliente_pkey PRIMARY KEY (id_estado_cliente);


--
-- Name: estado_cuenta estado_cuenta_codigo_key; Type: CONSTRAINT; Schema: banco_core; Owner: postgres
--

ALTER TABLE ONLY banco_core.estado_cuenta
    ADD CONSTRAINT estado_cuenta_codigo_key UNIQUE (codigo);


--
-- Name: estado_cuenta estado_cuenta_pkey; Type: CONSTRAINT; Schema: banco_core; Owner: postgres
--

ALTER TABLE ONLY banco_core.estado_cuenta
    ADD CONSTRAINT estado_cuenta_pkey PRIMARY KEY (id_estado_cuenta);


--
-- Name: estado_transaccion estado_transaccion_codigo_key; Type: CONSTRAINT; Schema: banco_core; Owner: postgres
--

ALTER TABLE ONLY banco_core.estado_transaccion
    ADD CONSTRAINT estado_transaccion_codigo_key UNIQUE (codigo);


--
-- Name: estado_transaccion estado_transaccion_pkey; Type: CONSTRAINT; Schema: banco_core; Owner: postgres
--

ALTER TABLE ONLY banco_core.estado_transaccion
    ADD CONSTRAINT estado_transaccion_pkey PRIMARY KEY (id_estado_transaccion);


--
-- Name: evento_cuenta evento_cuenta_pkey; Type: CONSTRAINT; Schema: banco_core; Owner: postgres
--

ALTER TABLE ONLY banco_core.evento_cuenta
    ADD CONSTRAINT evento_cuenta_pkey PRIMARY KEY (id_evento);


--
-- Name: historico_representante_legal historico_representante_legal_pkey; Type: CONSTRAINT; Schema: banco_core; Owner: postgres
--

ALTER TABLE ONLY banco_core.historico_representante_legal
    ADD CONSTRAINT historico_representante_legal_pkey PRIMARY KEY (id_historico_rep);


--
-- Name: municipio municipio_codigo_dane_key; Type: CONSTRAINT; Schema: banco_core; Owner: postgres
--

ALTER TABLE ONLY banco_core.municipio
    ADD CONSTRAINT municipio_codigo_dane_key UNIQUE (codigo_dane);


--
-- Name: municipio municipio_pkey; Type: CONSTRAINT; Schema: banco_core; Owner: postgres
--

ALTER TABLE ONLY banco_core.municipio
    ADD CONSTRAINT municipio_pkey PRIMARY KEY (id_municipio);


--
-- Name: oficina oficina_codigo_oficina_key; Type: CONSTRAINT; Schema: banco_core; Owner: postgres
--

ALTER TABLE ONLY banco_core.oficina
    ADD CONSTRAINT oficina_codigo_oficina_key UNIQUE (codigo_oficina);


--
-- Name: oficina oficina_pkey; Type: CONSTRAINT; Schema: banco_core; Owner: postgres
--

ALTER TABLE ONLY banco_core.oficina
    ADD CONSTRAINT oficina_pkey PRIMARY KEY (id_oficina);


--
-- Name: persona_juridica persona_juridica_nit_key; Type: CONSTRAINT; Schema: banco_core; Owner: postgres
--

ALTER TABLE ONLY banco_core.persona_juridica
    ADD CONSTRAINT persona_juridica_nit_key UNIQUE (nit);


--
-- Name: persona_juridica persona_juridica_pkey; Type: CONSTRAINT; Schema: banco_core; Owner: postgres
--

ALTER TABLE ONLY banco_core.persona_juridica
    ADD CONSTRAINT persona_juridica_pkey PRIMARY KEY (id_cliente);


--
-- Name: persona_natural persona_natural_pkey; Type: CONSTRAINT; Schema: banco_core; Owner: postgres
--

ALTER TABLE ONLY banco_core.persona_natural
    ADD CONSTRAINT persona_natural_pkey PRIMARY KEY (id_cliente);


--
-- Name: v_secuencial pk_v_secuencial; Type: CONSTRAINT; Schema: banco_core; Owner: postgres
--

ALTER TABLE ONLY banco_core.v_secuencial
    ADD CONSTRAINT pk_v_secuencial PRIMARY KEY (id_secuencial);


--
-- Name: plan_cuentas plan_cuentas_pkey; Type: CONSTRAINT; Schema: banco_core; Owner: postgres
--

ALTER TABLE ONLY banco_core.plan_cuentas
    ADD CONSTRAINT plan_cuentas_pkey PRIMARY KEY (codigo_cuenta_puc);


--
-- Name: producto producto_codigo_producto_key; Type: CONSTRAINT; Schema: banco_core; Owner: postgres
--

ALTER TABLE ONLY banco_core.producto
    ADD CONSTRAINT producto_codigo_producto_key UNIQUE (codigo_producto);


--
-- Name: producto producto_pkey; Type: CONSTRAINT; Schema: banco_core; Owner: postgres
--

ALTER TABLE ONLY banco_core.producto
    ADD CONSTRAINT producto_pkey PRIMARY KEY (id_producto);


--
-- Name: tipo_documento tipo_documento_codigo_key; Type: CONSTRAINT; Schema: banco_core; Owner: postgres
--

ALTER TABLE ONLY banco_core.tipo_documento
    ADD CONSTRAINT tipo_documento_codigo_key UNIQUE (codigo);


--
-- Name: tipo_documento tipo_documento_pkey; Type: CONSTRAINT; Schema: banco_core; Owner: postgres
--

ALTER TABLE ONLY banco_core.tipo_documento
    ADD CONSTRAINT tipo_documento_pkey PRIMARY KEY (id_tipo_documento);


--
-- Name: tipo_evento_cuenta tipo_evento_cuenta_codigo_key; Type: CONSTRAINT; Schema: banco_core; Owner: postgres
--

ALTER TABLE ONLY banco_core.tipo_evento_cuenta
    ADD CONSTRAINT tipo_evento_cuenta_codigo_key UNIQUE (codigo);


--
-- Name: tipo_evento_cuenta tipo_evento_cuenta_pkey; Type: CONSTRAINT; Schema: banco_core; Owner: postgres
--

ALTER TABLE ONLY banco_core.tipo_evento_cuenta
    ADD CONSTRAINT tipo_evento_cuenta_pkey PRIMARY KEY (id_tipo_evento);


--
-- Name: tipo_transaccion tipo_transaccion_codigo_key; Type: CONSTRAINT; Schema: banco_core; Owner: postgres
--

ALTER TABLE ONLY banco_core.tipo_transaccion
    ADD CONSTRAINT tipo_transaccion_codigo_key UNIQUE (codigo);


--
-- Name: tipo_transaccion tipo_transaccion_pkey; Type: CONSTRAINT; Schema: banco_core; Owner: postgres
--

ALTER TABLE ONLY banco_core.tipo_transaccion
    ADD CONSTRAINT tipo_transaccion_pkey PRIMARY KEY (id_tipo_transaccion);


--
-- Name: transaccion transaccion_idempotency_key_key; Type: CONSTRAINT; Schema: banco_core; Owner: postgres
--

ALTER TABLE ONLY banco_core.transaccion
    ADD CONSTRAINT transaccion_idempotency_key_key UNIQUE (idempotency_key);


--
-- Name: transaccion transaccion_pkey; Type: CONSTRAINT; Schema: banco_core; Owner: postgres
--

ALTER TABLE ONLY banco_core.transaccion
    ADD CONSTRAINT transaccion_pkey PRIMARY KEY (id_transaccion);


--
-- Name: asiento_contable uk_asiento_linea; Type: CONSTRAINT; Schema: banco_core; Owner: postgres
--

ALTER TABLE ONLY banco_core.asiento_contable
    ADD CONSTRAINT uk_asiento_linea UNIQUE (id_transaccion, num_linea);


--
-- Name: persona_natural uk_persona_natural_doc; Type: CONSTRAINT; Schema: banco_core; Owner: postgres
--

ALTER TABLE ONLY banco_core.persona_natural
    ADD CONSTRAINT uk_persona_natural_doc UNIQUE (id_tipo_documento, numero_documento);


--
-- Name: permiso permiso_codigo_key; Type: CONSTRAINT; Schema: banco_security; Owner: postgres
--

ALTER TABLE ONLY banco_security.permiso
    ADD CONSTRAINT permiso_codigo_key UNIQUE (codigo);


--
-- Name: permiso permiso_pkey; Type: CONSTRAINT; Schema: banco_security; Owner: postgres
--

ALTER TABLE ONLY banco_security.permiso
    ADD CONSTRAINT permiso_pkey PRIMARY KEY (id_permiso);


--
-- Name: rol rol_nombre_key; Type: CONSTRAINT; Schema: banco_security; Owner: postgres
--

ALTER TABLE ONLY banco_security.rol
    ADD CONSTRAINT rol_nombre_key UNIQUE (nombre);


--
-- Name: rol_permiso rol_permiso_pkey; Type: CONSTRAINT; Schema: banco_security; Owner: postgres
--

ALTER TABLE ONLY banco_security.rol_permiso
    ADD CONSTRAINT rol_permiso_pkey PRIMARY KEY (id_rol, id_permiso);


--
-- Name: rol rol_pkey; Type: CONSTRAINT; Schema: banco_security; Owner: postgres
--

ALTER TABLE ONLY banco_security.rol
    ADD CONSTRAINT rol_pkey PRIMARY KEY (id_rol);


--
-- Name: usuario_interno usuario_interno_email_key; Type: CONSTRAINT; Schema: banco_security; Owner: postgres
--

ALTER TABLE ONLY banco_security.usuario_interno
    ADD CONSTRAINT usuario_interno_email_key UNIQUE (email);


--
-- Name: usuario_interno usuario_interno_pkey; Type: CONSTRAINT; Schema: banco_security; Owner: postgres
--

ALTER TABLE ONLY banco_security.usuario_interno
    ADD CONSTRAINT usuario_interno_pkey PRIMARY KEY (id_usuario);


--
-- Name: usuario_interno usuario_interno_username_key; Type: CONSTRAINT; Schema: banco_security; Owner: postgres
--

ALTER TABLE ONLY banco_security.usuario_interno
    ADD CONSTRAINT usuario_interno_username_key UNIQUE (username);


--
-- Name: usuario_rol usuario_rol_pkey; Type: CONSTRAINT; Schema: banco_security; Owner: postgres
--

ALTER TABLE ONLY banco_security.usuario_rol
    ADD CONSTRAINT usuario_rol_pkey PRIMARY KEY (id_usuario, id_rol);


--
-- Name: idx_auditoria_moneda_anomala; Type: INDEX; Schema: banco_audit; Owner: postgres
--

CREATE INDEX idx_auditoria_moneda_anomala ON banco_audit.auditoria_operacion USING btree (((datos_nuevos ->> 'moneda'::text))) WHERE (((datos_nuevos ->> 'moneda'::text) IS NOT NULL) AND ((datos_nuevos ->> 'moneda'::text) <> 'COP'::text));


--
-- Name: idx_auditoria_tabla_fecha; Type: INDEX; Schema: banco_audit; Owner: postgres
--

CREATE INDEX idx_auditoria_tabla_fecha ON banco_audit.auditoria_operacion USING btree (nombre_tabla, fecha_hora DESC);


--
-- Name: idx_asiento_transaccion; Type: INDEX; Schema: banco_core; Owner: postgres
--

CREATE INDEX idx_asiento_transaccion ON banco_core.asiento_contable USING btree (id_transaccion);


--
-- Name: idx_cuenta_numero; Type: INDEX; Schema: banco_core; Owner: postgres
--

CREATE INDEX idx_cuenta_numero ON banco_core.cuenta USING btree (numero_cuenta);


--
-- Name: idx_cuenta_oficina_apertura; Type: INDEX; Schema: banco_core; Owner: postgres
--

CREATE INDEX idx_cuenta_oficina_apertura ON banco_core.cuenta USING btree (id_oficina_apertura);


--
-- Name: idx_cuenta_titular_activo; Type: INDEX; Schema: banco_core; Owner: postgres
--

CREATE INDEX idx_cuenta_titular_activo ON banco_core.cuenta_titular USING btree (id_cuenta, id_cliente) WHERE (activo IS TRUE);


--
-- Name: idx_cuenta_titular_cliente; Type: INDEX; Schema: banco_core; Owner: postgres
--

CREATE INDEX idx_cuenta_titular_cliente ON banco_core.cuenta_titular USING btree (id_cliente);


--
-- Name: idx_cuenta_titular_cuenta; Type: INDEX; Schema: banco_core; Owner: postgres
--

CREATE INDEX idx_cuenta_titular_cuenta ON banco_core.cuenta_titular USING btree (id_cuenta);


--
-- Name: idx_evento_cuenta_id_cuenta; Type: INDEX; Schema: banco_core; Owner: postgres
--

CREATE INDEX idx_evento_cuenta_id_cuenta ON banco_core.evento_cuenta USING btree (id_cuenta);


--
-- Name: idx_mv_volumen_mensual_mes; Type: INDEX; Schema: banco_core; Owner: postgres
--

CREATE UNIQUE INDEX idx_mv_volumen_mensual_mes ON banco_core.mv_volumen_mensual_posted USING btree (mes_fecha);


--
-- Name: idx_persona_natural_doc; Type: INDEX; Schema: banco_core; Owner: postgres
--

CREATE INDEX idx_persona_natural_doc ON banco_core.persona_natural USING btree (id_tipo_documento, numero_documento);


--
-- Name: idx_transaccion_cuenta_destino; Type: INDEX; Schema: banco_core; Owner: postgres
--

CREATE INDEX idx_transaccion_cuenta_destino ON banco_core.transaccion USING btree (id_cuenta_destino, fecha_transaccion DESC);


--
-- Name: idx_transaccion_cuenta_origen; Type: INDEX; Schema: banco_core; Owner: postgres
--

CREATE INDEX idx_transaccion_cuenta_origen ON banco_core.transaccion USING btree (id_cuenta_origen, fecha_transaccion DESC);


--
-- Name: idx_transaccion_idempotency; Type: INDEX; Schema: banco_core; Owner: postgres
--

CREATE INDEX idx_transaccion_idempotency ON banco_core.transaccion USING btree (idempotency_key);


--
-- Name: idx_transaccion_origen_fecha; Type: INDEX; Schema: banco_core; Owner: postgres
--

CREATE INDEX idx_transaccion_origen_fecha ON banco_core.transaccion USING btree (id_cuenta_origen, fecha_transaccion) WHERE (id_cuenta_origen IS NOT NULL);


--
-- Name: cliente trg_audit_cliente; Type: TRIGGER; Schema: banco_core; Owner: postgres
--

CREATE TRIGGER trg_audit_cliente AFTER INSERT OR DELETE OR UPDATE ON banco_core.cliente FOR EACH ROW EXECUTE FUNCTION banco_audit.fn_trg_auditoria_operacion();


--
-- Name: asiento_contable trg_inmutabilidad_asiento; Type: TRIGGER; Schema: banco_core; Owner: postgres
--

CREATE TRIGGER trg_inmutabilidad_asiento BEFORE DELETE OR UPDATE ON banco_core.asiento_contable FOR EACH ROW EXECUTE FUNCTION banco_core.fn_trg_inmutabilidad_asiento();


--
-- Name: transaccion trg_inmutabilidad_transaccion; Type: TRIGGER; Schema: banco_core; Owner: postgres
--

CREATE TRIGGER trg_inmutabilidad_transaccion BEFORE DELETE OR UPDATE ON banco_core.transaccion FOR EACH ROW EXECUTE FUNCTION banco_core.fn_trg_inmutabilidad_transaccion();


--
-- Name: auditoria_operacion auditoria_operacion_id_usuario_interno_fkey; Type: FK CONSTRAINT; Schema: banco_audit; Owner: postgres
--

ALTER TABLE ONLY banco_audit.auditoria_operacion
    ADD CONSTRAINT auditoria_operacion_id_usuario_interno_fkey FOREIGN KEY (id_usuario_interno) REFERENCES banco_security.usuario_interno(id_usuario);


--
-- Name: asiento_contable asiento_contable_codigo_cuenta_puc_fkey; Type: FK CONSTRAINT; Schema: banco_core; Owner: postgres
--

ALTER TABLE ONLY banco_core.asiento_contable
    ADD CONSTRAINT asiento_contable_codigo_cuenta_puc_fkey FOREIGN KEY (codigo_cuenta_puc) REFERENCES banco_core.plan_cuentas(codigo_cuenta_puc);


--
-- Name: asiento_contable asiento_contable_id_transaccion_fkey; Type: FK CONSTRAINT; Schema: banco_core; Owner: postgres
--

ALTER TABLE ONLY banco_core.asiento_contable
    ADD CONSTRAINT asiento_contable_id_transaccion_fkey FOREIGN KEY (id_transaccion) REFERENCES banco_core.transaccion(id_transaccion) ON DELETE RESTRICT;


--
-- Name: cliente_contacto cliente_contacto_id_cliente_fkey; Type: FK CONSTRAINT; Schema: banco_core; Owner: postgres
--

ALTER TABLE ONLY banco_core.cliente_contacto
    ADD CONSTRAINT cliente_contacto_id_cliente_fkey FOREIGN KEY (id_cliente) REFERENCES banco_core.cliente(id_cliente);


--
-- Name: cliente_contacto cliente_contacto_id_municipio_fkey; Type: FK CONSTRAINT; Schema: banco_core; Owner: postgres
--

ALTER TABLE ONLY banco_core.cliente_contacto
    ADD CONSTRAINT cliente_contacto_id_municipio_fkey FOREIGN KEY (id_municipio) REFERENCES banco_core.municipio(id_municipio);


--
-- Name: cliente cliente_id_estado_cliente_fkey; Type: FK CONSTRAINT; Schema: banco_core; Owner: postgres
--

ALTER TABLE ONLY banco_core.cliente
    ADD CONSTRAINT cliente_id_estado_cliente_fkey FOREIGN KEY (id_estado_cliente) REFERENCES banco_core.estado_cliente(id_estado_cliente);


--
-- Name: cliente cliente_id_oficina_vinculacion_fkey; Type: FK CONSTRAINT; Schema: banco_core; Owner: postgres
--

ALTER TABLE ONLY banco_core.cliente
    ADD CONSTRAINT cliente_id_oficina_vinculacion_fkey FOREIGN KEY (id_oficina_vinculacion) REFERENCES banco_core.oficina(id_oficina);


--
-- Name: cuenta cuenta_id_estado_cuenta_fkey; Type: FK CONSTRAINT; Schema: banco_core; Owner: postgres
--

ALTER TABLE ONLY banco_core.cuenta
    ADD CONSTRAINT cuenta_id_estado_cuenta_fkey FOREIGN KEY (id_estado_cuenta) REFERENCES banco_core.estado_cuenta(id_estado_cuenta);


--
-- Name: cuenta cuenta_id_oficina_apertura_fkey; Type: FK CONSTRAINT; Schema: banco_core; Owner: postgres
--

ALTER TABLE ONLY banco_core.cuenta
    ADD CONSTRAINT cuenta_id_oficina_apertura_fkey FOREIGN KEY (id_oficina_apertura) REFERENCES banco_core.oficina(id_oficina);


--
-- Name: cuenta cuenta_id_producto_fkey; Type: FK CONSTRAINT; Schema: banco_core; Owner: postgres
--

ALTER TABLE ONLY banco_core.cuenta
    ADD CONSTRAINT cuenta_id_producto_fkey FOREIGN KEY (id_producto) REFERENCES banco_core.producto(id_producto);


--
-- Name: cuenta_titular cuenta_titular_id_cliente_fkey; Type: FK CONSTRAINT; Schema: banco_core; Owner: postgres
--

ALTER TABLE ONLY banco_core.cuenta_titular
    ADD CONSTRAINT cuenta_titular_id_cliente_fkey FOREIGN KEY (id_cliente) REFERENCES banco_core.cliente(id_cliente);


--
-- Name: cuenta_titular cuenta_titular_id_cuenta_fkey; Type: FK CONSTRAINT; Schema: banco_core; Owner: postgres
--

ALTER TABLE ONLY banco_core.cuenta_titular
    ADD CONSTRAINT cuenta_titular_id_cuenta_fkey FOREIGN KEY (id_cuenta) REFERENCES banco_core.cuenta(id_cuenta);


--
-- Name: evento_cuenta evento_cuenta_id_cuenta_fkey; Type: FK CONSTRAINT; Schema: banco_core; Owner: postgres
--

ALTER TABLE ONLY banco_core.evento_cuenta
    ADD CONSTRAINT evento_cuenta_id_cuenta_fkey FOREIGN KEY (id_cuenta) REFERENCES banco_core.cuenta(id_cuenta);


--
-- Name: evento_cuenta evento_cuenta_id_estado_anterior_fkey; Type: FK CONSTRAINT; Schema: banco_core; Owner: postgres
--

ALTER TABLE ONLY banco_core.evento_cuenta
    ADD CONSTRAINT evento_cuenta_id_estado_anterior_fkey FOREIGN KEY (id_estado_anterior) REFERENCES banco_core.estado_cuenta(id_estado_cuenta);


--
-- Name: evento_cuenta evento_cuenta_id_estado_nuevo_fkey; Type: FK CONSTRAINT; Schema: banco_core; Owner: postgres
--

ALTER TABLE ONLY banco_core.evento_cuenta
    ADD CONSTRAINT evento_cuenta_id_estado_nuevo_fkey FOREIGN KEY (id_estado_nuevo) REFERENCES banco_core.estado_cuenta(id_estado_cuenta);


--
-- Name: evento_cuenta evento_cuenta_id_tipo_evento_fkey; Type: FK CONSTRAINT; Schema: banco_core; Owner: postgres
--

ALTER TABLE ONLY banco_core.evento_cuenta
    ADD CONSTRAINT evento_cuenta_id_tipo_evento_fkey FOREIGN KEY (id_tipo_evento) REFERENCES banco_core.tipo_evento_cuenta(id_tipo_evento);


--
-- Name: evento_cuenta fk_evento_cuenta_usuario; Type: FK CONSTRAINT; Schema: banco_core; Owner: postgres
--

ALTER TABLE ONLY banco_core.evento_cuenta
    ADD CONSTRAINT fk_evento_cuenta_usuario FOREIGN KEY (id_usuario_interno) REFERENCES banco_security.usuario_interno(id_usuario);


--
-- Name: historico_representante_legal historico_representante_legal_id_cliente_juridico_fkey; Type: FK CONSTRAINT; Schema: banco_core; Owner: postgres
--

ALTER TABLE ONLY banco_core.historico_representante_legal
    ADD CONSTRAINT historico_representante_legal_id_cliente_juridico_fkey FOREIGN KEY (id_cliente_juridico) REFERENCES banco_core.persona_juridica(id_cliente);


--
-- Name: historico_representante_legal historico_representante_legal_id_cliente_natural_rep_fkey; Type: FK CONSTRAINT; Schema: banco_core; Owner: postgres
--

ALTER TABLE ONLY banco_core.historico_representante_legal
    ADD CONSTRAINT historico_representante_legal_id_cliente_natural_rep_fkey FOREIGN KEY (id_cliente_natural_rep) REFERENCES banco_core.persona_natural(id_cliente);


--
-- Name: municipio municipio_id_departamento_fkey; Type: FK CONSTRAINT; Schema: banco_core; Owner: postgres
--

ALTER TABLE ONLY banco_core.municipio
    ADD CONSTRAINT municipio_id_departamento_fkey FOREIGN KEY (id_departamento) REFERENCES banco_core.departamento(id_departamento);


--
-- Name: oficina oficina_id_municipio_fkey; Type: FK CONSTRAINT; Schema: banco_core; Owner: postgres
--

ALTER TABLE ONLY banco_core.oficina
    ADD CONSTRAINT oficina_id_municipio_fkey FOREIGN KEY (id_municipio) REFERENCES banco_core.municipio(id_municipio);


--
-- Name: persona_juridica persona_juridica_id_cliente_fkey; Type: FK CONSTRAINT; Schema: banco_core; Owner: postgres
--

ALTER TABLE ONLY banco_core.persona_juridica
    ADD CONSTRAINT persona_juridica_id_cliente_fkey FOREIGN KEY (id_cliente) REFERENCES banco_core.cliente(id_cliente) ON DELETE RESTRICT;


--
-- Name: persona_natural persona_natural_id_cliente_fkey; Type: FK CONSTRAINT; Schema: banco_core; Owner: postgres
--

ALTER TABLE ONLY banco_core.persona_natural
    ADD CONSTRAINT persona_natural_id_cliente_fkey FOREIGN KEY (id_cliente) REFERENCES banco_core.cliente(id_cliente) ON DELETE RESTRICT;


--
-- Name: persona_natural persona_natural_id_tipo_documento_fkey; Type: FK CONSTRAINT; Schema: banco_core; Owner: postgres
--

ALTER TABLE ONLY banco_core.persona_natural
    ADD CONSTRAINT persona_natural_id_tipo_documento_fkey FOREIGN KEY (id_tipo_documento) REFERENCES banco_core.tipo_documento(id_tipo_documento);


--
-- Name: transaccion transaccion_id_cuenta_destino_fkey; Type: FK CONSTRAINT; Schema: banco_core; Owner: postgres
--

ALTER TABLE ONLY banco_core.transaccion
    ADD CONSTRAINT transaccion_id_cuenta_destino_fkey FOREIGN KEY (id_cuenta_destino) REFERENCES banco_core.cuenta(id_cuenta);


--
-- Name: transaccion transaccion_id_cuenta_origen_fkey; Type: FK CONSTRAINT; Schema: banco_core; Owner: postgres
--

ALTER TABLE ONLY banco_core.transaccion
    ADD CONSTRAINT transaccion_id_cuenta_origen_fkey FOREIGN KEY (id_cuenta_origen) REFERENCES banco_core.cuenta(id_cuenta);


--
-- Name: transaccion transaccion_id_estado_transaccion_fkey; Type: FK CONSTRAINT; Schema: banco_core; Owner: postgres
--

ALTER TABLE ONLY banco_core.transaccion
    ADD CONSTRAINT transaccion_id_estado_transaccion_fkey FOREIGN KEY (id_estado_transaccion) REFERENCES banco_core.estado_transaccion(id_estado_transaccion);


--
-- Name: transaccion transaccion_id_tipo_transaccion_fkey; Type: FK CONSTRAINT; Schema: banco_core; Owner: postgres
--

ALTER TABLE ONLY banco_core.transaccion
    ADD CONSTRAINT transaccion_id_tipo_transaccion_fkey FOREIGN KEY (id_tipo_transaccion) REFERENCES banco_core.tipo_transaccion(id_tipo_transaccion);


--
-- Name: transaccion transaccion_id_usuario_operador_fkey; Type: FK CONSTRAINT; Schema: banco_core; Owner: postgres
--

ALTER TABLE ONLY banco_core.transaccion
    ADD CONSTRAINT transaccion_id_usuario_operador_fkey FOREIGN KEY (id_usuario_operador) REFERENCES banco_security.usuario_interno(id_usuario);


--
-- Name: rol_permiso rol_permiso_id_permiso_fkey; Type: FK CONSTRAINT; Schema: banco_security; Owner: postgres
--

ALTER TABLE ONLY banco_security.rol_permiso
    ADD CONSTRAINT rol_permiso_id_permiso_fkey FOREIGN KEY (id_permiso) REFERENCES banco_security.permiso(id_permiso);


--
-- Name: rol_permiso rol_permiso_id_rol_fkey; Type: FK CONSTRAINT; Schema: banco_security; Owner: postgres
--

ALTER TABLE ONLY banco_security.rol_permiso
    ADD CONSTRAINT rol_permiso_id_rol_fkey FOREIGN KEY (id_rol) REFERENCES banco_security.rol(id_rol);


--
-- Name: usuario_interno usuario_interno_id_oficina_fkey; Type: FK CONSTRAINT; Schema: banco_security; Owner: postgres
--

ALTER TABLE ONLY banco_security.usuario_interno
    ADD CONSTRAINT usuario_interno_id_oficina_fkey FOREIGN KEY (id_oficina) REFERENCES banco_core.oficina(id_oficina);


--
-- Name: usuario_rol usuario_rol_id_rol_fkey; Type: FK CONSTRAINT; Schema: banco_security; Owner: postgres
--

ALTER TABLE ONLY banco_security.usuario_rol
    ADD CONSTRAINT usuario_rol_id_rol_fkey FOREIGN KEY (id_rol) REFERENCES banco_security.rol(id_rol);


--
-- Name: usuario_rol usuario_rol_id_usuario_fkey; Type: FK CONSTRAINT; Schema: banco_security; Owner: postgres
--

ALTER TABLE ONLY banco_security.usuario_rol
    ADD CONSTRAINT usuario_rol_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES banco_security.usuario_interno(id_usuario);


--
-- Name: SCHEMA banco_audit; Type: ACL; Schema: -; Owner: postgres
--

GRANT USAGE ON SCHEMA banco_audit TO banco_auditor_role;
GRANT USAGE ON SCHEMA banco_audit TO banco_admin_role;
GRANT USAGE ON SCHEMA banco_audit TO rol_auditor;


--
-- Name: SCHEMA banco_core; Type: ACL; Schema: -; Owner: postgres
--

GRANT USAGE ON SCHEMA banco_core TO banco_cajero_role;
GRANT USAGE ON SCHEMA banco_core TO banco_auditor_role;
GRANT ALL ON SCHEMA banco_core TO banco_admin_role;
GRANT USAGE ON SCHEMA banco_core TO rol_consulta;
GRANT USAGE ON SCHEMA banco_core TO rol_operativo;
GRANT USAGE ON SCHEMA banco_core TO rol_auditor;


--
-- Name: SCHEMA banco_security; Type: ACL; Schema: -; Owner: postgres
--

GRANT ALL ON SCHEMA banco_security TO banco_admin_role;


--
-- Name: SCHEMA banco_seguridad; Type: ACL; Schema: -; Owner: postgres
--

GRANT USAGE ON SCHEMA banco_seguridad TO rol_admin;


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: pg_database_owner
--

REVOKE USAGE ON SCHEMA public FROM PUBLIC;


--
-- Name: PROCEDURE sp_consignar(IN p_idempotency_key uuid, IN p_id_cuenta_destino bigint, IN p_monto numeric, IN p_usuario_operador integer, OUT p_id_transaccion bigint); Type: ACL; Schema: banco_core; Owner: postgres
--

GRANT ALL ON PROCEDURE banco_core.sp_consignar(IN p_idempotency_key uuid, IN p_id_cuenta_destino bigint, IN p_monto numeric, IN p_usuario_operador integer, OUT p_id_transaccion bigint) TO banco_cajero_role;


--
-- Name: PROCEDURE sp_retirar(IN p_idempotency_key uuid, IN p_id_cuenta_origen bigint, IN p_monto numeric, IN p_usuario_operador integer, OUT p_id_transaccion bigint); Type: ACL; Schema: banco_core; Owner: postgres
--

GRANT ALL ON PROCEDURE banco_core.sp_retirar(IN p_idempotency_key uuid, IN p_id_cuenta_origen bigint, IN p_monto numeric, IN p_usuario_operador integer, OUT p_id_transaccion bigint) TO banco_cajero_role;


--
-- Name: PROCEDURE sp_transferir(IN p_idempotency_key uuid, IN p_id_cuenta_origen bigint, IN p_id_cuenta_destino bigint, IN p_monto numeric, IN p_usuario_operador integer, OUT p_id_transaccion bigint); Type: ACL; Schema: banco_core; Owner: postgres
--

GRANT ALL ON PROCEDURE banco_core.sp_transferir(IN p_idempotency_key uuid, IN p_id_cuenta_origen bigint, IN p_id_cuenta_destino bigint, IN p_monto numeric, IN p_usuario_operador integer, OUT p_id_transaccion bigint) TO banco_cajero_role;


--
-- Name: TABLE auditoria_operacion; Type: ACL; Schema: banco_audit; Owner: postgres
--

GRANT SELECT ON TABLE banco_audit.auditoria_operacion TO banco_auditor_role;
GRANT SELECT ON TABLE banco_audit.auditoria_operacion TO rol_auditor;


--
-- Name: TABLE resultado_quality_gate; Type: ACL; Schema: banco_audit; Owner: postgres
--

GRANT SELECT ON TABLE banco_audit.resultado_quality_gate TO rol_auditor;


--
-- Name: TABLE asiento_contable; Type: ACL; Schema: banco_core; Owner: postgres
--

GRANT SELECT ON TABLE banco_core.asiento_contable TO banco_auditor_role;
GRANT SELECT ON TABLE banco_core.asiento_contable TO rol_consulta;
GRANT SELECT,INSERT,UPDATE ON TABLE banco_core.asiento_contable TO rol_operativo;
GRANT SELECT ON TABLE banco_core.asiento_contable TO rol_auditor;


--
-- Name: SEQUENCE asiento_contable_id_asiento_seq; Type: ACL; Schema: banco_core; Owner: postgres
--

GRANT SELECT,USAGE ON SEQUENCE banco_core.asiento_contable_id_asiento_seq TO rol_operativo;


--
-- Name: TABLE cliente; Type: ACL; Schema: banco_core; Owner: postgres
--

GRANT SELECT ON TABLE banco_core.cliente TO banco_cajero_role;
GRANT SELECT ON TABLE banco_core.cliente TO banco_auditor_role;
GRANT SELECT ON TABLE banco_core.cliente TO rol_consulta;
GRANT SELECT,INSERT,UPDATE ON TABLE banco_core.cliente TO rol_operativo;
GRANT SELECT ON TABLE banco_core.cliente TO rol_auditor;


--
-- Name: TABLE cliente_contacto; Type: ACL; Schema: banco_core; Owner: postgres
--

GRANT SELECT ON TABLE banco_core.cliente_contacto TO banco_auditor_role;
GRANT SELECT ON TABLE banco_core.cliente_contacto TO rol_consulta;
GRANT SELECT,INSERT,UPDATE ON TABLE banco_core.cliente_contacto TO rol_operativo;
GRANT SELECT ON TABLE banco_core.cliente_contacto TO rol_auditor;


--
-- Name: SEQUENCE cliente_contacto_id_contacto_seq; Type: ACL; Schema: banco_core; Owner: postgres
--

GRANT SELECT,USAGE ON SEQUENCE banco_core.cliente_contacto_id_contacto_seq TO rol_operativo;


--
-- Name: SEQUENCE cliente_id_cliente_seq; Type: ACL; Schema: banco_core; Owner: postgres
--

GRANT SELECT,USAGE ON SEQUENCE banco_core.cliente_id_cliente_seq TO rol_operativo;


--
-- Name: TABLE cuenta; Type: ACL; Schema: banco_core; Owner: postgres
--

GRANT SELECT ON TABLE banco_core.cuenta TO banco_cajero_role;
GRANT SELECT ON TABLE banco_core.cuenta TO banco_auditor_role;
GRANT SELECT ON TABLE banco_core.cuenta TO rol_consulta;
GRANT SELECT,INSERT,UPDATE ON TABLE banco_core.cuenta TO rol_operativo;
GRANT SELECT ON TABLE banco_core.cuenta TO rol_auditor;


--
-- Name: SEQUENCE cuenta_id_cuenta_seq; Type: ACL; Schema: banco_core; Owner: postgres
--

GRANT SELECT,USAGE ON SEQUENCE banco_core.cuenta_id_cuenta_seq TO rol_operativo;


--
-- Name: TABLE cuenta_titular; Type: ACL; Schema: banco_core; Owner: postgres
--

GRANT SELECT ON TABLE banco_core.cuenta_titular TO banco_auditor_role;
GRANT SELECT ON TABLE banco_core.cuenta_titular TO rol_consulta;
GRANT SELECT,INSERT,UPDATE ON TABLE banco_core.cuenta_titular TO rol_operativo;
GRANT SELECT ON TABLE banco_core.cuenta_titular TO rol_auditor;


--
-- Name: TABLE departamento; Type: ACL; Schema: banco_core; Owner: postgres
--

GRANT SELECT ON TABLE banco_core.departamento TO banco_auditor_role;
GRANT SELECT ON TABLE banco_core.departamento TO rol_consulta;
GRANT SELECT ON TABLE banco_core.departamento TO rol_operativo;
GRANT SELECT ON TABLE banco_core.departamento TO rol_auditor;


--
-- Name: SEQUENCE departamento_id_departamento_seq; Type: ACL; Schema: banco_core; Owner: postgres
--

GRANT SELECT,USAGE ON SEQUENCE banco_core.departamento_id_departamento_seq TO rol_operativo;


--
-- Name: TABLE estado_cliente; Type: ACL; Schema: banco_core; Owner: postgres
--

GRANT SELECT ON TABLE banco_core.estado_cliente TO banco_auditor_role;
GRANT SELECT ON TABLE banco_core.estado_cliente TO rol_consulta;
GRANT SELECT ON TABLE banco_core.estado_cliente TO rol_operativo;
GRANT SELECT ON TABLE banco_core.estado_cliente TO rol_auditor;


--
-- Name: TABLE estado_cuenta; Type: ACL; Schema: banco_core; Owner: postgres
--

GRANT SELECT ON TABLE banco_core.estado_cuenta TO banco_auditor_role;
GRANT SELECT ON TABLE banco_core.estado_cuenta TO rol_consulta;
GRANT SELECT ON TABLE banco_core.estado_cuenta TO rol_operativo;
GRANT SELECT ON TABLE banco_core.estado_cuenta TO rol_auditor;


--
-- Name: TABLE estado_transaccion; Type: ACL; Schema: banco_core; Owner: postgres
--

GRANT SELECT ON TABLE banco_core.estado_transaccion TO banco_auditor_role;
GRANT SELECT ON TABLE banco_core.estado_transaccion TO rol_consulta;
GRANT SELECT ON TABLE banco_core.estado_transaccion TO rol_operativo;
GRANT SELECT ON TABLE banco_core.estado_transaccion TO rol_auditor;


--
-- Name: TABLE evento_cuenta; Type: ACL; Schema: banco_core; Owner: postgres
--

GRANT SELECT ON TABLE banco_core.evento_cuenta TO banco_auditor_role;
GRANT SELECT ON TABLE banco_core.evento_cuenta TO rol_consulta;
GRANT SELECT,INSERT,UPDATE ON TABLE banco_core.evento_cuenta TO rol_operativo;
GRANT SELECT ON TABLE banco_core.evento_cuenta TO rol_auditor;


--
-- Name: SEQUENCE evento_cuenta_id_evento_seq; Type: ACL; Schema: banco_core; Owner: postgres
--

GRANT SELECT,USAGE ON SEQUENCE banco_core.evento_cuenta_id_evento_seq TO rol_operativo;


--
-- Name: TABLE historico_representante_legal; Type: ACL; Schema: banco_core; Owner: postgres
--

GRANT SELECT ON TABLE banco_core.historico_representante_legal TO banco_auditor_role;
GRANT SELECT ON TABLE banco_core.historico_representante_legal TO rol_consulta;
GRANT SELECT ON TABLE banco_core.historico_representante_legal TO rol_operativo;
GRANT SELECT ON TABLE banco_core.historico_representante_legal TO rol_auditor;


--
-- Name: SEQUENCE historico_representante_legal_id_historico_rep_seq; Type: ACL; Schema: banco_core; Owner: postgres
--

GRANT SELECT,USAGE ON SEQUENCE banco_core.historico_representante_legal_id_historico_rep_seq TO rol_operativo;


--
-- Name: TABLE municipio; Type: ACL; Schema: banco_core; Owner: postgres
--

GRANT SELECT ON TABLE banco_core.municipio TO banco_auditor_role;
GRANT SELECT ON TABLE banco_core.municipio TO rol_consulta;
GRANT SELECT ON TABLE banco_core.municipio TO rol_operativo;
GRANT SELECT ON TABLE banco_core.municipio TO rol_auditor;


--
-- Name: SEQUENCE municipio_id_municipio_seq; Type: ACL; Schema: banco_core; Owner: postgres
--

GRANT SELECT,USAGE ON SEQUENCE banco_core.municipio_id_municipio_seq TO rol_operativo;


--
-- Name: TABLE transaccion; Type: ACL; Schema: banco_core; Owner: postgres
--

GRANT SELECT ON TABLE banco_core.transaccion TO banco_auditor_role;
GRANT SELECT ON TABLE banco_core.transaccion TO rol_consulta;
GRANT SELECT,INSERT,UPDATE ON TABLE banco_core.transaccion TO rol_operativo;
GRANT SELECT ON TABLE banco_core.transaccion TO rol_auditor;


--
-- Name: TABLE mv_volumen_mensual_posted; Type: ACL; Schema: banco_core; Owner: postgres
--

GRANT SELECT ON TABLE banco_core.mv_volumen_mensual_posted TO rol_consulta;
GRANT SELECT ON TABLE banco_core.mv_volumen_mensual_posted TO rol_operativo;
GRANT SELECT ON TABLE banco_core.mv_volumen_mensual_posted TO rol_auditor;


--
-- Name: TABLE oficina; Type: ACL; Schema: banco_core; Owner: postgres
--

GRANT SELECT ON TABLE banco_core.oficina TO banco_auditor_role;
GRANT SELECT ON TABLE banco_core.oficina TO rol_consulta;
GRANT SELECT ON TABLE banco_core.oficina TO rol_operativo;
GRANT SELECT ON TABLE banco_core.oficina TO rol_auditor;


--
-- Name: SEQUENCE oficina_id_oficina_seq; Type: ACL; Schema: banco_core; Owner: postgres
--

GRANT SELECT,USAGE ON SEQUENCE banco_core.oficina_id_oficina_seq TO rol_operativo;


--
-- Name: TABLE persona_juridica; Type: ACL; Schema: banco_core; Owner: postgres
--

GRANT SELECT ON TABLE banco_core.persona_juridica TO banco_auditor_role;
GRANT SELECT ON TABLE banco_core.persona_juridica TO rol_consulta;
GRANT SELECT,INSERT,UPDATE ON TABLE banco_core.persona_juridica TO rol_operativo;
GRANT SELECT ON TABLE banco_core.persona_juridica TO rol_auditor;


--
-- Name: TABLE persona_natural; Type: ACL; Schema: banco_core; Owner: postgres
--

GRANT SELECT ON TABLE banco_core.persona_natural TO banco_auditor_role;
GRANT SELECT ON TABLE banco_core.persona_natural TO rol_consulta;
GRANT SELECT,INSERT,UPDATE ON TABLE banco_core.persona_natural TO rol_operativo;
GRANT SELECT ON TABLE banco_core.persona_natural TO rol_auditor;


--
-- Name: TABLE plan_cuentas; Type: ACL; Schema: banco_core; Owner: postgres
--

GRANT SELECT ON TABLE banco_core.plan_cuentas TO banco_auditor_role;
GRANT SELECT ON TABLE banco_core.plan_cuentas TO rol_consulta;
GRANT SELECT ON TABLE banco_core.plan_cuentas TO rol_operativo;
GRANT SELECT ON TABLE banco_core.plan_cuentas TO rol_auditor;


--
-- Name: TABLE producto; Type: ACL; Schema: banco_core; Owner: postgres
--

GRANT SELECT ON TABLE banco_core.producto TO banco_cajero_role;
GRANT SELECT ON TABLE banco_core.producto TO banco_auditor_role;
GRANT SELECT ON TABLE banco_core.producto TO rol_consulta;
GRANT SELECT ON TABLE banco_core.producto TO rol_operativo;
GRANT SELECT ON TABLE banco_core.producto TO rol_auditor;


--
-- Name: SEQUENCE producto_id_producto_seq; Type: ACL; Schema: banco_core; Owner: postgres
--

GRANT SELECT,USAGE ON SEQUENCE banco_core.producto_id_producto_seq TO rol_operativo;


--
-- Name: TABLE tipo_documento; Type: ACL; Schema: banco_core; Owner: postgres
--

GRANT SELECT ON TABLE banco_core.tipo_documento TO banco_auditor_role;
GRANT SELECT ON TABLE banco_core.tipo_documento TO rol_consulta;
GRANT SELECT ON TABLE banco_core.tipo_documento TO rol_operativo;
GRANT SELECT ON TABLE banco_core.tipo_documento TO rol_auditor;


--
-- Name: TABLE tipo_evento_cuenta; Type: ACL; Schema: banco_core; Owner: postgres
--

GRANT SELECT ON TABLE banco_core.tipo_evento_cuenta TO banco_auditor_role;
GRANT SELECT ON TABLE banco_core.tipo_evento_cuenta TO rol_consulta;
GRANT SELECT ON TABLE banco_core.tipo_evento_cuenta TO rol_operativo;
GRANT SELECT ON TABLE banco_core.tipo_evento_cuenta TO rol_auditor;


--
-- Name: TABLE tipo_transaccion; Type: ACL; Schema: banco_core; Owner: postgres
--

GRANT SELECT ON TABLE banco_core.tipo_transaccion TO banco_auditor_role;
GRANT SELECT ON TABLE banco_core.tipo_transaccion TO rol_consulta;
GRANT SELECT ON TABLE banco_core.tipo_transaccion TO rol_operativo;
GRANT SELECT ON TABLE banco_core.tipo_transaccion TO rol_auditor;


--
-- Name: SEQUENCE transaccion_id_transaccion_seq; Type: ACL; Schema: banco_core; Owner: postgres
--

GRANT SELECT,USAGE ON SEQUENCE banco_core.transaccion_id_transaccion_seq TO rol_operativo;


--
-- Name: TABLE v_secuencial; Type: ACL; Schema: banco_core; Owner: postgres
--

GRANT SELECT ON TABLE banco_core.v_secuencial TO banco_auditor_role;
GRANT SELECT ON TABLE banco_core.v_secuencial TO rol_consulta;
GRANT SELECT ON TABLE banco_core.v_secuencial TO rol_operativo;
GRANT SELECT ON TABLE banco_core.v_secuencial TO rol_auditor;


--
-- Name: TABLE vw_reconciliacion_saldos; Type: ACL; Schema: banco_core; Owner: postgres
--

GRANT SELECT ON TABLE banco_core.vw_reconciliacion_saldos TO banco_auditor_role;
GRANT SELECT ON TABLE banco_core.vw_reconciliacion_saldos TO rol_consulta;
GRANT SELECT ON TABLE banco_core.vw_reconciliacion_saldos TO rol_operativo;
GRANT SELECT ON TABLE banco_core.vw_reconciliacion_saldos TO rol_auditor;


--
-- Name: TABLE vw_resumen_cliente; Type: ACL; Schema: banco_core; Owner: postgres
--

GRANT SELECT ON TABLE banco_core.vw_resumen_cliente TO banco_auditor_role;
GRANT SELECT ON TABLE banco_core.vw_resumen_cliente TO rol_consulta;
GRANT SELECT ON TABLE banco_core.vw_resumen_cliente TO rol_operativo;
GRANT SELECT ON TABLE banco_core.vw_resumen_cliente TO rol_auditor;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: banco_audit; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA banco_audit GRANT SELECT ON TABLES TO rol_auditor;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: banco_core; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA banco_core GRANT SELECT,USAGE ON SEQUENCES TO rol_operativo;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: banco_core; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA banco_core GRANT SELECT ON TABLES TO rol_consulta;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA banco_core GRANT SELECT,INSERT,UPDATE ON TABLES TO rol_operativo;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA banco_core GRANT SELECT ON TABLES TO rol_auditor;


--
-- PostgreSQL database dump complete
--

\unrestrict 6DzTlZ2u7UCghuJVI8EaDX32LKRxvYsaYlxiKYxQYnC2AzfBcoD3cZrqL2mQxgD

