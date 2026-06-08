import { type Cotizacion, demoData } from "@/lib/sgp/demoData";

export const quotationService = {
  async list(): Promise<Cotizacion[]> {
    return demoData.listCotizaciones();
  },
};
