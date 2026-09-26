SET search_path TO banco_core, public;
ALTER TABLE banco_core.cuenta DROP CONSTRAINT IF EXISTS
chk_saldo_disponible_minimo;
ALTER TABLE banco_core.cuenta ADD CONSTRAINT
chk_saldo_disponible_minimo
 CHECK (saldo_disponible >= -limite_sobregiro);
COMMENT ON CONSTRAINT chk_saldo_disponible_minimo ON
banco_core.cuenta
 IS 'Garantiza que el saldo disponible no supere el límite de
sobregiro autorizado';
