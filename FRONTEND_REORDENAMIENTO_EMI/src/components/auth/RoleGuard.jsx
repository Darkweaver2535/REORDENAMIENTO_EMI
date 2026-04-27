import { Navigate } from "react-router-dom";
import { useAuth } from "../../store/AuthContext";

/**
 * Componente guard para proteger rutas o fragmentos de UI por rol.
 * Si el usuario no tiene ninguno de los roles permitidos, es redirigido.
 * 
 * @param {Object} props
 * @param {string[]} props.allowedRoles - Array de roles permitidos (ej. ['admin', 'jefe'])
 * @param {string} [props.redirectTo="/dashboard"] - Ruta a la que se redirige si falla la validación
 * @param {React.ReactNode} props.children - Contenido a renderizar si es válido
 */
export default function RoleGuard({ allowedRoles = [], redirectTo = "/dashboard", children }) {
    const { hasRole } = useAuth();

    if (hasRole(...allowedRoles)) {
        return children;
    }

    return <Navigate to={redirectTo} replace />;
}
