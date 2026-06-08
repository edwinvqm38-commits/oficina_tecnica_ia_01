import { type Recurso, demoData } from "@/lib/sgp/demoData";

export const resourceService = {
  async list(): Promise<Recurso[]> {
    return demoData.listRecursos();
  },
};
