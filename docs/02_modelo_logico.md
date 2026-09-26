# TALLER BANCO ANDINO 
 
## 1- Ingeniaría del dominio con ia 
 
Solución de la IA: 
 
Fase 2: 
 
### Evaluaciones de Control y Calidad: Fase 2 (Modelo Lógico y Físico) 
 
Como **PostgreSQL Database Architect y Senior DBA**, he realizado la auditoría técnica exhaustiva del modelo relacional propuesto para **Banco Andino Colombia**. El análisis evalúa el cumplimiento de las formas normales (1FN, 2FN, 3FN), la integridad referencial, el control de nulabilidad, los riesgos de anomalías en operaciones OLTP y los requisitos para soportar **10.000 clientes, 50.000 cuentas y 1.000.000 de transacciones**. 
 
### 1. Respuestas de Control a las Preguntas de la Fase 2 
 
- **¿Cada tabla representa un solo concepto?** 
  - **Evaluación**: **Aprobado con observaciones**. Las entidades principales cumplen con el principio de responsabilidad única. Sin embargo, en el modelo inicial se mezclaban datos estáticos del cliente con atributos de contacto altamente mutables (sin historial), y se omitía la trazabilidad del representante legal en personas jurídicas. 
- **1FN (Atributos Atómicos y Ausencia de Listas)**: 
  - **Evaluación**: **Aprobado**. Todos los atributos son atómicos. Las relaciones de cardinalidad N:M (titulares por cuenta, roles por usuario, permisos por rol) utilizan tablas asociativas dedicadas. 
- **2FN (Dependencia Funcional Completa de la PK)**: 
  - **Evaluación**: **Aprobado**. En las tablas asociativas con claves compuestas (`cuenta_titular`, `usuario_rol`, `rol_permiso`), todos los atributos no clave dependían de la totalidad de la clave primaria. 
- **3FN (Ausencia de Dependencias Transitivas)**: 
  - **Evaluación**: **Aprobado con corrección en catálogos**. Se eliminó la dependencia transitiva implícita entre el código DANE del departamento y el del municipio forzando la validación de la FK explícita `(id_departamento)`. 
- **N:M (Relaciones Muchos a Muchos)**: 
  - **Evaluación**: **Corregido**. La tabla asociativa `cuenta_titular` requería atributos de auditoría temporal (`fecha_vinculacion`, `fecha_desvinculacion`, `estado`) para responder a requerimientos legales e históricos. 
- **Catálogos (Control de Estados y Tipos)**: 
  - **Evaluación**: **Corregido**. Se promovieron las cadenas de texto libre o *CHECK inline* de estados (`estado_cuenta`, `estado_cliente`, `estado_transaccion`, `tipo_documento`) a **tablas de catálogo dedicadas** para evitar inconsistencias por errores tipográficos (*data entry*). 
- **Saldos (Diferenciación entre Saldos Persistidos y Ledger)**: 
  - **Evaluación**: **Aprobado**. Se mantiene la separación estricta: `cuenta.saldo_disponible` almacena la foto actual para el rendimiento OLTP, mientras que `asiento_contable` registra de forma inmutable cada partida doble ($$\sum \text{Débitos} = \sum \text{Créditos}$$). 
- **Histórico (Conservación de Hechos Financieros)**: 
  - **Evaluación**: **Aprobado**. Ninguna transacción en estado `POSTED` permite modificaciones directas. La corrección de inconsistencias se procesa exclusivamente mediante transacciones compensatorias de reverso. 
 
### 2. Tabla de Auditoría del Modelo Relacional 
 
A continuación se detallan los hallazgos identificados en la arquitectura inicial, su nivel de severidad, evidencia técnica, impacto operativo y la corrección propuesta: 
 
