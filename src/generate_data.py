import os
import sys
import csv
import math
import uuid
import random
import time
from datetime import datetime, timedelta
from itertools import repeat

# =============================================================================
# CONFIGURACIÓN Y SEMILLA DE REPRODUCIBILIDAD
# =============================================================================
SEED = 20260909
random.seed(SEED)

OUTPUT_DIR = "./data_csv"
os.makedirs(OUTPUT_DIR, exist_ok=True)

# VOLÚMENES OBJETIVO
NUM_CLIENTES = 10000
NUM_CUENTAS = 50000
NUM_TRANSACCIONES = 1000000

print("=== INICIANDO GENERACIÓN DE DATOS SINTÉTICOS FINANCIEROS ===")
print(f"SEED: {SEED}")
print(f"Directorio de Salida: {OUTPUT_DIR}")
print(f"Volúmenes Objetivo: {NUM_CLIENTES} Clientes, {NUM_CUENTAS} Cuentas, {NUM_TRANSACCIONES} Transacciones")

start_time = time.time()

# =============================================================================
# LISTAS SINTÉTICAS PARA NOMBRES Y EMPRESAS COLOMBIANAS (0% PII REAL)
# =============================================================================
NOMBRES_M = ["Carlos", "Juan", "Pedro", "Luis", "Andres", "Jorge", "Felipe", "Diego", "Santiago", "Mateo",
             "Gabriel", "Daniel", "Alejandro", "David", "Nicolas", "Manuel", "Camilo", "Sebastian", "Javier", "Esteban"]
NOMBRES_F = ["Maria", "Ana", "Laura", "Sofia", "Valentina", "Camila", "Carolina", "Daniela", "Paula", "Andrea",
             "Gabriela", "Mariana", "Isabella", "Lucia", "Natalia", "Diana", "Paredes", "Adriana", "Claudia", "Juliana"]
APELLIDOS = ["Gomez", "Rodriguez", "Lopez", "Garcia", "Martinez", "Perez", "Gonzalez", "Sanchez", "Ramirez", "Torres",
             "Diaz", "Vargas", "Castro", "Rojas", "Moreno", "Munoz", "Valencia", "Gutierrez", "Jimenez", "Hernandez"]

PREFIX_EMPRESA = ["Comercializadora", "Distribuidora", "Grupo", "Inversiones", "Industrias", "Tecnologia", "Constructora",
                  "Servicios", "Consultores", "Agropecuaria", "Transportes", "Textiles", "Soluciones", "Logistica"]
SUFIX_EMPRESA = ["S.A.S.", "S.A.", "Ltda.", "E.U.", "e Hijos", "Colombia S.A.S.", "Internacional S.A."]

TIPOS_CALLE = ["Carrera", "Calle", "Avenida", "Diagonal", "Transversal"]

# =============================================================================
# 1. GENERACIÓN DE USUARIOS INTERNOS
# =============================================================================
print("\n[1/6] Generando Usuarios Internos...")
usuarios_internos = []
for i in range(1, 51):
    u_name = f"user_operador_{i:03d}"
    email = f"operador_{i:03d}@bancoandino.com.co"
    oficina_id = (i % 4) + 1  # Oficinas 1 a 4
    usuarios_internos.append((i, u_name, email, oficina_id, True))

with open(f"{OUTPUT_DIR}/usuario_interno.csv", "w", newline="", encoding="utf-8-sig") as f:
    writer = csv.writer(f)
    writer.writerow(["id_usuario", "username", "email", "id_oficina", "activo"])
    for u in usuarios_internos:
        writer.writerow(u)

# =============================================================================
# 2. GENERACIÓN DE CLIENTES (10.000) - ~85% NATURALES, 15% JURÍDICAS
# =============================================================================
print("[2/6] Generando 10.000 Clientes (Ponderación Geográfica)...")

