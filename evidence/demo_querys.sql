-- query 1:
SELECT 
    c.codigo_cliente, 
    pn.numero_documento, 
    CONCAT_WS(' ', pn.primer_nombre, pn.segundo_nombre, pn.primer_apellido, pn.segundo_apellido) AS nombre_completo 
FROM banco_core.cliente c 
INNER JOIN banco_core.estado_cliente ec 
    ON c.id_estado_cliente = ec.id_estado_cliente 
INNER JOIN banco_core.persona_natural pn 
    ON c.id_cliente = pn.id_cliente 
WHERE ec.codigo = 'ACTIVO' 
  AND c.tipo_cliente = 'NATURAL';

--query 2
SELECT 
    ec.codigo, 
    ec.descripcion, 
    COUNT(c.id_cuenta) AS total_cuentas 
FROM banco_core.estado_cuenta ec 
LEFT JOIN banco_core.cuenta c 
    ON ec.id_estado_cuenta = c.id_estado_cuenta 
GROUP BY ec.codigo, ec.descripcion 
ORDER BY total_cuentas DESC; 

--query 3
SELECT 
    c.numero_cuenta, 
    c.limite_sobregiro, 
    p.nombre
FROM banco_core.cuenta c 
INNER JOIN banco_core.producto p 
    ON c.id_producto = p.id_producto 
WHERE p.tipo_producto = 'CORRIENTE' 
  AND c.limite_sobregiro > 0.00 
ORDER BY c.limite_sobregiro DESC;

--query 4
SELECT 
    t.id_transaccion, 
    tt.nombre AS tipo_transaccion, 
    t.monto, 
    t.fecha_transaccion 
FROM banco_core.transaccion t 
INNER JOIN banco_core.tipo_transaccion tt 
    ON t.id_tipo_transaccion = tt.id_tipo_transaccion 
INNER JOIN banco_core.estado_transaccion et 
    ON t.id_estado_transaccion = et.id_estado_transaccion 
WHERE et.codigo = 'POSTED' 
  AND t.fecha_transaccion >= '2026-01-01 00:00:00-05' 
  AND t.fecha_transaccion < '2026-02-01 00:00:00-05' 
ORDER BY t.fecha_transaccion ASC; 

--query 5
SELECT 
    o.codigo_oficina, 
    o.nombre AS nombre_oficina, 
    o.direccion, 
    m.nombre AS nombre_municipio, 
    d.nombre AS nombre_departamento 
FROM banco_core.oficina o 
INNER JOIN banco_core.municipio m 
    ON o.id_municipio = m.id_municipio 
INNER JOIN banco_core.departamento d 
    ON m.id_departamento = d.id_departamento 
ORDER BY d.nombre ASC, m.nombre ASC, o.nombre ASC; 

--query 6
SELECT 
    ROUND(AVG(t.monto), 2) AS monto_promedio, 
    MAX(t.monto) AS monto_maximo 
FROM banco_core.transaccion t 
INNER JOIN banco_core.tipo_transaccion tt 
    ON t.id_tipo_transaccion = tt.id_tipo_transaccion 
INNER JOIN banco_core.estado_transaccion et 
    ON t.id_estado_transaccion = et.id_estado_transaccion 
WHERE tt.codigo = 'CONSIGNACION' 
  AND et.codigo = 'POSTED'; 

--query 7
SELECT DISTINCT ON (cc.id_cliente) 
    c.codigo_cliente, 
    cc.direccion_residencia, 
    cc.telefono_principal, 
    cc.correo_electronico 
FROM banco_core.cliente c 
INNER JOIN banco_core.cliente_contacto cc 
    ON c.id_cliente = cc.id_cliente 
WHERE cc.es_principal IS TRUE 
ORDER BY cc.id_cliente, cc.id_contacto DESC; 

--query 8
SELECT 
    COUNT(c.id_cuenta) AS total_cuentas_oficina_principal 
