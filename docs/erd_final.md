#### A. Módulo de Geografía y Estructura Organizacional 
 
- **`departamento`**: 
  - `id_departamento` (INT, NOT NULL, **PK**, Identity) 
  - `codigo_dane` (VARCHAR(5), NOT NULL, **UNIQUE**) 
  - `nombre` (VARCHAR(100), NOT NULL) 
- **`municipio`**: 
  - `id_municipio` (INT, NOT NULL, **PK**, Identity) 
  - `id_departamento` (INT, NOT NULL, **FK** → `departamento.id_departamento`) 
  - `codigo_dane` (VARCHAR(5), NOT NULL, **UNIQUE**) 
  - `nombre` (VARCHAR(100), NOT NULL) 
- **`oficina`**: 
  - `id_oficina` (INT, NOT NULL, **PK**, Identity) 
  - `id_municipio` (INT, NOT NULL, **FK** → `municipio.id_municipio`) 
  - `codigo_oficina` (VARCHAR(10), NOT NULL, **UNIQUE**) 
  - `nombre` (VARCHAR(100), NOT NULL) 
  - `direccion` (VARCHAR(200), NOT NULL) 
  - `activa` (BOOLEAN, NOT NULL, DEFAULT TRUE) 
``` 

```markdown 
#### B. Módulo de Clientes e Identidad (Normalizado en 3FN) 
 
- **`estado_cliente`** *(NUEVO CATÁLOGO)*: 
  - `id_estado_cliente` (INT, NOT NULL, **PK**) 
  - `codigo` (VARCHAR(20), NOT NULL, **UNIQUE**) — *'PROSPECTO', 'ACTIVO', 'INACTIVO', 'BLOQUEADO', 'RETIRADO'* 
  - `descripcion` (VARCHAR(100), NOT NULL) 
- **`tipo_documento`** *(NUEVO CATÁLOGO)*: 
  - `id_tipo_documento` (INT, NOT NULL, **PK**) 
  - `codigo` (VARCHAR(10), NOT NULL, **UNIQUE**) — *'CC', 'CE', 'PAS', 'NIT'* 
  - `nombre` (VARCHAR(50), NOT NULL) 
- **`cliente`**: 
  - `id_cliente` (BIGINT, NOT NULL, **PK**, Identity) 
  - `codigo_cliente` (VARCHAR(20), NOT NULL, **UNIQUE**) 
  - `tipo_cliente` (VARCHAR(10), NOT NULL, **CHECK**: `tipo_cliente IN ('NATURAL', 'JURIDICA')`) 
  - `id_oficina_vinculacion` (INT, NOT NULL, **FK** → `oficina.id_oficina`) 
  - `id_estado_cliente` (INT, NOT NULL, **FK** → `estado_cliente.id_estado_cliente`) *(CORREGIDO)* 
  - `fecha_vinculacion` (TIMESTAMPTZ, NOT NULL) 
- **`persona_natural`**: 
  - `id_cliente` (BIGINT, NOT NULL, **PK**, **FK** → `cliente.id_cliente`) 
  - `id_tipo_documento` (INT, NOT NULL, **FK** → `tipo_documento.id_tipo_documento`) *(CORREGIDO)* 
  - `numero_documento` (VARCHAR(20), NOT NULL) 
  - `primer_nombre` (VARCHAR(50), NOT NULL) 
  - `segundo_nombre` (VARCHAR(50), NULL) 
  - `primer_apellido` (VARCHAR(50), NOT NULL) 
  - `segundo_apellido` (VARCHAR(50), NULL) 
  - `fecha_nacimiento` (DATE, NOT NULL) 
  - **Constraint de Unicidad**: `UNIQUE (id_tipo_documento, numero_documento)` *(CORREGIDO)* 
- **`persona_juridica`**: 
  - `id_cliente` (BIGINT, NOT NULL, **PK**, **FK** → `cliente.id_cliente`) 
  - `nit` (VARCHAR(20), NOT NULL, **UNIQUE**) 
  - `razon_social` (VARCHAR(150), NOT NULL) 
