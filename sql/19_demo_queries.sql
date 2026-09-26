SET search_path TO banco_core, banco_audit, public;
SELECT
 c.numero_cuenta,
 rc.nombre_o_razon_social AS titular_principal,
 p.nombre AS producto,
 ec.codigo AS estado,
 c.saldo_disponible
FROM banco_core.cuenta c
JOIN banco_core.cuenta_titular ct ON c.id_cuenta = ct.id_cuenta AND
ct.tipo_titularidad = 'PRINCIPAL'
JOIN banco_core.vw_resumen_cliente rc ON ct.id_cliente =
rc.id_cliente
JOIN banco_core.producto p ON c.id_producto = p.id_producto
JOIN banco_core.estado_cuenta ec ON c.id_estado_cuenta =
ec.id_estado_cuenta
WHERE c.id_estado_cuenta = 2;
SELECT * FROM banco_core.vw_reconciliacion_saldos WHERE diferencia
!= 0.00;
SELECT
 t.id_transaccion,
 t.fecha_transaccion,
 tt.nombre AS tipo_operación,
 t.monto,
 et.codigo AS estado,
 ac.num_linea,
 ac.codigo_cuenta_puc,
 ac.tipo_movimiento
FROM banco_core.transaccion t
JOIN banco_core.tipo_transaccion tt ON t.id_tipo_transaccion =
tt.id_tipo_transaccion
JOIN banco_core.estado_transaccion et ON t.id_estado_transaccion =
et.id_estado_transaccion
JOIN banco_core.asiento_contable ac ON t.id_transaccion =
ac.id_transaccion
ORDER BY t.id_transaccion DESC, ac.num_linea ASC;