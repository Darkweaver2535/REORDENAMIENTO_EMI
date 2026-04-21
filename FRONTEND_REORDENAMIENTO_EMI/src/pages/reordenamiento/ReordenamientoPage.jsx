import { PageWrapper } from "../../components/layout";
import { ArrowLeftRight } from "lucide-react";

function ReordenamientoPage() {
  return (
    <PageWrapper title="Reordenamiento" description="Módulo para gestionar procesos de reordenamiento.">
      <div className="rounded-xl border-2 border-dashed border-gray-300 bg-white p-16 text-center shadow-sm">
        <ArrowLeftRight size={40} className="mx-auto text-gray-300 mb-4" />
        <p className="text-[17px] font-bold text-gray-600">Aquí irá la vista de reordenamiento.</p>
      </div>
    </PageWrapper>
  );
}

export default ReordenamientoPage;