FROM banco_core.cuenta c 
INNER JOIN banco_core.oficina o 
    ON c.id_oficina_apertura = o.id_oficina 
WHERE o.codigo_oficina = 'OFC-001';

--query 9
SELECT 
    t.id_transaccion, 
    t.idempotency_key, 
    t.monto, 
    t.fecha_transaccion 
FROM banco_core.transaccion t 
INNER JOIN banco_core.estado_transaccion et 
    ON t.id_estado_transaccion = et.id_estado_transaccion 
WHERE et.codigo = 'POSTED' 
  AND t.monto > 10000000.00 
ORDER BY t.monto DESC;

---query 10
SELECT 
    tec.codigo, 
    tec.nombre AS tipo_evento, 
    COUNT(ec.id_evento) AS total_eventos 
FROM banco_core.tipo_evento_cuenta tec 
LEFT JOIN banco_core.evento_cuenta ec 
    ON tec.id_tipo_evento = ec.id_tipo_evento 
GROUP BY tec.codigo, tec.nombre 
ORDER BY total_eventos DESC;

---query 11
WITH cuentas_unicas_cliente AS ( 
    SELECT DISTINCT 
        ct.id_cliente, 
        c.id_cuenta, 
        c.saldo_disponible 
    FROM banco_core.cuenta_titular ct 
    INNER JOIN banco_core.cuenta c 
        ON ct.id_cuenta = c.id_cuenta 
    INNER JOIN banco_core.estado_cuenta ec 
        ON c.id_estado_cuenta = ec.id_estado_cuenta 
    WHERE ec.codigo = 'ACTIVA' 
) 
SELECT 
    cl.codigo_cliente, 
    COALESCE(SUM(cuc.saldo_disponible), 0.00) AS saldo_total_consolidado 
FROM banco_core.cliente cl 
LEFT JOIN cuentas_unicas_cliente cuc 
    ON cl.id_cliente = cuc.id_cliente 
GROUP BY cl.id_cliente, cl.codigo_cliente 
ORDER BY saldo_total_consolidado DESC; 

---query 12
SELECT 
    c.codigo_cliente, 
    COUNT(ct.id_cuenta) AS cantidad_cuentas 
FROM banco_core.cliente c 
INNER JOIN banco_core.cuenta_titular ct 
    ON c.id_cliente = ct.id_cliente 
INNER JOIN banco_core.cuenta cu 
    ON ct.id_cuenta = cu.id_cuenta 
INNER JOIN banco_core.estado_cuenta ec 
    ON cu.id_estado_cuenta = ec.id_estado_cuenta 
WHERE ec.codigo = 'ACTIVA' 
  AND ct.activo IS TRUE 
GROUP BY c.id_cliente, c.codigo_cliente 
HAVING COUNT(ct.id_cuenta) > 3 
ORDER BY cantidad_cuentas DESC

--query 13
SELECT 
    c.id_cuenta, 
    c.numero_cuenta, 
    c.fecha_apertura 
FROM banco_core.cuenta c 
INNER JOIN banco_core.estado_cuenta ec 
    ON c.id_estado_cuenta = ec.id_estado_cuenta 
WHERE ec.codigo = 'ACTIVA' 
  AND NOT EXISTS ( 
      SELECT 1 
      FROM banco_core.transaccion t 
      WHERE t.id_cuenta_origen = c.id_cuenta 
         OR t.id_cuenta_destino = c.id_cuenta 
  ) 
ORDER BY c.fecha_apertura ASC;

---query 14
Ajustando los nombres de atributos d_origen.nombre y d_destino.nombre, e incluyendo el filtro de estado POSTED: 

SELECT 
    t.id_transaccion, 
    t.monto, 
    d_origen.nombre AS departamento_origen, 
    d_destino.nombre AS departamento_destino, 
    t.fecha_transaccion 
