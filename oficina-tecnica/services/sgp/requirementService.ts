import { type Requerimiento, demoData } from "@/lib/sgp/demoData";

export const requirementService = {
  async list(): Promise<Requerimiento[]> {
    return demoData.listRequerimientos();
  },
};
