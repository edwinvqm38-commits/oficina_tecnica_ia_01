import { type Recurso, demoData } from "@/lib/demoData";

export const resourceService = {
  async list(): Promise<Recurso[]> {
    return demoData.listRecursos();
  },
};
