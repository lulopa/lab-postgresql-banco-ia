# PROMPT FASE 1 estudio
# -----------------------------------------------------------------------------------------
Actúa como arquitecto de datos senior, DBA PostgreSQL y especialista en sistemas bancarios OLTP. 
Diseña el dominio de una entidad ficticia “Banco Andino Colombia”. NO generes todavía el SQL final. 
Incluye: departamentos/municipios/oficinas; clientes persona natural y jurídica; productos; cuentas; titularidad N:M; eventos de cuenta; transacciones; doble partida; usuarios/roles/permisos; auditoría. 
Condiciones: 
- cliente ≠ usuario interno; 
- eventos administrativos ≠ transacciones financieras; 
- una cuenta puede tener varios titulares; 
- toda transacción POSTED debe ser inmutable; 
- correcciones por reverso/compensación; 
- toda operación crítica debe poder auditarse; 
- volumen objetivo: 10K clientes, 50K cuentas, 1M transacciones. 
Entrega en este orden: 
1) actores y procesos; 2) entidades y propósito; 3) atributos esenciales; 4) relaciones/cardinalidades; 5) catálogos/estados; 6) mínimo 30 reglas de negocio verificables; 7) riesgos de consistencia; 8) decisiones que requieren validación humana; 9) ERD Mermaid. 
Finaliza con una autocrítica: qué está sobrediseñado, subdiseñado o ambiguo. 

la respuesta se encuentra en **01_especificaciones.md y docs**
# -----------------------------------------------------------------------------------------

# PROMPT FASE 2 modelo relacional
# -----------------------------------------------------------------------------------------
Audita el modelo relacional propuesto para Banco Andino Colombia. 
Evalúa 1FN, 2FN y 3FN; PK, FK y N:M; nulabilidad; unicidad; tipos; catálogos; trazabilidad; histórico; riesgos de anomalías INSERT/UPDATE/DELETE. 
No rediseñes silenciosamente. Devuelve una tabla: hallazgo | severidad | evidencia | impacto | corrección propuesta. 
Después entrega el modelo lógico corregido, indicando cada cambio realizado. 
la respuesta se encuentra en **02_modelo_logico.md y docs**
# -----------------------------------------------------------------------------------------

# PROMPT FASE 3 scripts
# -----------------------------------------------------------------------------------------
Usa la especificación y el modelo lógico aprobados. Actúa como PostgreSQL Database Architect y Senior DBA. 
Genera una implementación PostgreSQL profesional y reproducible. 
Obligatorio: 3FN; PK/FK/UNIQUE/NOT NULL/CHECK; NUMERIC para dinero; TIMESTAMPTZ para eventos; convenciones snake_case; comentarios en objetos críticos; idempotency key; transacciones ACID; ledger de doble partida; inmutabilidad de POSTED; auditoría; RBAC; mínimo privilegio; índices justificados; manejo de concurrencia donde sea necesario. 
Implementa operaciones seguras para: crear cliente/cuenta, activar, bloquear, desbloquear, consignar, retirar, transferir, reversar y cerrar cuenta. Cada operación debe validar precondiciones, ser atómica, auditar y manejar errores. 
Evalúa SELECT ... FOR UPDATE y niveles de aislamiento para evitar doble retiro/lost update/doble procesamiento. 
Organiza la salida en: 00_extensions.sql, 01_schemas.sql, 02_catalogs.sql, 03_geography.sql, 04_customers.sql, 05_products.sql, 06_accounts.sql, 07_users_security.sql, 08_transactions.sql, 09_ledger.sql, 10_audit.sql, 11_constraints.sql, 12_indexes.sql, 13_views.sql, 14_functions.sql, 15_procedures.sql, 16_triggers.sql, 17_roles_permissions.sql, 18_tests.sql, 19_demo_queries.sql, 20_teardown.sql. 
Antes de finalizar, audita tu propia salida y muestra: regla | PASS/FAIL | evidencia | corrección. 


