SET search_path TO banco_core, public;
CREATE TABLE IF NOT EXISTS banco_core.plan_cuentas (
 codigo_cuenta_puc VARCHAR(20) PRIMARY KEY,
 nombre_cuenta VARCHAR(150) NOT NULL,
 tipo_cuenta VARCHAR(20) NOT NULL CHECK (tipo_cuenta IN
('ACTIVO', 'PASIVO', 'PATRIMONIO', 'INGRESO', 'GASTO'))
);
CREATE TABLE IF NOT EXISTS banco_core.asiento_contable (
 id_asiento BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 id_transaccion BIGINT NOT NULL REFERENCES
banco_core.transaccion(id_transaccion) ON DELETE RESTRICT,
 num_linea INT NOT NULL,
 codigo_cuenta_puc VARCHAR(20) NOT NULL REFERENCES
banco_core.plan_cuentas(codigo_cuenta_puc),
 tipo_movimiento VARCHAR(10) NOT NULL CHECK (tipo_movimiento IN
('DEBITO', 'CREDITO')),
 monto NUMERIC(18,2) NOT NULL CHECK (monto > 0.00),
 fecha_contable TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT uk_asiento_linea UNIQUE (id_transaccion, num_linea)
);
INSERT INTO banco_core.plan_cuentas (codigo_cuenta_puc,
nombre_cuenta, tipo_cuenta) VALUES
('110505', 'Caja General / Ventanilla', 'ACTIVO'),
('111005', 'Bancos Nacionales - Central', 'ACTIVO'),
('210505', 'Cuentas de Ahorros - Clientes', 'PASIVO'),
('210510', 'Cuentas Corrientes - Clientes', 'PASIVO'),
('413505', 'Ingresos por Comisiones Bancarias', 'INGRESO'),
('510505', 'Gastos Intereses Cuentas Corrientes', 'GASTO')
ON CONFLICT (codigo_cuenta_puc) DO NOTHING;
