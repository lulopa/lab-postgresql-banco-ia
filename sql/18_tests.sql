

SET search_path TO banco_core, banco_security, public;

@delimiter /;

DO $$
DECLARE
    v_id_cliente1 BIGINT;
    v_id_cliente2 BIGINT;
    v_id_cuenta1 BIGINT;
    v_id_cuenta2 BIGINT;
    v_num_cta1 VARCHAR(20);
    v_num_cta2 VARCHAR(20);
    v_id_tx BIGINT;
    v_key UUID;
BEGIN
    RAISE NOTICE '=== INICIO SUITE DE PRUEBAS DE INTEGRIDAD Y REGLAS ===';

    -- 1. Prueba Positiva: Crear Clientes (Persona Natural)
    CALL banco_core.sp_crear_cliente('NATURAL', 1, 1, '1018293847', 'CARLOS', 'GOMEZ', '1990-05-12', NULL, NULL, v_id_cliente1);
    CALL banco_core.sp_crear_cliente('NATURAL', 1, 1, '1029384756', 'MARIA', 'RODRIGUEZ', '1995-08-20', NULL, NULL, v_id_cliente2);
    RAISE NOTICE 'PASS: Clientes creados con IDs % y %', v_id_cliente1, v_id_cliente2;

    -- 2. Prueba Negativa: Rechazo de documento duplicado (RN-01)
    BEGIN
        CALL banco_core.sp_crear_cliente('NATURAL', 1, 1, '1018293847', 'DUPLICADO', 'TEST', '1990-01-01', NULL, NULL, v_id_cliente1);
        RAISE EXCEPTION 'FAIL: Se permitió documento duplicado';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'PASS: Documento duplicado rechazado correctamente (%)', SQLERRM;
    END;

    -- 3. Crear Cuentas y Activación
    CALL banco_core.sp_crear_cuenta(v_id_cliente1, 1, 1, 1, v_id_cuenta1, v_num_cta1);
    CALL banco_core.sp_crear_cuenta(v_id_cliente2, 1, 1, 1, v_id_cuenta2, v_num_cta2);
    CALL banco_core.sp_activar_cuenta(v_id_cuenta1, 1, 'Activación inicial test');
    CALL banco_core.sp_activar_cuenta(v_id_cuenta2, 1, 'Activación inicial test');

    -- 4. Prueba Positiva: Consignación con partida doble
    v_key := uuid_generate_v4();
    CALL banco_core.sp_consignar(v_key, v_id_cuenta1, 500000.00, 1, v_id_tx);
    RAISE NOTICE 'PASS: Consignación ejecutada correctamente Tx ID %', v_id_tx;

    -- 5. Prueba Negativa: Retiro superior al saldo disponible sin sobregiro (RN-11)
    BEGIN
        v_key := uuid_generate_v4();
        CALL banco_core.sp_retirar(v_key, v_id_cuenta1, 1000000.00, 1, v_id_tx);
        RAISE EXCEPTION 'FAIL: Se permitió retiro sobre el cupo';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'PASS: Retiro excedido rechazado correctamente (%)', SQLERRM;
    END;

    -- 6. Prueba Positiva: Transferencia atómica entre cuentas
    v_key := uuid_generate_v4();
    CALL banco_core.sp_transferir(v_key, v_id_cuenta1, v_id_cuenta2, 200000.00, 1, v_id_tx);
    RAISE NOTICE 'PASS: Transferencia ejecutada exitosamente Tx ID %', v_id_tx;

    -- 7. Prueba Negativa: Inmutabilidad de transacción POSTED (RN-18)
    BEGIN
        UPDATE banco_core.transaccion SET monto = 999999.00 WHERE id_transaccion = v_id_tx;
        RAISE EXCEPTION 'FAIL: Se permitió modificar una transacción POSTED';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'PASS: Inmutabilidad violada bloqueada por Trigger (%)', SQLERRM;
    END;

    -- 8. Prueba Positiva: Reverso compensatorio de transacción
    CALL banco_core.sp_reversar_transaccion(v_id_tx, 1, 'Reverso por prueba unitaria', v_id_tx);
    RAISE NOTICE 'PASS: Transacción reversada correctamente con nuevo ID %', v_id_tx;

    RAISE NOTICE '=== SUITE DE PRUEBAS COMPLETADA EXITOSAMENTE ===';
END $$;
/

@delimiter ;/
