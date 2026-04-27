# Sistema de Gestión de Laboratorios (SGL) - EMI

![Estado](https://img.shields.io/badge/Estado-En%20Desarrollo%20(Listo%20para%20Demo)-success)
![Backend](https://img.shields.io/badge/Backend-Django%205%20%7C%20DRF-092E20?logo=django)
![Frontend](https://img.shields.io/badge/Frontend-React%20%7C%20Vite-61DAFB?logo=react&logoColor=black)
![Database](https://img.shields.io/badge/Base%20de%20Datos-PostgreSQL-336791?logo=postgresql)

El **Sistema de Gestión de Laboratorios (SGL)** es una plataforma institucional diseñada para la Escuela Militar de Ingeniería (EMI). Su objetivo principal es modernizar, centralizar y automatizar la administración de infraestructura de laboratorios, inventarios de equipos, traslados entre sedes y la gestión académica de las Guías de Laboratorio.

---

## 👨‍💻 Desarrollador
**Alvaro S. Encinas F.**  
*Ingeniero de Sistemas*

---

## 🚀 Módulos del Sistema (Estado Actual)

El proyecto se encuentra en una versión funcional avanzada (MVP / Demo), con los siguientes módulos completamente integrados entre Frontend y Backend:

### 1. Autenticación y Seguridad
- Sistema de login seguro con JWT (JSON Web Tokens).
- Control de acceso basado en roles (RBAC): Administrador, Jefe de Carrera, Encargado de Activos, Docente y Estudiante.
- Protección de rutas en el Frontend (`RoleGuard`) y permisos a nivel de API (`IsAuthenticated`, `EsAdminOJefe`, etc.).

### 2. Estructura Académica Institucional
- Gestión centralizada de Unidades Académicas (Sedes).
- Administración de Departamentos, Carreras, Semestres y Asignaturas.

### 3. Gestión de Laboratorios y Equipos
- Directorio completo de laboratorios por sede, edificio y sala.
- Inventario detallado de equipos por laboratorio (código activo, cantidad, capacidad).
- **Nuevo Sistema de Evaluaciones In-Situ:** Módulo auditable para registrar el estado físico de los equipos (distribución entre estados *Bueno*, *Regular* y *Malo*). Incluye barras de progreso visuales y consistencia estricta de sumatorias en la base de datos.
- Búsqueda y paginación *Server-Side* optimizada para grandes volúmenes de datos.

### 4. Guías de Laboratorio
- Repositorio digital de prácticas de laboratorio asociadas a asignaturas.
- Flujo de trabajo institucional: *Borrador → Pendiente → Aprobado → Publicado*.
- Restricción de publicación vinculada a números de resolución institucional.
- Almacenamiento seguro de archivos PDF.

### 5. Reordenamiento y Traslados (Logística)
- Flujo para la solicitud, autorización y ejecución de traslados de equipos entre diferentes sedes (Ej: La Paz → Cochabamba).
- Trazabilidad del cambio de laboratorio y actualización automática del inventario tras la ejecución del traslado.

### 6. Dashboard y Analítica
- Panel de control directivo con métricas en tiempo real.
- Estadísticas globales: Total de equipos, porcentaje de deterioro, laboratorios activos y guías publicadas.
- Gráficos integrados para la distribución de equipos por sede y el estado general del inventario.

---

## 🏗️ Arquitectura Técnica

### Backend (`BACKEND_REORDENAMIENTO_EMI`)
- **Framework:** Django 5.x + Django REST Framework (DRF).
- **Base de Datos:** PostgreSQL.
- **Estructura:** Arquitectura modular por aplicaciones (`auth`, `estructura_academica`, `laboratorios`, `evaluaciones`, `guias`, `reordenamiento`, `dashboard`).
- **Características:** Paginación configurada (`PageNumberPagination`), filtros de búsqueda (`SearchFilter`, `OrderingFilter`), validaciones a nivel de modelo y serializador, soporte para CORS.

### Frontend (`FRONTEND_REORDENAMIENTO_EMI`)
- **Framework:** React.js (inicializado con Vite).
- **Gestión de Estado y Caché:** `@tanstack/react-query` para sincronización con el servidor, re-fetching inteligente y optimización de red.
- **Ruteo:** `react-router-dom` con layouts anidados.
- **UI/UX:** Componentes modernos, uso intensivo de íconos (`lucide-react`), modales interactivos y notificaciones (`react-hot-toast`). Diseño completamente responsive y con branding institucional (Azul EMI, tipografías legibles).
- **Cliente HTTP:** Axios configurado con interceptores para inyección automática y refresco de tokens JWT.

---

## ⚙️ Instrucciones de Ejecución (Desarrollo Local)

### Levantar el Backend
```bash
cd BACKEND_REORDENAMIENTO_EMI
source venv/bin/activate  # o venv\Scripts\activate en Windows
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

### Levantar el Frontend
```bash
cd FRONTEND_REORDENAMIENTO_EMI
npm install
npm run dev
```

El frontend estará disponible por defecto en `http://localhost:5173` y el API del backend responderá en `http://localhost:8000/api/v1/`.

---

## 📝 Próximos Pasos (Roadmap)
- Integración final de reportes descargables en formato PDF/Excel.
- Generador de códigos QR para el pegado de etiquetas en los equipos físicos.
- Notificaciones por correo electrónico al aprobar/rechazar guías de laboratorio o traslados.
