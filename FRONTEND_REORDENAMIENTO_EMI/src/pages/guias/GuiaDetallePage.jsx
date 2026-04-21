import { useParams } from "react-router-dom";
import { PageWrapper } from "../../components/layout";
import { BookOpen } from "lucide-react";

function GuiaDetallePage() {
  const { id } = useParams();
  return (
    <PageWrapper title="Detalle de guía" description={`Guía #${id}`}>
      <div className="rounded-xl border-2 border-dashed border-gray-300 bg-white p-16 text-center shadow-sm">
        <BookOpen size={40} className="mx-auto text-gray-300 mb-4" />
        <p className="text-[17px] font-bold text-gray-600">Aquí irá el detalle de la guía seleccionada.</p>
      </div>
    </PageWrapper>
  );
}

export default GuiaDetallePage;
