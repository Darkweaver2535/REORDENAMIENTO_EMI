import os
import sys
import django
import pandas as pd
import json

# Setup Django
sys.path.append(os.path.abspath('BACKEND_REORDENAMIENTO_EMI'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.laboratorios.models import Laboratorio, Equipo
from apps.estructura_academica.models import UnidadAcademica
from django.db import transaction

# Constants
FILE_PATH = "EQUIPO MEDICO Y LABORATORIO UACBBA.xlsx"
UA_CODIGO = "0003"  # UACB

# Mapping OFICINA -> Laboratorio ID
MAPEO_OFICINAS = {
    "LABORATORIO HORMIGON": 84,
    "LABORATORIO  SUELOS": 83,  # Double space in excel
    "LABORATORIO DE FISICOQUIMICA": 69,
    "LABORATORIOS DE SIST. ELECTRONICOS": 87,
    "LABORATORIO  ASFALTOS": 85,
    "LABORATORIO PRODUCCION": 74,
    "LABORATORIO DE LACTEOS": 72,
    "LABORATORIO DE TELECOMUNICACION ELECTRONICA": 89,
    "LABORATORIO DE ELECTRONICA DE POTENCIA": 88,
    "LABORATORIO DE CONTROL Y AUTOMATIZACION": 90,
    "LABORATORIO DE AGUAS": 73,
    "LAB. REDES Y TELECOMUNICACIONES": 92
}

def clean_string(val):
    if pd.isna(val):
        return ""
    val_str = str(val).strip()
    # Limpieza de caracteres corruptos detectados
    val_str = val_str.replace("¥", "Ñ")
    val_str = val_str.replace("à", "á")
    return val_str

def get_estatus_general(val):
    val_str = clean_string(val).lower()
    if "buen" in val_str:
        return "bueno"
    elif "malo" in val_str or "mala" in val_str:
        return "malo"
    return "regular"  # default as per existing ones

def run_import():
    print("--- INICIANDO IMPORTACIÓN UACB ---")
    ua = UnidadAcademica.objects.get(codigo=UA_CODIGO)
    
    xl = pd.ExcelFile(FILE_PATH)
    df = pd.read_excel(FILE_PATH, sheet_name=xl.sheet_names[0], header=6)
    df.columns = df.columns.str.strip().str.upper()
    
    # Excluir vacios y fila totalizadora
    df = df.dropna(how='all')
    df = df[~df['CÓDIGO'].astype(str).str.contains("CANTIDAD|TOTAL", case=False, na=False)]
    df = df.dropna(subset=['CÓDIGO', 'DESCRIPCIÓN DEL BIEN'], how='all')
    
    # Cache existing codes to avoid collision
    codigos_existentes = set(Equipo.objects.values_list('codigo_activo', flat=True))
    
    # Fetch laboratories into a map for fast validation
    labs_existentes = {lab.id: lab for lab in Laboratorio.objects.filter(unidad_academica=ua)}
    
    importados = 0
    con_lab = 0
    sin_lab = 0
    colisiones = 0
    
    distribucion = {}
    ejemplos_sin_lab = []

    with transaction.atomic():
        for _, row in df.iterrows():
            codigo = clean_string(row.get('CÓDIGO'))
            if not codigo or codigo in codigos_existentes:
                colisiones += 1
                continue
            
            nombre = clean_string(row.get('DESCRIPCIÓN DEL BIEN'))
            oficina_excel = clean_string(row.get('OFICINA')).upper()
            estado_raw = row.get('ESTADO')
            estatus = get_estatus_general(estado_raw)
            observaciones = clean_string(row.get('OBSERVACIONES'))
            
            # Map laboratory
            lab_id = MAPEO_OFICINAS.get(oficina_excel)
            laboratorio = labs_existentes.get(lab_id) if lab_id else None
            
            # Cantidades
            cant_buena = 1 if estatus == "bueno" else 0
            cant_regular = 1 if estatus == "regular" else 0
            cant_mala = 1 if estatus == "malo" else 0
            
            # Especificaciones
            especificaciones = {
                "grupo_contable": clean_string(row.get('GRUPO CONTABLE')),
                "tipo_auxiliar": clean_string(row.get('AUXILIAR')),
                "costo_historico": float(row.get('COSTO HISTORICO')) if pd.notna(row.get('COSTO HISTORICO')) else None,
                "fecha_historico": clean_string(row.get('FECHA HISTORICO')),
                "carnet_responsable": clean_string(row.get('CARNET'))
            }
            
            if not laboratorio:
                especificaciones["oficina_original_excel"] = oficina_excel
                especificaciones["SIN_ASIGNAR_LABORATORIO"] = True
                sin_lab += 1
                if len(ejemplos_sin_lab) < 3:
                    ejemplos_sin_lab.append(f"{codigo} - {nombre[:20]}... ({oficina_excel})")
            else:
                con_lab += 1
                distribucion[laboratorio.nombre] = distribucion.get(laboratorio.nombre, 0) + 1
                
            # Notas
            responsable = clean_string(row.get('RESPONSABLE'))
            cargo = clean_string(row.get('CARGO'))
            notas = ""
            if responsable or cargo:
                notas = f"Responsable Histórico: {responsable} (Cargo: {cargo})"
            
            # Create Equipo
            equipo = Equipo(
                codigo_activo=codigo,
                nombre=nombre,
                laboratorio=laboratorio,
                estatus_general=estatus,
                observaciones=observaciones,
                notas=notas,
                especificaciones=especificaciones,
                cantidad_total=1,
                cantidad_buena=cant_buena,
                cantidad_regular=cant_regular,
                cantidad_mala=cant_mala,
            )
            equipo.save()
            codigos_existentes.add(codigo)
            importados += 1

    print("\n--- VALIDACIÓN FINAL DE IMPORTACIÓN ---")
    print(f"Total filas útiles en Excel: {len(df)}")
    print(f"Total importados a la BD: {importados}")
    print(f"Colisiones (omitidos): {colisiones}")
    print(f"Total con laboratorio asignado: {con_lab}")
    print(f"Total SIN laboratorio (huérfanos/administrativos): {sin_lab}")
    
    print("\nDistribución por laboratorio asignado:")
    for lab_nombre, count in sorted(distribucion.items()):
        print(f" - {lab_nombre}: {count}")
        
    print("\nEjemplos de equipos sin laboratorio:")
    for ej in ejemplos_sin_lab:
        print(f" - {ej}")

if __name__ == "__main__":
    run_import()
