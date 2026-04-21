import { ShieldAlert, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

function ForbiddenPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-10 text-center">
        <div className="mx-auto w-20 h-20 rounded-2xl bg-red-50 flex items-center justify-center mb-6">
          <ShieldAlert size={36} className="text-red-500" />
        </div>
        <h1 className="text-[48px] font-extrabold text-gray-900 tracking-tight">403</h1>
        <p className="text-[17px] text-gray-500 font-medium mt-3 leading-relaxed">
          No tienes permisos para acceder a este recurso.
          Contacta al administrador del sistema.
        </p>
        <Link to="/dashboard"
          className="inline-flex items-center gap-2 mt-8 px-6 py-3 rounded-lg
            bg-[#002B5E] text-white text-[15px] font-bold
            hover:bg-[#001a3a] transition-all shadow-md">
          <ArrowLeft size={18} />
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}

export default ForbiddenPage;