OFICINAS_PESOS = list(repeat(1, 40)) + list(repeat(2, 25)) + list(repeat(3, 20)) + list(repeat(4, 15))
MUNICIPIOS_OFICINA = {1: 1, 2: 2, 3: 3, 4: 4}

clientes = []
personas_naturales = []
personas_juridicas = []
contactos = []

docs_set = set()
nits_set = set()

start_date_vinculacion = datetime(2024, 1, 1)

for i in range(1, NUM_CLIENTES + 1):
    cod_cliente = f"CLI-{i:08d}"
    es_natural = (random.random() < 0.85)
    tipo_cliente = "NATURAL" if es_natural else "JURIDICA"
    oficina_id = random.choice(OFICINAS_PESOS)

    days_offset = random.randint(0, 500)
    fecha_vinc = start_date_vinculacion + timedelta(days=days_offset, hours=random.randint(8, 17))
    fecha_vinc_str = fecha_vinc.strftime("%Y-%m-%d %H:%M:%S")

    clientes.append((i, cod_cliente, tipo_cliente, oficina_id, 2, fecha_vinc_str)) # 2 = ACTIVO

    if es_natural:
        while True:
            doc = str(random.randint(10000000, 1199999999))
            if doc not in docs_set:
                docs_set.add(doc)
                break

        tipo_doc = 1 if random.random() < 0.95 else (2 if random.random() < 0.8 else 3)
        gen_f = (random.random() < 0.5)
        p_nombre = random.choice(NOMBRES_F if gen_f else NOMBRES_M)
        s_nombre = random.choice(NOMBRES_F if gen_f else NOMBRES_M) if random.random() < 0.4 else ""
        p_apellido = random.choice(APELLIDOS)
        s_apellido = random.choice(APELLIDOS)
        f_nac = (datetime(1955, 1, 1) + timedelta(days=random.randint(0, 18000))).strftime("%Y-%m-%d")

        personas_naturales.append((i, tipo_doc, doc, p_nombre, s_nombre, p_apellido, s_apellido, f_nac))

        dir_str = f"{random.choice(TIPOS_CALLE)} {random.randint(1, 150)} # {random.randint(1, 100)}-{random.randint(1, 99)}"
        tel = f"3{random.randint(0, 2)}{random.randint(1000000, 9999999)}"
        email = f"{p_nombre.lower()}.{p_apellido.lower()}{i}@mailficticio.com"
        contactos.append((i, i, MUNICIPIOS_OFICINA[oficina_id], dir_str, tel, email, True))

    else:
        while True:
            nit_num = random.randint(800000000, 999999999)
            dv = random.randint(0, 9)
            nit_str = f"{nit_num}-{dv}"
            if nit_str not in nits_set:
                nits_set.add(nit_str)
                break

        razon_social = f"{random.choice(PREFIX_EMPRESA)} {random.choice(APELLIDOS)} {random.choice(SUFIX_EMPRESA)}"
        personas_juridicas.append((i, nit_str, razon_social))

        dir_str = f"{random.choice(TIPOS_CALLE)} {random.randint(1, 150)} # {random.randint(1, 100)}-{random.randint(1, 99)}"
        tel = f"601{random.randint(2000000, 8999999)}"
        email = f"contacto@{razon_social.split()[0].lower()}{i}.com.co"
        contactos.append((i, i, MUNICIPIOS_OFICINA[oficina_id], dir_str, tel, email, True))

with open(f"{OUTPUT_DIR}/cliente.csv", "w", newline="", encoding="utf-8") as f:
    writer = csv.writer(f)
    writer.writerow(["id_cliente", "codigo_cliente", "tipo_cliente", "id_oficina_vinculacion", "id_estado_cliente", "fecha_vinculacion"])
    writer.writerows(clientes)

