SET search_path TO banco_security, banco_core, public;
CREATE TABLE IF NOT EXISTS banco_security.usuario_interno (
 id_usuario INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 username VARCHAR(50) NOT NULL UNIQUE,
 email VARCHAR(100) NOT NULL UNIQUE,
 id_oficina INT NOT NULL REFERENCES
banco_core.oficina(id_oficina),
 activo BOOLEAN NOT NULL DEFAULT TRUE
);
ALTER TABLE banco_core.evento_cuenta
 ADD CONSTRAINT fk_evento_cuenta_usuario
 FOREIGN KEY (id_usuario_interno) REFERENCES
banco_security.usuario_interno(id_usuario);
CREATE TABLE IF NOT EXISTS banco_security.rol (
 id_rol INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 nombre VARCHAR(50) NOT NULL UNIQUE,
 descripcion VARCHAR(150)
);
CREATE TABLE IF NOT EXISTS banco_security.permiso (
 id_permiso INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 codigo VARCHAR(50) NOT NULL UNIQUE,
 descripcion VARCHAR(150)
);
CREATE TABLE IF NOT EXISTS banco_security.usuario_rol (
 id_usuario INT NOT NULL REFERENCES
banco_security.usuario_interno(id_usuario),
 id_rol INT NOT NULL REFERENCES banco_security.rol(id_rol),
 PRIMARY KEY (id_usuario, id_rol)
);
CREATE TABLE IF NOT EXISTS banco_security.rol_permiso (
 id_rol INT NOT NULL REFERENCES banco_security.rol(id_rol),
 id_permiso INT NOT NULL REFERENCES
banco_security.permiso(id_permiso),
 PRIMARY KEY (id_rol, id_permiso)
);
INSERT INTO banco_security.rol (nombre, descripcion) VALUES
('ADMINISTRADOR', 'Administrador total del sistema core'),
('CAJERO', 'Operador de ventanilla para depósitos y retiros'),
('ANALISTA_RIESGO', 'Analista facultado para bloqueos y
sobregiros'),
('AUDITOR', 'Auditor de solo lectura y revisión de trazabilidad')
ON CONFLICT (nombre) DO NOTHING;
INSERT INTO banco_security.permiso (codigo, descripcion) VALUES
('PERM_CLIENTE_CREAR', 'Facultad para aperturar clientes'),
('PERM_CUENTA_OPERAR', 'Facultad para ejecutar transacciones
financieras'),
('PERM_CUENTA_BLOQUEAR', 'Facultad para aplicar bloqueos
administrativos'),
('PERM_AUDITORIA_CONSULTAR', 'Acceso a logs inmutables de
auditoría')
ON CONFLICT (codigo) DO NOTHING;
--
==================================