FROM banco_core.transaccion t 
INNER JOIN banco_core.estado_transaccion et 
    ON t.id_estado_transaccion = et.id_estado_transaccion 
 
-- Cadena de navegación ORIGEN 
INNER JOIN banco_core.cuenta c_origen 
    ON t.id_cuenta_origen = c_origen.id_cuenta 
INNER JOIN banco_core.oficina o_origen 
    ON c_origen.id_oficina_apertura = o_origen.id_oficina 
INNER JOIN banco_core.municipio m_origen 
    ON o_origen.id_municipio = m_origen.id_municipio 
INNER JOIN banco_core.departamento d_origen 
    ON m_origen.id_departamento = d_origen.id_departamento 
 
-- Cadena de navegación DESTINO 
INNER JOIN banco_core.cuenta c_destino 
    ON t.id_cuenta_destino = c_destino.id_cuenta 
INNER JOIN banco_core.oficina o_destino 
    ON c_destino.id_oficina_apertura = o_destino.id_oficina 
INNER JOIN banco_core.municipio m_destino 
    ON o_destino.id_municipio = m_destino.id_municipio 
INNER JOIN banco_core.departamento d_destino 
    ON m_destino.id_departamento = d_destino.id_departamento 
 
WHERE et.codigo = 'POSTED' 
  AND d_origen.id_departamento <> d_destino.id_departamento 
ORDER BY t.monto DESC; 

--query 15
SELECT  
   puc.codigo_cuenta_puc,  
   puc.nombre_cuenta,  
   COALESCE(SUM(CASE WHEN ac.tipo_movimiento = 'DEBITO' THEN ac.monto ELSE 0.00 END), 0.00) AS total_debito,  
   COALESCE(SUM(CASE WHEN ac.tipo_movimiento = 'CREDITO' THEN ac.monto ELSE 0.00 END), 0.00) AS total_credito,  
   COALESCE(  
       SUM(CASE WHEN ac.tipo_movimiento = 'DEBITO' THEN ac.monto ELSE 0.00 END) -  
       SUM(CASE WHEN ac.tipo_movimiento = 'CREDITO' THEN ac.monto ELSE 0.00 END),  
       0.00  
   ) AS saldo_neto  
FROM banco_core.plan_cuentas puc  
LEFT JOIN banco_core.asiento_contable ac  
   ON puc.codigo_cuenta_puc = ac.codigo_cuenta_puc 
GROUP BY puc.tipo_cuenta, puc.codigo_cuenta_puc, puc.nombre_cuenta 
ORDER BY puc.codigo_cuenta_puc ASC;

---query 16
SELECT 
    pj.nit, 
    pj.razon_social, 
    pn.numero_documento AS cedula_representante_legal, 
    CONCAT_WS(' ', pn.primer_nombre, pn.segundo_nombre, pn.primer_apellido, pn.segundo_apellido) AS nombre_representante_legal, 
    hrl.fecha_inicio 
FROM banco_core.persona_juridica pj 
INNER JOIN banco_core.historico_representante_legal hrl 
    ON pj.id_cliente = hrl.id_cliente_juridico
INNER JOIN banco_core.persona_natural pn 
    ON hrl.id_cliente_natural_rep = pn.id_cliente 
WHERE hrl.activo IS TRUE 
  AND (hrl.fecha_fin IS NULL OR hrl.fecha_fin >= CURRENT_DATE) 
ORDER BY pj.razon_social ASC;

---query 17
SELECT 
    m.nombre AS municipio, 
    d.nombre AS departamento, 
    SUM(t.monto) AS volumen_total_transaccionado 
FROM banco_core.transaccion t 
INNER JOIN banco_core.cuenta c 
    ON t.id_cuenta_origen = c.id_cuenta 
INNER JOIN banco_core.oficina o 
    ON c.id_oficina_apertura = o.id_oficina 
INNER JOIN banco_core.municipio m 
    ON o.id_municipio = m.id_municipio 
