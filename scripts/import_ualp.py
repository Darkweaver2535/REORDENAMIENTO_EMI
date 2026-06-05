import os
import sys
import django
import pandas as pd
from django.db import transaction

sys.path.append(os.path.abspath('BACKEND_REORDENAMIENTO_EMI'))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from apps.laboratorios.models import Equipo
from apps.estructura_academica.models import UnidadAcademica

EXCEL_PATH = "/Users/alvaroencinas/Desktop/REORDENAMIENTO_EMI/EQUIPO MEDICO Y LAB. UALP EMI.xlsx"

def normalize_estado(est):
    """Convierte el estado del excel a las opciones del modelo."""
    if pd.isna(est):
        return "bueno"
    e = str(est).strip().lower()
    if e in ["bueno", "regular", "malo"]:
        return e
    return "bueno"

def run_import():
    print("=== INICIANDO PURGA Y REIMPORTACIÓN UALP ===")
    
    # 1. Purga Transaccional
    with transaction.atomic():
        qs_delete = Equipo.objects.filter(unidad_academica_id=1)
        count_deleted = qs_delete.count()
        print(f"Purgando {count_deleted} equipos de UALP...")
        qs_delete.delete()
        
        # Verificar purga
        if Equipo.objects.filter(unidad_academica_id=1).exists():
            raise Exception("La purga falló. Abortando transacción.")
        print("Purga completada exitosamente.")
    
    # 2. Carga del Excel
    print("\nLeyendo Excel...")
    df = pd.read_excel(EXCEL_PATH, header=6)
    df.columns = df.columns.astype(str).str.strip().str.upper()
    
    # Filtrar
    df_valid = df[df['CÓDIGO'].notna() & (df['CÓDIGO'].astype(str).str.strip().str.upper() != 'CANTIDAD')]
    print(f"Filas a importar: {len(df_valid)}")
    
    ualp = UnidadAcademica.objects.get(codigo="0001")
    
    equipos_a_crear = []
    
    for idx, row in df_valid.iterrows():
        cod = str(row['CÓDIGO']).strip()
        nombre = str(row['DESCRIPCIÓN DEL BIEN']).strip()
        obs = str(row['OBSERVACIONES']).strip() if pd.notna(row['OBSERVACIONES']) else ""
        estado = normalize_estado(row['ESTADO'])
        
        oficina = str(row['OFICINA']).strip() if pd.notna(row['OFICINA']) else ""
        
        especificaciones = {
            "oficina_original_excel": oficina,
            "costo_historico": str(row['COSTO HISTORICO']) if pd.notna(row['COSTO HISTORICO']) else "",
            "fecha_historico": str(row['FECHA HISTORICO']) if pd.notna(row['FECHA HISTORICO']) else "",
            "vida_util_consumida_anos": str(row['VIDA UTIL CONSUMIDA (EN AÑOS)']) if pd.notna(row['VIDA UTIL CONSUMIDA (EN AÑOS)']) else "",
            "grupo_contable": str(row['GRUPO CONTABLE']) if pd.notna(row['GRUPO CONTABLE']) else "",
            "auxiliar": str(row['AUXILIAR']) if pd.notna(row['AUXILIAR']) else "",
            "responsable": str(row['RESPONSABLE']) if pd.notna(row['RESPONSABLE']) else "",
            "cargo": str(row['CARGO']) if pd.notna(row['CARGO']) else "",
            "carnet": str(row['CARNET']) if pd.notna(row['CARNET']) else "",
            "SIN_ASIGNAR_LABORATORIO": True
        }
        
        eq = Equipo(
            codigo_activo=cod,
            nombre=nombre,
            unidad_academica=ualp,
            laboratorio=None,  # Regla estricta
            cantidad_total=1,
            cantidad_buena=1 if estado == "bueno" else 0,
            cantidad_regular=1 if estado == "regular" else 0,
            cantidad_mala=1 if estado == "malo" else 0,
            estatus_general=estado,
            observaciones=obs,
            especificaciones=especificaciones
        )
        equipos_a_crear.append(eq)
        
    print(f"\nInsertando {len(equipos_a_crear)} equipos en BD...")
    with transaction.atomic():
        Equipo.objects.bulk_create(equipos_a_crear, batch_size=500)
        
    print("Importación completada exitosamente.")

if __name__ == "__main__":
    run_import()