- **`historico_representante_legal`** *(NUEVA ENTIDAD DE HISTORIAL)*: 
  - `id_historico_rep` (BIGINT, NOT NULL, **PK**, Identity) 
  - `id_cliente_juridico` (BIGINT, NOT NULL, **FK** → `persona_juridica.id_cliente`) 
  - `id_cliente_natural_rep` (BIGINT, NOT NULL, **FK** → `persona_natural.id_cliente`) 
  - `fecha_inicio` (DATE, NOT NULL) 
  - `fecha_fin` (DATE, NULL) 
  - `activo` (BOOLEAN, NOT NULL, DEFAULT TRUE) 
- **`cliente_contacto`** *(NUEVA ENTIDAD 3FN)*: 
  - `id_contacto` (BIGINT, NOT NULL, **PK**, Identity) 
  - `id_cliente` (BIGINT, NOT NULL, **FK** → `cliente.id_cliente`) 
  - `id_municipio` (INT, NOT NULL, **FK** → `municipio.id_municipio`) 
  - `direccion_residencia` (VARCHAR(200), NOT NULL) 
  - `telefono_principal` (VARCHAR(20), NOT NULL) 
  - `correo_electronico` (VARCHAR(100), NOT NULL) 
  - `es_principal` (BOOLEAN, NOT NULL, DEFAULT TRUE) 
 
#### C. Módulo de Productos, Cuentas y Titularidad 
 
- **`producto`**: 
  - `id_producto` (INT, NOT NULL, **PK**, Identity) 
  - `codigo_producto` (VARCHAR(10), NOT NULL, **UNIQUE**) 
  - `nombre` (VARCHAR(50), NOT NULL) 
  - `tipo_producto` (VARCHAR(20), NOT NULL, **CHECK**: `tipo_producto IN ('AHORROS', 'CORRIENTE', 'NOMINA')`) 
- **`estado_cuenta`** *(NUEVO CATÁLOGO)*: 
  - `id_estado_cuenta` (INT, NOT NULL, **PK**) 
  - `codigo` (VARCHAR(25), NOT NULL, **UNIQUE**) — *'PENDIENTE_ACTIVACION', 'ACTIVA', 'BLOQUEADA_PARCIAL', 'BLOQUEADA_TOTAL', 'INACTIVA', 'CERRADA'* 
  - `descripcion` (VARCHAR(100), NOT NULL) 
- **`cuenta`**: 
  - `id_cuenta` (BIGINT, NOT NULL, **PK**, Identity) 
  - `numero_cuenta` (VARCHAR(20), NOT NULL, **UNIQUE**) 
  - `id_producto` (INT, NOT NULL, **FK** → `producto.id_producto`) 
  - `id_oficina_apertura` (INT, NOT NULL, **FK** → `oficina.id_oficina`) 
  - `id_estado_cuenta` (INT, NOT NULL, **FK** → `estado_cuenta.id_estado_cuenta`) *(CORREGIDO)* 
  - `moneda` (VARCHAR(3), NOT NULL, DEFAULT 'COP') 
  - `saldo_disponible` (NUMERIC(18,2), NOT NULL, DEFAULT 0.00) 
  - `saldo_canje` (NUMERIC(18,2), NOT NULL, DEFAULT 0.00) 
  - `limite_sobregiro` (NUMERIC(18,2), NOT NULL, DEFAULT 0.00) 
  - `fecha_apertura` (TIMESTAMPTZ, NOT NULL) 
  - `fecha_cierre` (TIMESTAMPTZ, NULL) 
