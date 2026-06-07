export const RESOURCE_TYPES = [
  "Material",
  "Equipo",
  "Herramienta",
  "Consumible",
  "Servicio",
  "EPP",
  "Subcontrato",
  "Otro",
] as const;

export const RESOURCE_UNITS = ["und", "m", "m2", "m3", "kg", "glb", "día", "mes", "h", "juego", "lote"] as const;

export const RESOURCE_CURRENCIES = ["PEN", "USD"] as const;

export const RESOURCE_STATES = ["Activo", "Inactivo", "Por revisar"] as const;

export const RESOURCE_SUPPLIERS = [
  "Suministros Lima",
  "ElectroSur",
  "Proveedor Industrial",
  "Servicios Técnicos",
  "Ferretería Central",
] as const;

export const RESOURCE_BRANDS = ["Schneider", "Indeco", "3M", "Fluke", "Siemens", "ABB", "Genérico", "Sin marca"] as const;
