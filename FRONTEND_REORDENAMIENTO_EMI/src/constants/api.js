export const BASE_URL =
  import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

export const REQUEST_TIMEOUT_MS = 10000;

export const API_ROUTES = {
  AUTH: {
    LOGIN: `${BASE_URL}/api/v1/auth/login/`,
    REFRESH: `${BASE_URL}/api/v1/auth/token/refresh/`,
    PERFIL: `${BASE_URL}/api/v1/auth/perfil/`,
  },

  ESTRUCTURA: {
    UNIDADES: `${BASE_URL}/api/v1/estructura_academica/unidades-academicas/`,
    DEPARTAMENTOS: `${BASE_URL}/api/v1/estructura_academica/departamentos/`,
    CARRERAS: `${BASE_URL}/api/v1/estructura_academica/carreras/`,
    SEMESTRES: `${BASE_URL}/api/v1/estructura_academica/semestres/`,
    ASIGNATURAS: `${BASE_URL}/api/v1/estructura_academica/asignaturas/`,
  },

  GUIAS: {
    BASE: `${BASE_URL}/api/v1/guias/`,
    DETALLE: (id) => `${BASE_URL}/api/v1/guias/${id}/`,
    SOLICITAR_APROBACION: (id) =>
      `${BASE_URL}/api/v1/guias/${id}/solicitar-aprobacion/`,
    PUBLICAR: (id) => `${BASE_URL}/api/v1/guias/${id}/publicar/`,
    RECHAZAR: (id) => `${BASE_URL}/api/v1/guias/${id}/rechazar/`,
  },

  LABORATORIOS: {
    BASE: `${BASE_URL}/api/v1/laboratorios/`,
    DETALLE: (id) => `${BASE_URL}/api/v1/laboratorios/${id}/`,
    ANALYTICS: (id) => `${BASE_URL}/api/v1/laboratorios/${id}/analytics/`,
    EQUIPOS: `${BASE_URL}/api/v1/laboratorios/equipos/`,
    EQUIPO_DETALLE: (id) => `${BASE_URL}/api/v1/laboratorios/equipos/${id}/`,
    EVALUACION_INSITU: (id) =>
      `${BASE_URL}/api/v1/laboratorios/equipos/${id}/evaluacion-insitu/`,
  },

  REORDENAMIENTO: {
    BASE: `${BASE_URL}/api/v1/reordenamientos/`,
    DETALLE: (id) => `${BASE_URL}/api/v1/reordenamientos/${id}/`,
    AUTORIZAR: (id) => `${BASE_URL}/api/v1/reordenamientos/${id}/autorizar/`,
    EJECUTAR: (id) => `${BASE_URL}/api/v1/reordenamientos/${id}/ejecutar/`,
    COMPARATIVA_SEDES: `${BASE_URL}/api/v1/reordenamientos/comparativa-sedes/`,
  },

  DASHBOARD: {
    METRICAS: `${BASE_URL}/api/v1/dashboard/metricas/`,
  },
  
  USUARIOS: {
    BASE: `${BASE_URL}/api/v1/usuarios/`,
    DETALLE: (id) => `${BASE_URL}/api/v1/usuarios/${id}/`,
  },

  CONFIGURACION: {
    BASE: `${BASE_URL}/api/v1/configuracion/`,
  },

  EVALUACIONES: {
    LIST:   `${BASE_URL}/api/v1/evaluaciones/`,
    CREATE: `${BASE_URL}/api/v1/evaluaciones/`,
    DETAIL: (id) => `${BASE_URL}/api/v1/evaluaciones/${id}/`,
    UPDATE: (id) => `${BASE_URL}/api/v1/evaluaciones/${id}/`,
    BY_EQUIPO: (eqId) => `${BASE_URL}/api/v1/evaluaciones/?equipo=${eqId}`,
    ULTIMA: (eqId) => `${BASE_URL}/api/v1/evaluaciones/ultima-por-equipo/${eqId}/`,
  },

  MANTENIMIENTOS: {
    LIST:       `${BASE_URL}/api/v1/mantenimientos/`,
    CREATE:     `${BASE_URL}/api/v1/mantenimientos/`,
    DETAIL:     (id) => `${BASE_URL}/api/v1/mantenimientos/${id}/`,
    UPDATE:     (id) => `${BASE_URL}/api/v1/mantenimientos/${id}/`,
    DELETE:     (id) => `${BASE_URL}/api/v1/mantenimientos/${id}/`,
    BY_EQUIPO:  (eqId) => `${BASE_URL}/api/v1/mantenimientos/?equipo=${eqId}`,
  },
};