- **`cuenta_titular`** *(CORREGIDO - AUDITORÍA TEMPORAL)*: 
  - `id_cuenta` (BIGINT, NOT NULL, **FK** → `cuenta.id_cuenta`) 
  - `id_cliente` (BIGINT, NOT NULL, **FK** → `cliente.id_cliente`) 
  - `tipo_titularidad` (VARCHAR(25), NOT NULL, **CHECK**: `tipo_titularidad IN ('PRINCIPAL', 'COTITULAR_CONJUNTO', 'COTITULAR_INDISTINTO', 'APODERADO')`) 
  - `porcentaje_participacion` (NUMERIC(5,2), NOT NULL, **CHECK**: `porcentaje_participacion >= 0 AND porcentaje_participacion <= 100`) 
  - `fecha_vinculacion` (TIMESTAMPTZ, NOT NULL) *(NUEVO)* 
  - `fecha_desvinculacion` (TIMESTAMPTZ, NULL) *(NUEVO)* 
  - `activo` (BOOLEAN, NOT NULL, DEFAULT TRUE) *(NUEVO)* 
  - **PK Compuesta**: `PRIMARY KEY (id_cuenta, id_cliente, fecha_vinculacion)` 
``` 

```markdown 
#### D. Ciclo de Vida y Eventos Administrativos 
 
- **`tipo_evento_cuenta`**: 
  - `id_tipo_evento` (INT, NOT NULL, **PK**, Identity) 
  - `codigo` (VARCHAR(30), NOT NULL, **UNIQUE**) — *'APERTURA', 'ACTIVACION', 'BLOQUEO_PARCIAL', 'BLOQUEO_TOTAL', 'DESBLOQUEO', 'CAMBIO_LIMITE', 'CIERRE'* 
  - `nombre` (VARCHAR(100), NOT NULL) 
- **`evento_cuenta`**: 
  - `id_evento` (BIGINT, NOT NULL, **PK**, Identity) 
  - `id_cuenta` (BIGINT, NOT NULL, **FK** → `cuenta.id_cuenta`) 
  - `id_tipo_evento` (INT, NOT NULL, **FK** → `tipo_evento_cuenta.id_tipo_evento`) 
  - `id_usuario_interno` (INT, NOT NULL, **FK** → `usuario_interno.id_usuario`) 
  - `fecha_hora` (TIMESTAMPTZ, NOT NULL) 
  - `motivo` (TEXT, NOT NULL) 
  - `id_estado_anterior` (INT, NULL, **FK** → `estado_cuenta.id_estado_cuenta`) *(CORREGIDO)* 
  - `id_estado_nuevo` (INT, NOT NULL, **FK** → `estado_cuenta.id_estado_cuenta`) *(CORREGIDO)* 
 
#### E. Módulo Transaccional y Contabilidad (Ledger) 
 
- **`tipo_transaccion`**: 
  - `id_tipo_transaccion` (INT, NOT NULL, **PK**, Identity) 
  - `codigo` (VARCHAR(20), NOT NULL, **UNIQUE**) — *'CONSIGNACION', 'RETIRO', 'TRANSFERENCIA', 'DEBITO_NOTAS', 'CREDITO_NOTAS', 'REVERSO'* 
  - `nombre` (VARCHAR(50), NOT NULL) 
- **`estado_transaccion`** *(NUEVO CATÁLOGO)*: 
  - `id_estado_transaccion` (INT, NOT NULL, **PK**) 
  - `codigo` (VARCHAR(20), NOT NULL, **UNIQUE**) — *'PENDING', 'POSTED', 'REJECTED', 'REVERSED'* 
  - `descripcion` (VARCHAR(100), NOT NULL) 
- **`transaccion`**: 
  - `id_transaccion` (BIGINT, NOT NULL, **PK**, Identity) 
  - `idempotency_key` (UUID, NOT NULL, **UNIQUE**) 
  - `id_cuenta_origen` (BIGINT, NULL, **FK** → `cuenta.id_cuenta`) 
  - `id_cuenta_destino` (BIGINT, NULL, **FK** → `cuenta.id_cuenta`) 
  - `id_tipo_transaccion` (INT, NOT NULL, **FK** → `tipo_transaccion.id_tipo_transaccion`) 
  - `id_estado_transaccion` (INT, NOT NULL, **FK** → `estado_transaccion.id_estado_transaccion`) *(CORREGIDO)* 
  - `monto` (NUMERIC(18,2), NOT NULL, **CHECK**: `monto > 0.00`) *(CORREGIDO)* 
  - `moneda` (VARCHAR(3), NOT NULL, DEFAULT 'COP') 
  - `fecha_transaccion` (TIMESTAMPTZ, NOT NULL) 
  - `id_usuario_operador` (INT, NULL, **FK** → `usuario_interno.id_usuario`) 
