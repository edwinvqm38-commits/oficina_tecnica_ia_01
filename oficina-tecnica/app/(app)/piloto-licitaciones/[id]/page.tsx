import { notFound } from "next/navigation";
import { PilotoLicitacionDetailContent } from "@/components/sgp/piloto-licitaciones/PilotoLicitacionDetailContent";
import { getPilotoLicitacionById } from "@/lib/demo/piloto-licitaciones";

type PilotoDetallePageProps = {
  params: Promise<{ id: string }>;
};

export default async function PilotoLicitacionDetallePage({ params }: PilotoDetallePageProps) {
  const { id } = await params;
  const item = getPilotoLicitacionById(id);

  if (!item) notFound();

  return <PilotoLicitacionDetailContent item={item} />;
}
