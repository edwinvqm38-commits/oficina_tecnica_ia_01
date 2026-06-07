import { type Cotizacion, demoData } from "@/lib/demoData";

export const quotationService = {
  async list(): Promise<Cotizacion[]> {
    return demoData.listCotizaciones();
  },
};
