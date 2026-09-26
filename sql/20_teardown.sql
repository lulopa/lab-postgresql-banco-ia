DROP SCHEMA IF EXISTS banco_core CASCADE;
DROP SCHEMA IF EXISTS banco_security CASCADE;
DROP SCHEMA IF EXISTS banco_audit CASCADE;

@delimiter /;

DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'banco_admin_role') THEN 
        DROP ROLE banco_admin_role; 
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'banco_cajero_role') THEN 
        DROP ROLE banco_cajero_role; 
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'banco_auditor_role') THEN 
        DROP ROLE banco_auditor_role; 
    END IF;
END $$;
/

@delimiter ;/