export const ROLES = {
  ESTUDIANTE: "estudiante",
  DOCENTE: "docente",
  ADMIN: "admin",
  JEFE: "jefe",
  ENCARGADO_ACTIVOS: "encargado_activos",
};

export const ESTADOS_GUIA = {
  BORRADOR: "borrador",
  PENDIENTE: "pendiente",
  APROBADO: "aprobado",
  PUBLICADO: "publicado",
};

// Compatibilidad con módulos ya creados anteriormente.
export const API_BASE_URL = BASE_URL;
export const API_ENDPOINTS = {
  auth: {
    login: API_ROUTES.AUTH.LOGIN,
    refreshToken: API_ROUTES.AUTH.REFRESH,
    perfil: API_ROUTES.AUTH.PERFIL,
    me: API_ROUTES.AUTH.PERFIL,
  },
  estructuraAcademica: {
    unidades: API_ROUTES.ESTRUCTURA.UNIDADES,
    departamentos: API_ROUTES.ESTRUCTURA.DEPARTAMENTOS,
    carreras: API_ROUTES.ESTRUCTURA.CARRERAS,
    semestres: API_ROUTES.ESTRUCTURA.SEMESTRES,
    asignaturas: API_ROUTES.ESTRUCTURA.ASIGNATURAS,
  },
  guias: {
    base: API_ROUTES.GUIAS.BASE,
    byId: API_ROUTES.GUIAS.DETALLE,
    solicitarAprobacion: API_ROUTES.GUIAS.SOLICITAR_APROBACION,
    publicar: API_ROUTES.GUIAS.PUBLICAR,
    rechazar: API_ROUTES.GUIAS.RECHAZAR,
  },
  laboratorios: {
    base: API_ROUTES.LABORATORIOS.BASE,
    byId: API_ROUTES.LABORATORIOS.DETALLE,
    analytics: API_ROUTES.LABORATORIOS.ANALYTICS,
  },
  equipos: {
    base: API_ROUTES.LABORATORIOS.EQUIPOS,
    byId: API_ROUTES.LABORATORIOS.EQUIPO_DETALLE,
    evaluacionInSitu: API_ROUTES.LABORATORIOS.EVALUACION_INSITU,
  },
  reordenamiento: {
    base: API_ROUTES.REORDENAMIENTO.BASE,
    byId: API_ROUTES.REORDENAMIENTO.DETALLE,
    autorizar: API_ROUTES.REORDENAMIENTO.AUTORIZAR,
    ejecutar: API_ROUTES.REORDENAMIENTO.EJECUTAR,
    comparativaSedes: API_ROUTES.REORDENAMIENTO.COMPARATIVA_SEDES,
  },
  reordenamientos: {
    base: API_ROUTES.REORDENAMIENTO.BASE,
    byId: API_ROUTES.REORDENAMIENTO.DETALLE,
    autorizar: API_ROUTES.REORDENAMIENTO.AUTORIZAR,
    ejecutar: API_ROUTES.REORDENAMIENTO.EJECUTAR,
    comparativaSedes: API_ROUTES.REORDENAMIENTO.COMPARATIVA_SEDES,
  },
  evaluaciones: {
    base: API_ROUTES.EVALUACIONES.LIST,
    create: API_ROUTES.EVALUACIONES.CREATE,
    byId: API_ROUTES.EVALUACIONES.DETAIL,
    byEquipo: API_ROUTES.EVALUACIONES.BY_EQUIPO,
    ultima: API_ROUTES.EVALUACIONES.ULTIMA,
  },
};
