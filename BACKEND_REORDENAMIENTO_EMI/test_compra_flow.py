from apps.laboratorios.models import Equipo
print("Nullable laboratorio:", Equipo._meta.get_field('laboratorio').null)
