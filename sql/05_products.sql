============================================================================= 
 
SET search_path TO banco_core, public; 
 
CREATE TABLE IF NOT EXISTS banco_core.producto ( 
    id_producto INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY, 
    codigo_producto VARCHAR(10) NOT NULL UNIQUE, 
    nombre VARCHAR(50) NOT NULL, 
    tipo_producto VARCHAR(20) NOT NULL CHECK (tipo_producto IN ('AHORROS', 'CORRIENTE', 'NOMINA')) 
); 
COMMENT ON TABLE banco_core.producto IS 'Catálogo de productos financieros del banco'; 
 
INSERT INTO banco_core.producto (codigo_producto, nombre, tipo_producto) VALUES 
('PRD-AH01', 'Cuenta de Ahorros Tradicional', 'AHORROS'), 
('PRD-CC01', 'Cuenta Corriente Empresarial', 'CORRIENTE'), 
('PRD-NOM1', 'Cuenta Nómina Preferencial', 'NOMINA'), 
('PRD-AH02', 'Cuenta de Ahorro Digital', 'AHORROS') 
ON CONFLICT (codigo_producto) DO NOTHING;