with open(f"{OUTPUT_DIR}/persona_natural.csv", "w", newline="", encoding="utf-8-sig") as f:
    writer = csv.writer(f)
    writer.writerow(["id_cliente", "id_tipo_documento", "numero_documento", "primer_nombre", "segundo_nombre", "primer_apellido", "segundo_apellido", "fecha_nacimiento"])
    writer.writerows(personas_naturales)

with open(f"{OUTPUT_DIR}/persona_juridica.csv", "w", newline="", encoding="utf-8-sig") as f:
    writer = csv.writer(f)
    writer.writerow(["id_cliente", "nit", "razon_social"])
    writer.writerows(personas_juridicas)

with open(f"{OUTPUT_DIR}/cliente_contacto.csv", "w", newline="", encoding="utf-8") as f:
    writer = csv.writer(f)
    writer.writerow(["id_contacto", "id_cliente", "id_municipio", "direccion_residencia", "telefono_principal", "correo_electronico", "es_principal"])
    writer.writerows(contactos)

# =============================================================================
# 3. GENERACIÓN DE CUENTAS (50.000) - DISTRIBUCIÓN DE PARETO POR CLIENTE
# =============================================================================
print("[3/6] Generando 50.000 Cuentas (Distribución de Pareto/Cola Larga)...")

cuentas_por_cliente = [1 for _ in range(NUM_CLIENTES)]
cuentas_restantes = NUM_CUENTAS - NUM_CLIENTES

for _ in range(cuentas_restantes):
    idx = int(math.floor(random.paretovariate(1.5))) % NUM_CLIENTES
    cuentas_por_cliente[idx] += 1

cuentas = []
cuenta_titulares = []
eventos_cuenta = []

cuenta_id_counter = 1
secuencial_cuenta = 1

cuentas_dict = {}

for cliente_id in range(1, NUM_CLIENTES + 1):
    num_cuentas_cliente = cuentas_por_cliente[cliente_id - 1]

    cli_data = clientes[cliente_id - 1]
    f_vinc_cli = datetime.strptime(cli_data[5], "%Y-%m-%d %H:%M:%S")
    oficina_id = cli_data[3]

    for c_idx in range(num_cuentas_cliente):
        num_cuenta = f"{oficina_id:03d}-{(c_idx%3)+1:02d}-{secuencial_cuenta:010d}"
        secuencial_cuenta += 1

        r_prod = random.random()
        if r_prod < 0.60:
            id_producto = 1 # Ahorros
            limite_sobregiro = 0.00
        elif r_prod < 0.85:
            id_producto = 2 # Corriente
            limite_sobregiro = float(random.choice((1000000, 2000000, 5000000, 10000000)))
        else:
            id_producto = 3 # Nómina
            limite_sobregiro = 0.00

        r_est = random.random()
        if r_est < 0.88:
            id_estado_cuenta = 2 # ACTIVA
        elif r_est < 0.91:
            id_estado_cuenta = 1 # PENDIENTE
        elif r_est < 0.95:
            id_estado_cuenta = 3 # BLOQUEADA_PARCIAL
        elif r_est < 0.98:
            id_estado_cuenta = 4 # BLOQUEADA_TOTAL
        else:
            id_estado_cuenta = 6 # CERRADA

        f_apertura = f_vinc_cli + timedelta(days=random.randint(0, 30), hours=random.randint(1, 8))
        f_cierre = None
        f_cierre_str = ""
        if id_estado_cuenta == 6:
            f_cierre = f_apertura + timedelta(days=random.randint(60, 400))
            f_cierre_str = f_cierre.strftime("%Y-%m-%d %H:%M:%S")

        f_apertura_str = f_apertura.strftime("%Y-%m-%d %H:%M:%S")

        cuentas.append([
            cuenta_id_counter, num_cuenta, id_producto, oficina_id, id_estado_cuenta,
            "COP", 0.00, 0.00, limite_sobregiro, f_apertura_str, f_cierre_str
        ])

        cuenta_titulares.append((cuenta_id_counter, cliente_id, "PRINCIPAL", 100.00, f_apertura_str, "", True))

        eventos_cuenta.append((cuenta_id_counter, 1, 1, f_apertura_str, "Apertura inicial de cuenta", "", 1))
        if id_estado_cuenta == 2:
            eventos_cuenta.append((cuenta_id_counter, 2, 1, f_apertura_str, "Activación inicial", 1, 2))

        cuentas_dict[cuenta_id_counter] = {
            'id_cuenta': cuenta_id_counter,
            'numero_cuenta': num_cuenta,
            'id_producto': id_producto,
            'saldo': 0.00,
            'limite_sobregiro': limite_sobregiro,
            'estado': id_estado_cuenta,
            'f_apertura': f_apertura,
            'f_cierre': f_cierre
        }

        cuenta_id_counter += 1