INNER JOIN banco_core.departamento d 
    ON m.id_departamento = d.id_departamento 
INNER JOIN banco_core.estado_transaccion et 
    ON t.id_estado_transaccion = et.id_estado_transaccion 
WHERE et.codigo = 'POSTED' 
GROUP BY m.id_municipio, m.nombre, d.nombre 
ORDER BY volumen_total_transaccionado DESC 
LIMIT 5; 

---query 18
WITH bloqueos_cuenta AS ( 
    SELECT 
        ec.id_cuenta, 
        COUNT(ec.id_evento) AS cantidad_bloqueos 
    FROM banco_core.evento_cuenta ec 
    INNER JOIN banco_core.tipo_evento_cuenta tec 
        ON ec.id_tipo_evento = tec.id_tipo_evento 
    WHERE tec.codigo IN ('BLOQUEO_PARCIAL', 'BLOQUEO_TOTAL') 
    GROUP BY ec.id_cuenta 
    HAVING COUNT(ec.id_evento) > 1 
) 
SELECT 
    c.numero_cuenta, 
    bc.cantidad_bloqueos 
FROM bloqueos_cuenta bc 
INNER JOIN banco_core.cuenta c 
    ON bc.id_cuenta = c.id_cuenta 
ORDER BY bc.cantidad_bloqueos DESC;

--query 19
SELECT 
    TO_CHAR(DATE_TRUNC('month', ac.fecha_contable), 'YYYY-MM') AS anio_mes, 
    COALESCE(SUM(ac.monto), 0.00) AS total_ingresos_comisiones 
FROM banco_core.asiento_contable ac 
INNER JOIN banco_core.plan_cuentas puc 
    ON ac.codigo_cuenta_puc = puc.codigo_cuenta_puc
WHERE puc.codigo_cuenta_puc = '413505' 
  AND ac.tipo_movimiento = 'CREDITO' 
GROUP BY DATE_TRUNC('month', ac.fecha_contable) 
ORDER BY DATE_TRUNC('month', ac.fecha_contable) ASC; 

---query 20
WITH saldo_ledger AS ( 
    SELECT 
        t.id_cuenta_origen AS id_cuenta, 
        SUM(CASE WHEN ac.tipo_movimiento = 'CREDITO' THEN ac.monto ELSE -ac.monto END) AS saldo_calculado 
    FROM banco_core.asiento_contable ac 
    INNER JOIN banco_core.transaccion t 
        ON ac.id_transaccion = t.id_transaccion
    GROUP BY t.id_cuenta_origen
) 
SELECT 
    c.id_cuenta, 
    c.numero_cuenta, 
    c.saldo_disponible AS saldo_persistido, 
    COALESCE(sl.saldo_calculado, 0.00) AS saldo_ledger, 
    (c.saldo_disponible - COALESCE(sl.saldo_calculado, 0.00)) AS diferencia 
FROM banco_core.cuenta c 
LEFT JOIN saldo_ledger sl 
    ON c.id_cuenta = sl.id_cuenta
WHERE (c.saldo_disponible - COALESCE(sl.saldo_calculado, 0.00)) <> 0.00 
ORDER BY ABS(c.saldo_disponible - COALESCE(sl.saldo_calculado, 0.00)) DESC;

