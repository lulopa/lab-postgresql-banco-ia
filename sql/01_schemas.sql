CREATE SCHEMA IF NOT EXISTS banco_core; 
CREATE SCHEMA IF NOT EXISTS banco_audit; 
CREATE SCHEMA IF NOT EXISTS banco_security; 
 
COMMENT ON SCHEMA banco_core IS 'Esquema principal con el modelo transaccional OLTP, geografía, clientes, cuentas y ledger'; 
COMMENT ON SCHEMA banco_audit IS 'Esquema aislado para tablas y logs de auditoría inmutable'; 
COMMENT ON SCHEMA banco_security IS 'Esquema para la gestión RBAC de usuarios internos, roles y permisos'; 
 
SET search_path TO banco_core, banco_security, banco_audit, public; 
