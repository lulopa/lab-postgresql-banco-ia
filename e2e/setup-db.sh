#!/usr/bin/env bash
# Crea una base DE PRUEBA (nunca la real) con tu estructura + catálogos mínimos + sql/010_bff_soporte.sql.
# Uso: PGHOST=localhost PGUSER=postgres PGPASSWORD=... bash e2e/setup-db.sh
set -euo pipefail
DB="${E2E_DB:-banco_e2e}"
ESTRUCTURA="${ESTRUCTURA_SQL:-banco_andino_estructura.sql}"
case "$DB" in *e2e*|*test*) ;; *) echo "E2E_DB debe contener 'e2e' o 'test' (seguridad)"; exit 1;; esac
psql -v ON_ERROR_STOP=1 -d postgres -c "DROP DATABASE IF EXISTS $DB" -c "CREATE DATABASE $DB"
psql -v ON_ERROR_STOP=1 -d "$DB" <<'SQL'
DO $$ DECLARE r text; BEGIN
  FOREACH r IN ARRAY ARRAY['rol_consulta','rol_operativo','rol_auditor','rol_admin','banco_admin_role','banco_cajero_role','banco_auditor_role'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('CREATE ROLE %I NOLOGIN', r); END IF;
  END LOOP; END $$;
SQL
psql -q -d "$DB" -f "$ESTRUCTURA" 2>&1 | grep -i "error" | grep -v "transaction_timeout" || true
psql -q -v ON_ERROR_STOP=1 -d "$DB" -f e2e/seed.sql
psql -q -v ON_ERROR_STOP=1 -d "$DB" -f sql/010_bff_soporte.sql 2>&1 | grep -v NOTICE || true
echo "Base $DB lista."
