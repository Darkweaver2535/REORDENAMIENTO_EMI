import { useParams } from "react-router-dom";
import { PageWrapper } from "../../components/layout";
import { BarChart2 } from "lucide-react";

function AnalyticsPage() {
  const { id } = useParams();
  return (
    <PageWrapper title="Analytics de laboratorio" description={`Indicadores de uso para laboratorio #${id}`}>
      <div className="rounded-xl border-2 border-dashed border-gray-300 bg-white p-16 text-center shadow-sm">
        <BarChart2 size={40} className="mx-auto text-gray-300 mb-4" />
        <p className="text-[17px] font-bold text-gray-600">Aquí irán los indicadores de uso, déficit y excedentes.</p>
      </div>
    </PageWrapper>
  );
}

export default AnalyticsPage;