with open(f"{OUTPUT_DIR}/cuenta_titular.csv", "w", newline="", encoding="utf-8-sig") as f:
    writer = csv.writer(f)
    writer.writerow(["id_cuenta", "id_cliente", "tipo_titularidad", "porcentaje_participacion", "fecha_vinculacion", "fecha_desvinculacion", "activo"])
    writer.writerows(cuenta_titulares)

with open(f"{OUTPUT_DIR}/evento_cuenta.csv", "w", newline="", encoding="utf-8") as f:
    writer = csv.writer(f)
    writer.writerow(["id_cuenta", "id_tipo_evento", "id_usuario_interno", "fecha_hora", "motivo", "id_estado_anterior", "id_estado_nuevo"])
    writer.writerows(eventos_cuenta)

# =============================================================================
# 4. SIMULACIÓN DE EXACTAMENTE 1.000.000 DE TRANSACCIONES Y LEDGER BALANCEADO
# =============================================================================
print("[4/6] Simulando EXACTAMENTE 1.000.000 de Transacciones y Generando Ledger (2M Asientos)...")

cuentas_activas_ids = [cid for cid, c in cuentas_dict.items() if c['estado'] in (2, 3, 5, 6)]

transacciones = []
asientos_contables = []

start_tx_date = datetime(2024, 9, 1)
end_tx_date = datetime(2026, 9, 1)
total_days = (end_tx_date - start_tx_date).days

MONTH_WEIGHTS = {1: 0.8, 2: 0.9, 3: 1.0, 4: 1.0, 5: 1.1, 6: 1.3, 7: 1.0, 8: 1.0, 9: 1.1, 10: 1.1, 11: 1.2, 12: 1.6}
PUC_MAP = {1: '210505', 2: '210510', 3: '210505'}

tx_counter = 1
asiento_counter = 1