la respuesta se encuentra en **los sqls (el script 18 presento error, lease correccion_sql.md para entender) y  en g3_test.txt**
# -----------------------------------------------------------------------------------------

# PROMPT FASE 4 generacion de datos
# -----------------------------------------------------------------------------------------
Actúa como Senior Data Engineer especializado en datos sintéticos financieros y PostgreSQL. 
Crea un generador reproducible con SEED=20260909 para poblar el esquema aprobado con: 
- 10.000 clientes (aprox. 85% naturales, 15% jurídicas); 
- 50.000 cuentas; 
- 1.000.000 transacciones financieras + ledger asociado; 
- usuarios internos en cantidad razonable. 
Reglas: 
1) 0 PII real; 2) documentos/NIT/cuentas únicos; 3) distribución geográfica ponderada, no uniforme; 4) cuentas por cliente no uniformes; 5) actividad temporal ≥24 meses con estacionalidad por mes/día/hora; 6) montos con distribución sesgada: muchas operaciones pequeñas, menos medianas, pocas grandes; 7) transacción posterior a apertura y anterior al cierre; 8) bloqueos respetados; 9) origen ≠ destino; 10) sin saldo negativo cuando no hay sobregiro; 11) ledger balanceado; 12) pequeña cantidad de casos extremos válidos. 
Implementa preferiblemente Python + Faker + psycopg o CSV + PostgreSQL COPY. Evita 1M INSERT individuales. 
Entrega: generate_data.py, requirements.txt, README, configuración, estrategia de carga y validación posterior con tabla métrica | esperado | obtenido | PASS/FAIL. 

la respuesta se encuentra en **los src y data_csv**
# -----------------------------------------------------------------------------------------

# PROMPT FASE 5 querys (nosotros los pensamos)
# -----------------------------------------------------------------------------------------
Actúa como tutor SQL PostgreSQL. A partir del esquema Banco Andino, propón 30 problemas: 10 básicos, 10 intermedios y 10 avanzados. 
Para cada problema entrega: objetivo de negocio, tablas necesarias, conceptos SQL evaluados y criterio para validar el resultado. NO entregues la solución inicialmente. 
Cuando reciba la consulta del estudiante, evalúala por: corrección, legibilidad, eficiencia, robustez ante NULL/duplicados y semántica de negocio. Da pistas antes de mostrar una solución alternativa. 

la respuesta se encuentra en **demo_querys.sql y en los documentos rreferentes a la fase 5(5.1- 5.2- 5.3)**
# -----------------------------------------------------------------------------------------

# PROMPT FASE 6
# -----------------------------------------------------------------------------------------
Actúa como Senior Data Quality Engineer, PostgreSQL DBA y Data Auditor. Audita la base sin corregirla primero. 

Genera SQL ejecutable para evaluar: completitud, unicidad, integridad referencial, validez, consistencia geográfica, consistencia temporal, consistencia financiera, reconciliación de saldos, reglas de negocio, distribuciones, diseño y auditoría. 

Para cada test devuelve: test_id | categoría | regla | tabla | esperado | obtenido | severidad | PASS/WARNING/FAIL | detalle. 

Quality gates críticos: 0 duplicados de documento/NIT/cuenta/idempotencia; 0 huérfanos; 0 transacciones imposibles por estado/fecha; Σ débito = Σ crédito para 100% de POSTED; diferencias de saldo = 0 salvo regla documentada. 

Calcula scores solo desde pruebas ejecutadas: Data Quality, Database Design, Integrity, Auditability y Overall. Si falla cualquier regla crítica financiera o referencial, QUALITY_GATE=FAIL. 

No corrijas silenciosamente: primero evidencia el fallo, luego recomienda. 

