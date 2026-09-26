SET search_path TO banco_core, public; 
 
CREATE TABLE IF NOT EXISTS banco_core.departamento ( 
    id_departamento INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY, 
    codigo_dane VARCHAR(5) NOT NULL UNIQUE, 
    nombre VARCHAR(100) NOT NULL 
); 
COMMENT ON TABLE banco_core.departamento IS 'Catálogo oficial de departamentos según DANE'; 
 
CREATE TABLE IF NOT EXISTS banco_core.municipio ( 
    id_municipio INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY, 
    id_departamento INT NOT NULL REFERENCES banco_core.departamento(id_departamento), 
    codigo_dane VARCHAR(5) NOT NULL UNIQUE, 
    nombre VARCHAR(100) NOT NULL 
); 
COMMENT ON TABLE banco_core.municipio IS 'Catálogo oficial de municipios colombianos'; 
 
CREATE TABLE IF NOT EXISTS banco_core.oficina ( 
    id_oficina INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY, 
    id_municipio INT NOT NULL REFERENCES banco_core.municipio(id_municipio), 
    codigo_oficina VARCHAR(10) NOT NULL UNIQUE, 
    nombre VARCHAR(100) NOT NULL, 
    direccion VARCHAR(200) NOT NULL, 
    activa BOOLEAN NOT NULL DEFAULT TRUE 
); 
COMMENT ON TABLE banco_core.oficina IS 'Red de oficinas físicas del Banco Andino Colombia'; 
 
-- Datos semilla geográfica 
INSERT INTO banco_core.departamento (codigo_dane, nombre) VALUES 
('11', 'Bogotá D.C.'), ('05', 'Antioquia'), ('76', 'Valle del Cauca'), ('08', 'Atlántico') 
ON CONFLICT (codigo_dane) DO NOTHING; 
 
INSERT INTO banco_core.municipio (id_departamento, codigo_dane, nombre) VALUES 
((SELECT id_departamento FROM banco_core.departamento WHERE codigo_dane='11'), '11001', 'Bogotá D.C.'), 
((SELECT id_departamento FROM banco_core.departamento WHERE codigo_dane='05'), '05001', 'Medellín'), 
((SELECT id_departamento FROM banco_core.departamento WHERE codigo_dane='76'), '76001', 'Cali'), 
((SELECT id_departamento FROM banco_core.departamento WHERE codigo_dane='08'), '08001', 'Barranquilla') 
ON CONFLICT (codigo_dane) DO NOTHING; 
 
INSERT INTO banco_core.oficina (id_municipio, codigo_oficina, nombre, direccion) VALUES 
((SELECT id_municipio FROM banco_core.municipio WHERE codigo_dane='11001'), 'OFC-001', 'Oficina Principal Centro', 'Carrera 7 # 14-23, Bogotá'), 
((SELECT id_municipio FROM banco_core.municipio WHERE codigo_dane='05001'), 'OFC-002', 'Oficina El Poblado', 'Calle 10 # 43A-12, Medellín'), 
((SELECT id_municipio FROM banco_core.municipio WHERE codigo_dane='76001'), 'OFC-003', 'Oficina Plaza Caicedo', 'Carrera 4 # 11-35, Cali'), 
((SELECT id_municipio FROM banco_core.municipio WHERE codigo_dane='08001'), 'OFC-004', 'Oficina Paseo Bolívar', 'Calle 34 # 45-10, Barranquilla') 
ON CONFLICT (codigo_oficina) DO NOTHING; 
 --