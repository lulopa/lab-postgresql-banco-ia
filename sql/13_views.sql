SET search_path TO banco_core, public;
CREATE OR REPLACE VIEW banco_core.vw_resumen_cliente AS
SELECT
 c.id_cliente,
 c.codigo_cliente,
 c.tipo_cliente,
 ec.codigo AS estado_cliente,
 COALESCE(pn.numero_documento, pj.nit) AS identificacion_oficial,
 COALESCE(pn.primer_nombre || ' ' || pn.primer_apellido,
pj.razon_social) AS nombre_o_razon_social,
 o.nombre AS oficina_vinculacion,
 c.fecha_vinculacion
FROM banco_core.cliente c
JOIN banco_core.estado_cliente ec ON c.id_estado_cliente =
ec.id_estado_cliente
JOIN banco_core.oficina o ON c.id_oficina_vinculacion = o.id_oficina
LEFT JOIN banco_core.persona_natural pn ON c.id_cliente =
pn.id_cliente
LEFT JOIN banco_core.persona_juridica pj ON c.id_cliente =
pj.id_cliente;
CREATE OR REPLACE VIEW banco_core.vw_reconciliacion_saldos AS
WITH calculo_ledger AS (
 SELECT
 c.id_cuenta,
 SUM(
 CASE
 WHEN ac.tipo_movimiento = 'CREDITO' THEN ac.monto
 WHEN ac.tipo_movimiento = 'DEBITO' THEN -ac.monto
 ELSE 0.00
 END
 ) AS saldo_calculado_ledger
 FROM banco_core.cuenta c
 LEFT JOIN banco_core.transaccion t ON (c.id_cuenta =
t.id_cuenta_origen OR c.id_cuenta = t.id_cuenta_destino) AND
t.id_estado_transaccion = 2
 LEFT JOIN banco_core.asiento_contable ac ON t.id_transaccion =
ac.id_transaccion
 AND ac.codigo_cuenta_puc IN ('210505', '210510')
 GROUP BY c.id_cuenta
)
SELECT
 c.id_cuenta,
 c.numero_cuenta,
 c.saldo_disponible AS saldo_persistido,
 COALESCE(cl.saldo_calculado_ledger, 0.00) AS saldo_ledger,
 (c.saldo_disponible - COALESCE(cl.saldo_calculado_ledger, 0.00))
AS diferencia
FROM banco_core.cuenta c
LEFT JOIN calculo_ledger cl ON c.id_cuenta = cl.id_cuenta;