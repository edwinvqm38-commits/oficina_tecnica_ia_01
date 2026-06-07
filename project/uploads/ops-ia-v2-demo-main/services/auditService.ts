export const auditService = {
  async register(event: string, payload: Record<string, unknown>) {
    return { ok: true, event, payload, at: new Date().toISOString() };
  },
};