la respuesta se encuentra en **G6_quality_gate+_before_after**
# -----------------------------------------------------------------------------------------
# PROMPT FASE 7
# -----------------------------------------------------------------------------------------
seleccione de la pregunta 20 a la 29 y cada pregunta le corri este prompt:
Analiza estos planes EXPLAIN (ANALYZE, BUFFERS). No recomiendes índices de forma automática. 

Para cada consulta identifica cuello de botella, causa probable, selectividad, columnas de join/filtro/orden, índice candidato si aplica, costo de escritura/almacenamiento del índice y riesgo de sobreindexación. 

Devuelve comparación before/after y clasifica la mejora como: no concluyente, menor, relevante o crítica. Señala cuando la mejor decisión sea NO crear índice. 

la respuesta se encuentra en **TALLER BANCO ANDINO fase7_evidence+security**
# -----------------------------------------------------------------------------------------

# PROMPT FASE 8
# -----------------------------------------------------------------------------------------
# Fase 8: Entregable Final
Eres un evaluador técnico senior especializado en validación de proyectos de bases de datos en producción. Tu tarea es ayudar al usuario a estructurar y ejecutar la Fase 8 (entregable final) de su proyecto, asegurando que cada componente cumpla con los estándares de calidad exigidos.
## Contexto
El usuario ha completado un proyecto de diseño e implementación de base de datos con optimizaciones guiadas por recomendaciones de IA. Ahora necesita consolidar y presentar el trabajo de forma que demuestre decisiones arquitectónicas sólidas, mejoras medibles y pensamiento crítico sobre las recomendaciones recibidas.
## Tu rol: Ayudar a definir y validar la Fase 8
**No entregues el informe ni hagas el análisis por él.** Tu trabajo es:
1. **Clarificar qué datos y artefactos ya tiene** y cuál es su estado actual
2. **Identificar qué falta** para completar cada componente del entregable
3. **Proponer un enfoque estructurado** para cada entregable (repositorio, informe, defensa, matriz de IA)
4. **Sugerir evidencia concreta** que demuestre cumplimiento de quality gates
## Estructura de la conversación
Hazle preguntas diagnósticas para entender:
- **Estado del repositorio**: ¿Tiene scripts numerados, README funcional? ¿Puede reproducirse la ejecución desde cero?
- **ERD final**: ¿Está documentada la versión implementada o solo existe como diagrama? ¿Hay DDL de referencia?
- **Informe técnico**: ¿Tiene borrador? ¿Qué decisiones arquitectónicas son más complejas de documentar?
- **Quality Gate**: ¿Qué métricas comparó before/after? ¿Tiene planes EXPLAIN capturados?
- **Matriz de IA**: ¿Cuántas recomendaciones recibió? ¿Ya clasificó cada una (aceptar/modificar/rechazar)?
- **Defensa oral**: ¿Identificó las 3 decisiones de diseño más defensables y los 2 errores más instructivos?
## Entregables esperados (solo como checklist para validar completitud)
Basándote en el template que proporcionó:
- Repositorio con scripts reproducibles, README claro y ejecución validada
- ERD final del modelo implementado con documentación
- Informe técnico ≤8 páginas: arquitectura, decisiones, quality gates, hallazgos, mejoras
- Matriz IA completamente diligenciada (ID, Recomendación, Decisión, Evidencia, Justificación)
- Plan de defensa: 3 decisiones de diseño preparadas + 2 errores clave documentados
## Próximos pasos
Comienza preguntando por el estado actual de cada uno de estos componentes. A partir de sus respuestas, ayúdalo a:
1. Priorizar qué completar primero
2. Identificar brechas en evidencia o documentación
3. Estructurar la narrativa de cada decisión clave
4. Preparar argumentos defensibles para la matriz de IA
No le des el trabajo hecho — ayúdalo a pensar a través de qué es lo que necesita y cómo reunir la evidencia que demuestre rigor.

la respuesta se encuentra en **human_in_the__loop y en el informe_final**
# -----------------------------------------------------------------------------------------