- **`plan_cuentas`**: 
  - `codigo_cuenta_puc` (VARCHAR(20), NOT NULL, **PK**) 
  - `nombre_cuenta` (VARCHAR(150), NOT NULL) 
  - `tipo_cuenta` (VARCHAR(20), NOT NULL, **CHECK**: `tipo_cuenta IN ('ACTIVO', 'PASIVO', 'PATRIMONIO', 'INGRESO', 'GASTO')`) 
- **`asiento_contable`** *(LEDGER CORREGIDO)*: 
  - `id_asiento` (BIGINT, NOT NULL, **PK**, Identity) 
  - `id_transaccion` (BIGINT, NOT NULL, **FK** → `transaccion.id_transaccion`) 
  - `num_linea` (INT, NOT NULL) 
  - `codigo_cuenta_puc` (VARCHAR(20), NOT NULL, **FK** → `plan_cuentas.codigo_cuenta_puc`) *(CORREGIDO)* 
  - `tipo_movimiento` (VARCHAR(10), NOT NULL, **CHECK**: `tipo_movimiento IN ('DEBITO', 'CREDITO')`) 
  - `monto` (NUMERIC(18,2), NOT NULL, **CHECK**: `monto > 0.00`) *(CORREGIDO)* 
  - `fecha_contable` (TIMESTAMPTZ, NOT NULL) 
  - **Constraint de Línea Unica**: `UNIQUE (id_transaccion, num_linea)` 
 
#### F. Seguridad, RBAC y Auditoría 
 
- **`usuario_interno`**: 
  - `id_usuario` (INT, NOT NULL, **PK**, Identity) 
  - `username` (VARCHAR(50), NOT NULL, **UNIQUE**) 
  - `email` (VARCHAR(100), NOT NULL, **UNIQUE**) 
  - `id_oficina` (INT, NOT NULL, **FK** → `oficina.id_oficina`) 
  - `activo` (BOOLEAN, NOT NULL, DEFAULT TRUE) 
- **`rol`**: 
  - `id_rol` (INT, NOT NULL, **PK**, Identity) 
  - `nombre` (VARCHAR(50), NOT NULL, **UNIQUE**) 
- **`permiso`**: 
  - `id_permiso` (INT, NOT NULL, **PK**, Identity) 
  - `codigo` (VARCHAR(50), NOT NULL, **UNIQUE**) 
- **`usuario_rol`**: 
  - `id_usuario` (INT, NOT NULL, **FK** → `usuario_interno.id_usuario`) 
  - `id_rol` (INT, NOT NULL, **FK** → `rol.id_rol`) 
  - **PK Compuesta**: `PRIMARY KEY (id_usuario, id_rol)` 
- **`rol_permiso`**: 
  - `id_rol` (INT, NOT NULL, **FK** → `rol.id_rol`) 
  - `id_permiso` (INT, NOT NULL, **FK** → `permiso.id_permiso`) 
  - **PK Compuesta**: `PRIMARY KEY (id_rol, id_permiso)` 
- **`auditoria_operacion`**: 
  - `id_auditoria` (BIGINT, NOT NULL, **PK**, Identity) 
  - `nombre_tabla` (VARCHAR(50), NOT NULL) 
  - `operacion` (VARCHAR(10), NOT NULL, **CHECK**: `operacion IN ('INSERT', 'UPDATE', 'DELETE')`) 
  - `id_registro` (BIGINT, NOT NULL) 
  - `id_usuario_interno` (INT, NULL, **FK** → `usuario_interno.id_usuario`) 
  - `fecha_hora` (TIMESTAMPTZ, NOT NULL) 
  - `datos_anteriores` (JSONB, NULL) 
  - `datos_nuevos` (JSONB, NULL) 