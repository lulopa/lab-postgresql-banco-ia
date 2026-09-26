SET search_path TO banco_core, public; 
 
CREATE TABLE IF NOT EXISTS banco_core.estado_cliente ( 
    id_estado_cliente INT PRIMARY KEY, 
    codigo VARCHAR(20) NOT NULL UNIQUE, 
    descripcion VARCHAR(100) NOT NULL 
); 
COMMENT ON TABLE banco_core.estado_cliente IS 'Catálogo oficial de estados del ciclo de vida del cliente'; 
 
CREATE TABLE IF NOT EXISTS banco_core.tipo_documento ( 
    id_tipo_documento INT PRIMARY KEY, 
    codigo VARCHAR(10) NOT NULL UNIQUE, 
    nombre VARCHAR(50) NOT NULL 
); 
COMMENT ON TABLE banco_core.tipo_documento IS 'Tipos de documento de identidad oficial en Colombia'; 
 
CREATE TABLE IF NOT EXISTS banco_core.estado_cuenta ( 
    id_estado_cuenta INT PRIMARY KEY, 
    codigo VARCHAR(25) NOT NULL UNIQUE, 
    descripcion VARCHAR(100) NOT NULL 
); 
COMMENT ON TABLE banco_core.estado_cuenta IS 'Estados posibles en el ciclo de vida de una cuenta bancaria'; 
 
CREATE TABLE IF NOT EXISTS banco_core.tipo_evento_cuenta ( 
    id_tipo_evento INT PRIMARY KEY, 
    codigo VARCHAR(30) NOT NULL UNIQUE, 
    nombre VARCHAR(100) NOT NULL 
); 
COMMENT ON TABLE banco_core.tipo_evento_cuenta IS 'Catálogo de eventos administrativos sobre el contrato de cuenta'; 
 
CREATE TABLE IF NOT EXISTS banco_core.tipo_transaccion ( 
    id_tipo_transaccion INT PRIMARY KEY, 
    codigo VARCHAR(20) NOT NULL UNIQUE, 
    nombre VARCHAR(50) NOT NULL 
); 
COMMENT ON TABLE banco_core.tipo_transaccion IS 'Tipos de operaciones financieras reconocidas en el core'; 
 
CREATE TABLE IF NOT EXISTS banco_core.estado_transaccion ( 
    id_estado_transaccion INT PRIMARY KEY, 
    codigo VARCHAR(20) NOT NULL UNIQUE, 
    descripcion VARCHAR(100) NOT NULL 
); 
COMMENT ON TABLE banco_core.estado_transaccion IS 'Ciclo de vida transaccional financiero'; 
 
-- Poblado de datos maestros de catálogos 
INSERT INTO banco_core.estado_cliente (id_estado_cliente, codigo, descripcion) VALUES 
(1, 'PROSPECTO', 'Cliente en proceso de vinculación y validación de listas'), 
(2, 'ACTIVO', 'Cliente totalmente vinculado y habilitado para operar'), 
(3, 'INACTIVO', 'Cliente sin productos activos'), 
(4, 'BLOQUEADO', 'Cliente bloqueado por prevención de fraude o riesgo legal'), 
(5, 'RETIRADO', 'Relación comercial finalizada') 
ON CONFLICT (id_estado_cliente) DO NOTHING; 
 
INSERT INTO banco_core.tipo_documento (id_tipo_documento, codigo, nombre) VALUES 
(1, 'CC', 'Cédula de Ciudadanía'), 
(2, 'CE', 'Cédula de Extranjería'), 
(3, 'PAS', 'Pasaporte'), 
(4, 'NIT', 'Número de Identificación Tributaria') 
ON CONFLICT (id_tipo_documento) DO NOTHING; 
 
INSERT INTO banco_core.estado_cuenta (id_estado_cuenta, codigo, descripcion) VALUES 
(1, 'PENDIENTE_ACTIVACION', 'Cuenta aperturada pendiente de fondeo inicial'), 
(2, 'ACTIVA', 'Cuenta operando normalmente'), 
(3, 'BLOQUEADA_PARCIAL', 'Bloqueados débitos/retiros; créditos permitidos'), 
(4, 'BLOQUEADA_TOTAL', 'Bloqueados débitos y créditos por medida judicial o fraude'), 
(5, 'INACTIVA', 'Sin movimientos financieros por más de 6 meses'), 
(6, 'CERRADA', 'Cuenta cancelada definitivamente con saldo 0.00') 
ON CONFLICT (id_estado_cuenta) DO NOTHING; 
 
INSERT INTO banco_core.tipo_evento_cuenta (id_tipo_evento, codigo, nombre) VALUES 
(1, 'APERTURA', 'Apertura e inicialización de cuenta'), 
(2, 'ACTIVACION', 'Activación operativa de la cuenta'), 
(3, 'BLOQUEO_PARCIAL', 'Bloqueo preventivo de débitos'), 
(4, 'BLOQUEO_TOTAL', 'Bloqueo total administrativo/judicial'), 
(5, 'DESBLOQUEO', 'Levantamiento de medidas de bloqueo'), 
(6, 'CAMBIO_LIMITE', 'Modificación de límite de sobregiro o cupo'), 
(7, 'CIERRE', 'Cancelación y cierre definitivo de cuenta') 
ON CONFLICT (id_tipo_evento) DO NOTHING; 
 
INSERT INTO banco_core.tipo_transaccion (id_tipo_transaccion, codigo, nombre) VALUES 
(1, 'CONSIGNACION', 'Consignación o depósito en efectivo/cheque'), 
(2, 'RETIRO', 'Retiro de efectivo en oficina o cajero'), 
(3, 'TRANSFERENCIA', 'Transferencia de fondos entre cuentas'), 
(4, 'DEBITO_NOTAS', 'Débito bancario por comisión o cobro'), 
(5, 'CREDITO_NOTAS', 'Crédito bancario por ajuste a favor'), 
(6, 'REVERSO', 'Operación compensatoria de anulación') 
ON CONFLICT (id_tipo_transaccion) DO NOTHING; 
 
INSERT INTO banco_core.estado_transaccion (id_estado_transaccion, codigo, descripcion) VALUES 
(1, 'PENDING', 'Transacción recibida en proceso de validación'), 
(2, 'POSTED', 'Transacción contabilizada e inmutable en ledger'), 
(3, 'REJECTED', 'Transacción rechazada por regla de negocio o fondos'), 
(4, 'REVERSED', 'Transacción cuya efectividad ha sido anulada mediante reverso') 
ON CONFLICT (id_estado_transaccion) DO NOTHING; 
 -- ============================================================================= 
-- Archivo: 03_geography.sql 
-- Propósito: División político-administrativa DANE y red de oficinas 
-- ============================================================================= 
