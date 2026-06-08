import { mvpOrchestrationEventsMock } from "../../../lib/ai-office/mvpMockData";
import { AIOrchestrationTimeline } from "../../../components/ai-office/AIOrchestrationTimeline";

export default function Page() {
  return (
    <div className="space-y-3">
      <div className="page-header">
        <div className="page-header-left">
          <p className="page-eyebrow">Orquestación</p>
          <h1 className="page-title">Línea de tiempo de colaboración</h1>
          <p className="page-desc">
            Eventos de orquestación entre agentes: mensajes, revisiones y puertas de aprobación.
          </p>
        </div>
      </div>
      <AIOrchestrationTimeline events={mvpOrchestrationEventsMock} />
    </div>
  );
}
