SET search_path TO banco_core, public;

@delimiter /;

CREATE OR REPLACE FUNCTION banco_core.fn_validar_doble_partida(p_id_transaccion BIGINT)
RETURNS BOOLEAN
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
/

CREATE OR REPLACE FUNCTION banco_core.fn_generar_numero_cuenta(p_id_oficina INT, p_id_producto INT)
RETURNS VARCHAR
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
/

@delimiter ;/