--query 21
WITH patrimonio_cliente AS ( 
    SELECT 
        cl.id_cliente, 
        cl.codigo_cliente, 
        d.nombre AS departamento, 
        SUM(c.saldo_disponible) AS saldo_total 
    FROM banco_core.cliente cl 
    INNER JOIN banco_core.cuenta_titular ct 
        ON cl.id_cliente = ct.id_cliente 
    INNER JOIN banco_core.cuenta c 
        ON ct.id_cuenta = c.id_cuenta 
    INNER JOIN banco_core.estado_cuenta ec 
        ON c.id_estado_cuenta = ec.id_estado_cuenta 
    INNER JOIN banco_core.oficina o 
        ON c.id_oficina_apertura = o.id_oficina 
    INNER JOIN banco_core.municipio m 
        ON o.id_municipio = m.id_municipio 
    INNER JOIN banco_core.departamento d 
        ON m.id_departamento = d.id_departamento 
    WHERE ec.codigo = 'ACTIVA' 
      AND ct.activo IS TRUE 
    GROUP BY cl.id_cliente, cl.codigo_cliente, d.id_departamento, d.nombre 
) 
SELECT 
    departamento, 
    codigo_cliente, 
    saldo_total, 
    DENSE_RANK() OVER ( 
        PARTITION BY departamento 
        ORDER BY saldo_total DESC 
    ) AS posicion_ranking 
FROM patrimonio_cliente 
ORDER BY departamento ASC, posicion_ranking ASC; 

---query 22
SELECT 
    ac.codigo_cuenta_puc, 
    t.id_transaccion, 
    ac.fecha_contable, 
    ac.tipo_movimiento, 
    ac.monto, 
    SUM(CASE WHEN ac.tipo_movimiento = 'CREDITO' THEN ac.monto ELSE -ac.monto END) OVER ( 
        PARTITION BY ac.codigo_cuenta_puc 
        ORDER BY ac.fecha_contable ASC, t.id_transaccion ASC 
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW 
    ) AS saldo_acumulado 
FROM banco_core.asiento_contable ac 
INNER JOIN banco_core.transaccion t 
    ON ac.id_transaccion = t.id_transaccion 
ORDER BY ac.codigo_cuenta_puc ASC, ac.fecha_contable ASC, t.id_transaccion ASC;

---query 23
SELECT 
    PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY t.monto) AS percentil_50_mediana, 
    PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY t.monto) AS percentil_90, 
    PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY t.monto) AS percentil_99 
FROM banco_core.transaccion t 
INNER JOIN banco_core.estado_transaccion et 
    ON t.id_estado_transaccion = et.id_estado_transaccion 
WHERE et.codigo = 'POSTED'; 

---query 24
WITH saldos_cliente AS ( 
    SELECT 
        cl.id_cliente, 
        cl.fecha_vinculacion, 
        COALESCE(SUM(c.saldo_disponible), 0.00) AS saldo_actual 
    FROM banco_core.cliente cl 
    LEFT JOIN banco_core.cuenta_titular ct 
        ON cl.id_cliente = ct.id_cliente AND ct.activo IS TRUE 
    LEFT JOIN banco_core.cuenta c 
        ON ct.id_cuenta = c.id_cuenta 
    LEFT JOIN banco_core.estado_cuenta ec 
        ON c.id_estado_cuenta = ec.id_estado_cuenta AND ec.codigo = 'ACTIVA' 
    GROUP BY cl.id_cliente, cl.fecha_vinculacion 
) 
SELECT 
    TO_CHAR(DATE_TRUNC('month', fecha_vinculacion), 'YYYY-MM') AS cohorte_vinculacion, 
    COUNT(id_cliente) AS cantidad_clientes, 
    ROUND(AVG(saldo_actual), 2) AS saldo_promedio_actual 
FROM saldos_cliente 
GROUP BY DATE_TRUNC('month', fecha_vinculacion) 
ORDER BY cohorte_vinculacion ASC; 

---query 25
WITH transacciones_previas AS ( 
    SELECT 
        t.id_transaccion, 
        t.id_cuenta_origen, 
        t.monto, 
        t.fecha_transaccion, 
        LAG(t.fecha_transaccion) OVER ( 
            PARTITION BY t.id_cuenta_origen 
            ORDER BY t.fecha_transaccion ASC 
        ) AS fecha_transaccion_anterior 
    FROM banco_core.transaccion t 
    INNER JOIN banco_core.estado_transaccion et 
        ON t.id_estado_transaccion = et.id_estado_transaccion 
    WHERE et.codigo = 'POSTED' 
      AND t.id_cuenta_origen IS NOT NULL 
) 
SELECT 
    id_transaccion, 
    id_cuenta_origen, 
    monto, 
    fecha_transaccion, 
    fecha_transaccion_anterior, 
    EXTRACT(EPOCH FROM (fecha_transaccion - fecha_transaccion_anterior)) AS segundos_diferencia 
