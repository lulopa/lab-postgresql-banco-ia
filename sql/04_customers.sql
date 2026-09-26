SET search_path TO banco_core, public; 
 
CREATE TABLE IF NOT EXISTS banco_core.cliente ( 
    id_cliente BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY, 
    codigo_cliente VARCHAR(20) NOT NULL UNIQUE, 
    tipo_cliente VARCHAR(10) NOT NULL CHECK (tipo_cliente IN ('NATURAL', 'JURIDICA')), 
    id_oficina_vinculacion INT NOT NULL REFERENCES banco_core.oficina(id_oficina), 
    id_estado_cliente INT NOT NULL REFERENCES banco_core.estado_cliente(id_estado_cliente), 
    fecha_vinculacion TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP 
); 
COMMENT ON TABLE banco_core.cliente IS 'Entidad principal maestra de clientes vinculados'; 
 
CREATE TABLE IF NOT EXISTS banco_core.persona_natural ( 
    id_cliente BIGINT PRIMARY KEY REFERENCES banco_core.cliente(id_cliente) ON DELETE RESTRICT, 
    id_tipo_documento INT NOT NULL REFERENCES banco_core.tipo_documento(id_tipo_documento), 
    numero_documento VARCHAR(20) NOT NULL, 
    primer_nombre VARCHAR(50) NOT NULL, 
    segundo_nombre VARCHAR(50), 
    primer_apellido VARCHAR(50) NOT NULL, 
    segundo_apellido VARCHAR(50), 
    fecha_nacimiento DATE NOT NULL, 
    CONSTRAINT uk_persona_natural_doc UNIQUE (id_tipo_documento, numero_documento) 
); 
COMMENT ON TABLE banco_core.persona_natural IS 'Extensión de atributos de clientes Persona Natural'; 
 
CREATE TABLE IF NOT EXISTS banco_core.persona_juridica ( 
    id_cliente BIGINT PRIMARY KEY REFERENCES banco_core.cliente(id_cliente) ON DELETE RESTRICT, 
    nit VARCHAR(20) NOT NULL UNIQUE, 
    razon_social VARCHAR(150) NOT NULL 
); 
COMMENT ON TABLE banco_core.persona_juridica IS 'Extensión de atributos de clientes Persona Jurídica'; 
 
CREATE TABLE IF NOT EXISTS banco_core.historico_representante_legal ( 
    id_historico_rep BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY, 
    id_cliente_juridico BIGINT NOT NULL REFERENCES banco_core.persona_juridica(id_cliente), 
    id_cliente_natural_rep BIGINT NOT NULL REFERENCES banco_core.persona_natural(id_cliente), 
    fecha_inicio DATE NOT NULL, 
    fecha_fin DATE, 
    activo BOOLEAN NOT NULL DEFAULT TRUE, 
    CONSTRAINT chk_fechas_rep CHECK (fecha_fin IS NULL OR fecha_fin >= fecha_inicio) 
); 
 
CREATE TABLE IF NOT EXISTS banco_core.cliente_contacto ( 
    id_contacto BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY, 
    id_cliente BIGINT NOT NULL REFERENCES banco_core.cliente(id_cliente), 
    id_municipio INT NOT NULL REFERENCES banco_core.municipio(id_municipio), 
    direccion_residencia VARCHAR(200) NOT NULL, 
    telefono_principal VARCHAR(20) NOT NULL, 
    correo_electronico VARCHAR(100) NOT NULL, 
    es_principal BOOLEAN NOT NULL DEFAULT TRUE 
); 
 --