| Hallazgo | Severidad | Evidencia | Impacto | Corrección Propuesta | 
|---|---|---|---|---| 
| **Unicidad Incompleta en Documentos** | **CRÍTICA** | `persona_natural` define `numero_documento` sin restricción única compuesta con `id_tipo_documento`. | Permite registrar dos clientes con el mismo número bajo distintos tipos de documento (ej. CC 123456 y CE 123456) generando duplicidad de identidades. | Crear constraint `UNIQUE (id_tipo_documento, numero_documento)` en `persona_natural`. | 
| **Omisión de FK en Imputación Contable** | **CRÍTICA** | `asiento_contable.codigo_cuenta_puc` es un `VARCHAR(20)` sin Foreign Key hacia `plan_cuentas`. | Inserción de movimientos contables contra cuentas del PUC inexistentes, destruyendo la integridad del Ledger. | Agregar Foreign Key explícita: `FOREIGN KEY (codigo_cuenta_puc) REFERENCES plan_cuentas(codigo_cuenta_puc)`. | 
| **Monto Financiero No Acotado** | **ALTA** | `transaccion.monto` usa `NUMERIC(18,2)` sin restricción `CHECK (monto > 0)`. | Posibilidad de registrar transacciones con valor cero o montos negativos que corrompen el saldo y las reglas de débito/crédito. | Agregar `CHECK (monto > 0)` en la tabla `transaccion`. | 
| **Pérdida de Auditoría Temporal en Cotitulares** | **ALTA** | `cuenta_titular` carece de trazabilidad de fechas de asignación y desvinculación. | Imposibilidad de auditar legalmente quiénes eran los titulares legítimos de una cuenta en la fecha exacta de una transacción previa. | Añadir `fecha_vinculacion`, `fecha_desvinculacion` y `estado` en `cuenta_titular`. | 
| **Falta de Histórico de Representación Legal** | **MEDIA** | `persona_juridica.representante_legal_id` es una relación estática 1:1 directa. | Si la empresa cambia de representante legal, se pierde el registro histórico de quién firmó las operaciones previas. | Crear la tabla `historico_representante_legal` con rangos de fecha (`fecha_inicio`, `fecha_fin`). | 
| **Vulnerabilidad a Texto Libre en Estados** | **MEDIA** | `cliente.estado`, `cuenta.estado` y `transaccion.estado_transaccion` usan cadenas de texto libres. | Anomalías en consultas y agregaciones por inconsistencias de tipeo ('ACTIVA', 'activa', 'Activa'). | Crear tablas de catálogo: `estado_cliente`, `estado_cuenta` y `estado_transaccion` con llaves foráneas explícitas. | 
| **Ausencia de Datos de Contacto y Dirección** | **MEDIA** | Se omitieron dirección, correo y teléfono en las entidades de cliente. | Incumplimiento del alcance mínimo obligatorio de vinculación y contacto de clientes. | Crear la entidad `cliente_contacto` normalizada en 3FN con indicación de dirección principal. | 
| **Moneda sin Validación de Consistencia** | **BAJA** | `transaccion` no valida si la moneda coincide con la parametrizada en la `cuenta`. | Riesgo de aplicar movimientos en divisas no soportadas sobre cuentas en pesos colombianos (`COP`). | Agregar `moneda` en `transaccion` respaldada por catálogo y FK a la cuenta. | 
 
### 3. Modelo Lógico Corregido 
 
A continuación se presenta el modelo relacional corregido en 3FN. Cada tabla incluye sus tipos de datos, nulabilidad, claves (PK/FK) y las modificaciones integradas respecto a la versión inicial. 
 
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
 
### 4. Resumen Detallado de Cambios Aplicados 
 
1. **Catálogos de Control**: Se crearon e integraron las tablas `estado_cliente`, `estado_cuenta`, `estado_transaccion` y `tipo_documento` para eliminar riesgos de *data entry* y garantizar la consistencia en consultas OLTP. 
2. **Integridad de Documentos**: Se aplicó la restricción `UNIQUE (id_tipo_documento, numero_documento)` en `persona_natural` para impedir identidades duplicadas. 
3. **Integridad del Ledger Contable**: Se incluyó la llave foránea `FOREIGN KEY (codigo_cuenta_puc)` en `asiento_contable` hacia `plan_cuentas` y se añadió la restricción de unicidad para la secuencia de líneas `(id_transaccion, num_linea)`. 
4. **Protección de Saldos y Montos**: Se forzó la restricción `CHECK (monto > 0.00)` tanto en `transaccion` como en `asiento_contable`. 
5. **Auditoría Temporal N:M**: Se enriqueció la tabla `cuenta_titular` con campos `fecha_vinculacion`, `fecha_desvinculacion` y `activo` para trazabilidad legal de cotitulares. 
6. **Historial de Representación Legal**: Se desacopló la relación estática creando la entidad asociativa `historico_representante_legal` con vigencia temporal. 
7. **Datos de Contacto**: Se creó la entidad `cliente_contacto` para dar cumplimiento completo al estándar de información demográfica del cliente. 
 
El modelo lógico corregido satisface estrictamente los criterios del **Quality Gate G2** (3FN, integridad de claves, 0 anomalías críticas de diseño). 
``` 

 