FROM transacciones_previas 
WHERE fecha_transaccion_anterior IS NOT NULL 
  AND EXTRACT(EPOCH FROM (fecha_transaccion - fecha_transaccion_anterior)) < 300 
ORDER BY id_cuenta_origen ASC, fecha_transaccion ASC;

---query 26
WITH umbral_p90 AS ( 
    SELECT PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY t.monto) AS valor_p90 
    FROM banco_core.transaccion t 
    INNER JOIN banco_core.estado_transaccion et 
        ON t.id_estado_transaccion = et.id_estado_transaccion 
    WHERE et.codigo = 'POSTED' 
), 
historial_transacciones AS ( 
    SELECT 
        t.id_cuenta_origen AS id_cuenta, 
        t.id_transaccion, 
        t.fecha_transaccion, 
        t.monto, 
        LAG(t.fecha_transaccion) OVER ( 
            PARTITION BY t.id_cuenta_origen 
            ORDER BY t.fecha_transaccion ASC 
        ) AS fecha_anterior 
    FROM banco_core.transaccion t 
    INNER JOIN banco_core.estado_transaccion et 
        ON t.id_estado_transaccion = et.id_estado_transaccion 
    WHERE et.codigo = 'POSTED' 
      AND t.id_cuenta_origen IS NOT NULL 
) 
SELECT 
    ht.id_cuenta, 
    ht.fecha_transaccion AS fecha_transaccion_actual, 
    ht.fecha_anterior AS fecha_transaccion_previa, 
    EXTRACT(DAY FROM (ht.fecha_transaccion - ht.fecha_anterior)) AS dias_inactividad, 
    ht.monto 
FROM historial_transacciones ht 
CROSS JOIN umbral_p90 u 
WHERE ht.fecha_anterior IS NOT NULL 
  AND (ht.fecha_transaccion - ht.fecha_anterior) > INTERVAL '180 days' 
  AND ht.monto > u.valor_p90 
ORDER BY dias_inactividad DESC, ht.monto DESC; 

---query 27
WITH volumen_mensual AS ( 
    SELECT 
        DATE_TRUNC('month', t.fecha_transaccion) AS mes_fecha, 
        SUM(t.monto) AS volumen_actual 
    FROM banco_core.transaccion t 
    INNER JOIN banco_core.estado_transaccion et 
        ON t.id_estado_transaccion = et.id_estado_transaccion 
    WHERE et.codigo = 'POSTED' 
    GROUP BY DATE_TRUNC('month', t.fecha_transaccion) 
), 
volumen_comparativo AS ( 
    SELECT 
        mes_fecha, 
        volumen_actual, 
        LAG(volumen_actual) OVER (ORDER BY mes_fecha) AS volumen_anterior 
    FROM volumen_mensual 
) 
SELECT 
    TO_CHAR(mes_fecha, 'YYYY-MM') AS anio_mes, 
    volumen_actual, 
    COALESCE(volumen_anterior, 0.00) AS volumen_anterior, 
    ROUND( 
        CASE 
            WHEN volumen_anterior IS NULL OR volumen_anterior = 0 THEN NULL 
            ELSE ((volumen_actual - volumen_anterior) / volumen_anterior) * 100.0 
        END, 2 
    ) AS variacion_porcentual_mom 
FROM volumen_comparativo 
ORDER BY mes_fecha ASC; 

