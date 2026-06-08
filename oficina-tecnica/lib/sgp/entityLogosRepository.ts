import { supabase } from "@/lib/sgp/supabaseClient";

export type EntityLogoEntityType = "company" | "client" | "supplier" | "unit";

export type EntityLogo = {
  id: string;
  entity_type: EntityLogoEntityType;
  entity_key: string;
  display_name: string;
  logo_url: string | null;
  storage_path: string | null;
  is_default: boolean;
  is_active: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
};

export type EntityLogoInput = {
  entity_type: EntityLogoEntityType;
  entity_key: string;
  display_name: string;
  logo_url?: string | null;
  storage_path?: string | null;
  is_default?: boolean;
  is_active?: boolean;
  metadata?: Record<string, unknown>;
  created_by?: string | null;
  updated_by?: string | null;
};

type EntityLogoRow = EntityLogo;

const ENTITY_LOGOS_SELECT = `
  id,
  entity_type,
  entity_key,
  display_name,
  logo_url,
  storage_path,
  is_default,
  is_active,
  metadata,
  created_at,
  updated_at,
  created_by,
  updated_by
`;

function hasSupabaseConfig(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

function normalizeString(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

export function normalizeEntityLogoKey(value: string): string {
  return normalizeString(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function toMetadata(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function mapEntityLogo(row: EntityLogoRow): EntityLogo {
  return {
    ...row,
    metadata: toMetadata(row.metadata),
  };
}

function buildEntityLogoPayload(input: EntityLogoInput) {
  const entityKey = normalizeEntityLogoKey(input.entity_key);
  const displayName = normalizeString(input.display_name);

  if (!entityKey || !displayName) {
    throw new Error("entity_key y display_name son obligatorios para guardar un logo.");
  }

  return {
    entity_type: input.entity_type,
    entity_key: entityKey,
    display_name: displayName,
    logo_url: input.logo_url ?? null,
    storage_path: input.storage_path ?? null,
    is_default: input.is_default ?? false,
    is_active: input.is_active ?? true,
    metadata: input.metadata ?? {},
    created_by: input.created_by ?? null,
    updated_by: input.updated_by ?? null,
  };
}

export async function listEntityLogos(): Promise<EntityLogo[]> {
  if (!hasSupabaseConfig()) return [];

  const { data, error } = await supabase
    .from("entity_logos")
    .select(ENTITY_LOGOS_SELECT)
    .order("entity_type", { ascending: true })
    .order("display_name", { ascending: true });

  if (error) throw error;
  return ((data ?? []) as EntityLogoRow[]).map(mapEntityLogo);
}

export async function getActiveEntityLogos(): Promise<EntityLogo[]> {
  if (!hasSupabaseConfig()) return [];

  const { data, error } = await supabase
    .from("entity_logos")
    .select(ENTITY_LOGOS_SELECT)
    .eq("is_active", true)
    .order("entity_type", { ascending: true })
    .order("display_name", { ascending: true });

  if (error) throw error;
  return ((data ?? []) as EntityLogoRow[]).map(mapEntityLogo);
}

export async function getDefaultCompanyLogo(): Promise<EntityLogo | null> {
  if (!hasSupabaseConfig()) return null;

  const { data, error } = await supabase
    .from("entity_logos")
    .select(ENTITY_LOGOS_SELECT)
    .eq("entity_type", "company")
    .eq("is_default", true)
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data ? mapEntityLogo(data as EntityLogoRow) : null;
}

export async function getEntityLogoByKey(entityType: EntityLogoEntityType, entityKey: string): Promise<EntityLogo | null> {
  if (!hasSupabaseConfig()) return null;

  const normalizedKey = normalizeEntityLogoKey(entityKey);
  if (!normalizedKey) return null;

  const { data, error } = await supabase
    .from("entity_logos")
    .select(ENTITY_LOGOS_SELECT)
    .eq("entity_type", entityType)
    .eq("entity_key", normalizedKey)
    .eq("is_active", true)
    .maybeSingle();

  if (error) throw error;
  return data ? mapEntityLogo(data as EntityLogoRow) : null;
}

export async function upsertEntityLogo(input: EntityLogoInput): Promise<EntityLogo> {
  if (!hasSupabaseConfig()) {
    throw new Error("Supabase no está configurado para guardar logos de propuesta.");
  }

  const payload = buildEntityLogoPayload(input);
  const existing = await getEntityLogoByKey(payload.entity_type, payload.entity_key);

  if (existing) {
    const { data, error } = await supabase
      .from("entity_logos")
      .update({
        ...payload,
        created_by: existing.created_by,
      })
      .eq("id", existing.id)
      .select(ENTITY_LOGOS_SELECT)
      .single();

    if (error) throw error;
    return mapEntityLogo(data as EntityLogoRow);
  }

  const { data, error } = await supabase.from("entity_logos").insert(payload).select(ENTITY_LOGOS_SELECT).single();
  if (error) throw error;
  return mapEntityLogo(data as EntityLogoRow);
}
