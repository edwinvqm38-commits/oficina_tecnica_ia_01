"use client";
// Read-only data viewer for the Administrador "Datos" tab — lets an admin
// confirm what cotizaciones/requerimientos/recursos are actually visible
// under current RLS/grants, without exposing any edit/delete action. Each
// fetch returns the raw Supabase error message (if any) instead of falling
// back to demo data, so a real "permission denied"/RLS-filtered-empty case
// is distinguishable from a genuinely empty table.

import { supabase } from "../supabaseClient";

const PAGE_SIZE = 25;

export type AdminTableResult<T> = {
  rows: T[];
  total: number;
  error: string | null;
};

export type CotizacionAdminRow = {
  id: string;
  codigo: string;
  cliente_nombre: string | null;
  proyecto: string | null;
  estado: string | null;
  responsable_tecnico: string | null;
};

export type RequerimientoAdminRow = {
  id: string;
  codigo: string;
  estado: string | null;
  responsable: string | null;
  cotizacion_codigo: string | null;
  fecha_requerida: string | null;
};

export type RecursoAdminRow = {
  id: string;
  codigo_recurso: string | null;
  descripcion: string | null;
  tipo_recurso_nombre: string | null;
  estado: string | null;
};

export async function fetchCotizacionesAdmin(page = 1): Promise<AdminTableResult<CotizacionAdminRow>> {
  const from = (page - 1) * PAGE_SIZE;
  const { data, error, count } = await supabase
    .from("cotizaciones")
    .select("id, codigo, cliente_nombre, proyecto, estado, responsable_tecnico", { count: "exact" })
    .order("codigo", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);
  return { rows: (data as CotizacionAdminRow[]) ?? [], total: count ?? 0, error: error?.message ?? null };
}

export async function fetchRequerimientosAdmin(page = 1): Promise<AdminTableResult<RequerimientoAdminRow>> {
  const from = (page - 1) * PAGE_SIZE;
  const { data, error, count } = await supabase
    .from("requerimientos")
    .select("id, codigo, estado, responsable, cotizacion_codigo, fecha_requerida", { count: "exact" })
    .order("codigo", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);
  return { rows: (data as RequerimientoAdminRow[]) ?? [], total: count ?? 0, error: error?.message ?? null };
}

export async function fetchRecursosAdmin(page = 1): Promise<AdminTableResult<RecursoAdminRow>> {
  const from = (page - 1) * PAGE_SIZE;
  const { data, error, count } = await supabase
    .from("recursos")
    .select("id, codigo_recurso, descripcion, tipo_recurso_nombre, estado", { count: "exact" })
    .is("deleted_at", null)
    .order("codigo_recurso", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);
  return { rows: (data as RecursoAdminRow[]) ?? [], total: count ?? 0, error: error?.message ?? null };
}

export { PAGE_SIZE as ADMIN_TABLE_PAGE_SIZE };