---query 28
SELECT 
    ao.id_auditoria, 
    ao.fecha_hora, 
    ao.operacion, 
    ao.datos_nuevos->>'id_transaccion' AS id_transaccion, 
    ao.datos_nuevos->>'moneda' AS moneda_registrada, 
    ao.datos_nuevos
FROM banco_audit.auditoria_operacion ao 
WHERE (ao.datos_nuevos->>'moneda') IS NOT NULL 
  AND (ao.datos_nuevos->>'moneda') <> 'COP' 
ORDER BY ao.fecha_hora DESC;

---query 29
WITH cliente_cuentas AS ( 
    SELECT id_cuenta 
    FROM banco_core.cuenta_titular 
    WHERE id_cliente = 1001 -- ID de cliente parametrizable 
) 
SELECT 
    ec.fecha_hora AS fecha, 
    'EVENTO' AS tipo_registro, 
    COALESCE(tec.nombre, ec.motivo) AS descripcion, 
    NULL::NUMERIC AS monto 
FROM banco_core.evento_cuenta ec 
INNER JOIN banco_core.tipo_evento_cuenta tec 
    ON ec.id_tipo_evento = tec.id_tipo_evento 
WHERE ec.id_cuenta IN (SELECT id_cuenta FROM cliente_cuentas) 

UNION ALL 

SELECT 
    t.fecha_transaccion AS fecha, 
    'TRANSACCION' AS tipo_registro, 
    tt.nombre AS descripcion, 
    t.monto AS monto 
FROM banco_core.transaccion t 
INNER JOIN banco_core.tipo_transaccion tt 
    ON t.id_tipo_transaccion = tt.id_tipo_transaccion 
WHERE t.id_cuenta_origen IN (SELECT id_cuenta FROM cliente_cuentas) 
   OR t.id_cuenta_destino IN (SELECT id_cuenta FROM cliente_cuentas) 

ORDER BY fecha ASC;

---query 30
SELECT 
    d_origen.nombre AS departamento_origen, 
    SUM(CASE WHEN d_destino.nombre = 'Bogotá D.C.' THEN t.monto ELSE 0.00 END) AS bogota_dc, 
    SUM(CASE WHEN d_destino.nombre = 'Antioquia' THEN t.monto ELSE 0.00 END) AS antioquia, 
    SUM(CASE WHEN d_destino.nombre = 'Valle del Cauca' THEN t.monto ELSE 0.00 END) AS valle_del_cauca, 
    SUM(CASE WHEN d_destino.nombre = 'Atlántico' THEN t.monto ELSE 0.00 END) AS atlantico 
FROM banco_core.transaccion t 
INNER JOIN banco_core.cuenta c_origen 
    ON t.id_cuenta_origen = c_origen.id_cuenta 
INNER JOIN banco_core.oficina o_origen 
    ON c_origen.id_oficina_apertura = o_origen.id_oficina 
INNER JOIN banco_core.municipio m_origen 
    ON o_origen.id_municipio = m_origen.id_municipio 
INNER JOIN banco_core.departamento d_origen 
    ON m_origen.id_departamento = d_origen.id_departamento 
 
INNER JOIN banco_core.cuenta c_destino 
    ON t.id_cuenta_destino = c_destino.id_cuenta 
INNER JOIN banco_core.oficina o_destino 
    ON c_destino.id_oficina_apertura = o_destino.id_oficina 
INNER JOIN banco_core.municipio m_destino 
    ON o_destino.id_municipio = m_destino.id_municipio 
INNER JOIN banco_core.departamento d_destino 
    ON m_destino.id_departamento = d_destino.id_departamento 
 
INNER JOIN banco_core.estado_transaccion et 
    ON t.id_estado_transaccion = et.id_estado_transaccion 
WHERE et.codigo = 'POSTED' 
GROUP BY d_origen.id_departamento, d_origen.nombre 
ORDER BY d_origen.nombre ASC; 
  