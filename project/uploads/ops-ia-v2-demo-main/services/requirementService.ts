import { type Requerimiento, demoData } from "@/lib/demoData";

export const requirementService = {
  async list(): Promise<Requerimiento[]> {
    return demoData.listRequerimientos();
  },
};
