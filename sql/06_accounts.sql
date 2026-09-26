SET search_path TO banco_core, public;
CREATE TABLE IF NOT EXISTS banco_core.cuenta (
 id_cuenta BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 numero_cuenta VARCHAR(20) NOT NULL UNIQUE,
 id_producto INT NOT NULL REFERENCES
banco_core.producto(id_producto),
 id_oficina_apertura INT NOT NULL REFERENCES
banco_core.oficina(id_oficina),
 id_estado_cuenta INT NOT NULL REFERENCES
banco_core.estado_cuenta(id_estado_cuenta),
 moneda VARCHAR(3) NOT NULL DEFAULT 'COP',
 saldo_disponible NUMERIC(18,2) NOT NULL DEFAULT 0.00,
 saldo_canje NUMERIC(18,2) NOT NULL DEFAULT 0.00,
 limite_sobregiro NUMERIC(18,2) NOT NULL DEFAULT 0.00 CHECK
(limite_sobregiro >= 0.00),
 fecha_apertura TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 fecha_cierre TIMESTAMPTZ,
 CONSTRAINT chk_fechas_cuenta CHECK (fecha_cierre IS NULL OR
fecha_cierre >= fecha_apertura)
);
CREATE TABLE IF NOT EXISTS banco_core.cuenta_titular (
 id_cuenta BIGINT NOT NULL REFERENCES
banco_core.cuenta(id_cuenta),
 id_cliente BIGINT NOT NULL REFERENCES
banco_core.cliente(id_cliente),
 tipo_titularidad VARCHAR(25) NOT NULL CHECK (tipo_titularidad IN
('PRINCIPAL', 'COTITULAR_CONJUNTO', 'COTITULAR_INDISTINTO',
'APODERADO')),
 porcentaje_participacion NUMERIC(5,2) NOT NULL CHECK
(porcentaje_participacion >= 0.00 AND porcentaje_participacion <=
100.00),
 fecha_vinculacion TIMESTAMPTZ NOT NULL DEFAULT
CURRENT_TIMESTAMP,
 fecha_desvinculacion TIMESTAMPTZ,
 activo BOOLEAN NOT NULL DEFAULT TRUE,
 PRIMARY KEY (id_cuenta, id_cliente, fecha_vinculacion)
);
CREATE TABLE IF NOT EXISTS banco_core.evento_cuenta (
 id_evento BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 id_cuenta BIGINT NOT NULL REFERENCES
banco_core.cuenta(id_cuenta),
 id_tipo_evento INT NOT NULL REFERENCES
banco_core.tipo_evento_cuenta(id_tipo_evento),
 id_usuario_interno INT NOT NULL, -- FK diferida
 fecha_hora TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 motivo TEXT NOT NULL,
 id_estado_anterior INT REFERENCES
banco_core.estado_cuenta(id_estado_cuenta),
 id_estado_nuevo INT NOT NULL REFERENCES
banco_core.estado_cuenta(id_estado_cuenta)
);
--