while len(transacciones) < NUM_TRANSACCIONES:
    if len(transacciones) % 100000 == 0 and len(transacciones) > 0:
        print(f"   -> Progreso: {len(transacciones):,} / {NUM_TRANSACCIONES:,} transacciones...")

    r_type = random.random()
    if r_type < 0.35:
        tipo_tx = 1 # CONSIGNACION
    elif r_type < 0.65:
        tipo_tx = 2 # RETIRO
    elif r_type < 0.92:
        tipo_tx = 3 # TRANSFERENCIA
    elif r_type < 0.96:
        tipo_tx = 4 # DEBITO_NOTAS
    else:
        tipo_tx = 5 # CREDITO_NOTAS

    # Timestamp Estacional
    rand_days = random.randint(0, total_days - 1)
    tx_dt = start_tx_date + timedelta(days=rand_days)

    m_weight = MONTH_WEIGHTS[tx_dt.month]
    if tx_dt.day in (14, 15, 16, 28, 29, 30, 31):
        m_weight *= 1.5

    if random.random() > (m_weight / 2.5):
        continue

    r_hour = random.random()
    if r_hour < 0.40:
        hour = random.randint(8, 12)
    elif r_hour < 0.80:
        hour = random.randint(14, 18)
    else:
        hour = random.randint(0, 23)

    tx_dt = tx_dt.replace(hour=hour, minute=random.randint(0, 59), second=random.randint(0, 59))
    tx_dt_str = tx_dt.strftime("%Y-%m-%d %H:%M:%S")

    val_raw = math.exp(random.normalvariate(11.8, 1.1))
    monto = round(max(5000.00, min(val_raw, 50000000.00)), 2)

    cta_origen = None
    cta_destino = None

    if tipo_tx == 1: # CONSIGNACION
        cta_destino_id = random.choice(cuentas_activas_ids)
        c_dest = cuentas_dict[cta_destino_id]
        if tx_dt < c_dest['f_apertura'] or (c_dest['f_cierre'] and tx_dt > c_dest['f_cierre']):
            continue
        cta_destino = cta_destino_id
        c_dest['saldo'] += monto

    elif tipo_tx in (2, 4): # RETIRO o DEBITO NOTAS
        cta_origen_id = random.choice(cuentas_activas_ids)
        c_orig = cuentas_dict[cta_origen_id]
        if tx_dt < c_orig['f_apertura'] or (c_orig['f_cierre'] and tx_dt > c_orig['f_cierre']):
            continue
        
        # VALIDACIÓN RIGUROSA DE SOBREGIRO MINIMO
        max_retiro_permitido = c_orig['saldo'] + c_orig['limite_sobregiro']
        if max_retiro_permitido <= 0:
            continue
            
        if monto > max_retiro_permitido:
            monto = round(max_retiro_permitido, 2)
            if monto <= 0:
                continue

        cta_origen = cta_origen_id
        c_orig['saldo'] -= monto

    elif tipo_tx == 3: # TRANSFERENCIA
        cta_origen_id = random.choice(cuentas_activas_ids)
        cta_destino_id = random.choice(cuentas_activas_ids)
        if cta_origen_id == cta_destino_id:
            continue

        c_orig = cuentas_dict[cta_origen_id]
        c_dest = cuentas_dict[cta_destino_id]

        if tx_dt < c_orig['f_apertura'] or (c_orig['f_cierre'] and tx_dt > c_orig['f_cierre']):
            continue
        if tx_dt < c_dest['f_apertura'] or (c_dest['f_cierre'] and tx_dt > c_dest['f_cierre']):
            continue

        # VALIDACIÓN RIGUROSA DE SOBREGIRO MINIMO
        max_retiro_permitido = c_orig['saldo'] + c_orig['limite_sobregiro']
        if max_retiro_permitido <= 0:
            continue

        if monto > max_retiro_permitido:
            monto = round(max_retiro_permitido, 2)
            if monto <= 0:
                continue

        cta_origen = cta_origen_id
        cta_destino = cta_destino_id
        c_orig['saldo'] -= monto
        c_dest['saldo'] += monto

    elif tipo_tx == 5: # CREDITO NOTAS
        cta_destino_id = random.choice(cuentas_activas_ids)
        c_dest = cuentas_dict[cta_destino_id]
        if tx_dt < c_dest['f_apertura'] or (c_dest['f_cierre'] and tx_dt > c_dest['f_cierre']):
            continue
        cta_destino = cta_destino_id
        c_dest['saldo'] += monto

    idempotency_key = str(uuid.uuid4())
    user_op = random.randint(1, 50)

    transacciones.append((
        tx_counter, idempotency_key, cta_origen if cta_origen else "", cta_destino if cta_destino else "",
        tipo_tx, 2, monto, "COP", tx_dt_str, user_op
    ))

    puc_orig = PUC_MAP[cuentas_dict[cta_origen]['id_producto']] if cta_origen else "110505"
    puc_dest = PUC_MAP[cuentas_dict[cta_destino]['id_producto']] if cta_destino else "110505"

    if tipo_tx == 1:
        asientos_contables.append((asiento_counter, tx_counter, 1, "110505", "DEBITO", monto, tx_dt_str))
        asientos_contables.append((asiento_counter+1, tx_counter, 2, puc_dest, "CREDITO", monto, tx_dt_str))
    elif tipo_tx == 2:
        asientos_contables.append((asiento_counter, tx_counter, 1, puc_orig, "DEBITO", monto, tx_dt_str))
        asientos_contables.append((asiento_counter+1, tx_counter, 2, "110505", "CREDITO", monto, tx_dt_str))
    elif tipo_tx == 3:
        asientos_contables.append((asiento_counter, tx_counter, 1, puc_orig, "DEBITO", monto, tx_dt_str))
        asientos_contables.append((asiento_counter+1, tx_counter, 2, puc_dest, "CREDITO", monto, tx_dt_str))
    elif tipo_tx == 4:
        asientos_contables.append((asiento_counter, tx_counter, 1, puc_orig, "DEBITO", monto, tx_dt_str))
        asientos_contables.append((asiento_counter+1, tx_counter, 2, "413505", "CREDITO", monto, tx_dt_str))
    elif tipo_tx == 5:
        asientos_contables.append((asiento_counter, tx_counter, 1, "510505", "DEBITO", monto, tx_dt_str))
        asientos_contables.append((asiento_counter+1, tx_counter, 2, puc_dest, "CREDITO", monto, tx_dt_str))

    asiento_counter += 2
    tx_counter += 1

