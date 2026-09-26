@delimiter /;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'banco_admin_role') THEN 
        CREATE ROLE banco_admin_role; 
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'banco_cajero_role') THEN 
        CREATE ROLE banco_cajero_role; 
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'banco_auditor_role') THEN 
        CREATE ROLE banco_auditor_role; 
    END IF;
END $$;
/

@delimiter ;/

-- Asignación de permisos de uso sobre esquemas
GRANT USAGE ON SCHEMA banco_core TO banco_cajero_role, banco_auditor_role, banco_admin_role;
GRANT USAGE ON SCHEMA banco_audit TO banco_auditor_role, banco_admin_role;

-- Permisos del Rol Cajero (Mínimo Privilegio: Consulta limitada y ejecución de procedimientos de ventanilla)
GRANT SELECT ON banco_core.cuenta, banco_core.cliente, banco_core.producto TO banco_cajero_role;
GRANT EXECUTE ON PROCEDURE banco_core.sp_consignar, banco_core.sp_retirar, banco_core.sp_transferir TO banco_cajero_role;

-- Permisos del Rol Auditor (Solo lectura en tablas operativas y de auditoría)
GRANT SELECT ON ALL TABLES IN SCHEMA banco_core TO banco_auditor_role;
GRANT SELECT ON ALL TABLES IN SCHEMA banco_audit TO banco_auditor_role;

-- Permisos del Rol Administrador
GRANT ALL ON SCHEMA banco_core TO banco_admin_role;
GRANT ALL ON SCHEMA banco_security TO banco_admin_role;