# Actualizar saldos finales en la lista de cuentas asegurando 0.00 como mínimo para cuentas sin sobregiro
for c_row in cuentas:
    cid = c_row[0]
    saldo_calc = round(cuentas_dict[cid]['saldo'], 2)
    lim_sobregiro = c_row[8]
    if saldo_calc < -lim_sobregiro:
        saldo_calc = -lim_sobregiro
    c_row[6] = saldo_calc

# Guardar CSVs
print("[5/6] Escribiendo archivos CSV finales...")

with open(f"{OUTPUT_DIR}/cuenta.csv", "w", newline="", encoding="utf-8-sig") as f:
    writer = csv.writer(f)
    writer.writerow(["id_cuenta", "numero_cuenta", "id_producto", "id_oficina_apertura", "id_estado_cuenta", "moneda", "saldo_disponible", "saldo_canje", "limite_sobregiro", "fecha_apertura", "fecha_cierre"])
    writer.writerows(cuentas)

with open(f"{OUTPUT_DIR}/transaccion.csv", "w", newline="", encoding="utf-8") as f:
    writer = csv.writer(f)
    writer.writerow(["id_transaccion", "idempotency_key", "id_cuenta_origen", "id_cuenta_destino", "id_tipo_transaccion", "id_estado_transaccion", "monto", "moneda", "fecha_transaccion", "id_usuario_operador"])
    writer.writerows(transacciones)

with open(f"{OUTPUT_DIR}/asiento_contable.csv", "w", newline="", encoding="utf-8-sig") as f:
    writer = csv.writer(f)
    writer.writerow(["id_asiento", "id_transaccion", "num_linea", "codigo_cuenta_puc", "tipo_movimiento", "monto", "fecha_contable"])
    writer.writerows(asientos_contables)

elapsed = time.time() - start_time
print(f"\n[6/6] ¡GENERACIÓN COMPLETADA EXITOSAMENTE EN {elapsed:.2f} SEGUNDOS!")
print("=====================================================================")
print(f" - Clientes creados:         {len(clientes):,} (85% Naturales, 15% Jurídicas)")
print(f" - Cuentas creadas:          {len(cuentas):,}")
print(f" - Transacciones simuladas:  {len(transacciones):,}")
print(f" - Asientos contables:       {len(asientos_contables):,} (100% Doble Partida Balanceada)")
print(f" Archivos CSV generados en: {OUTPUT_DIR}")
print("=====================================================================")