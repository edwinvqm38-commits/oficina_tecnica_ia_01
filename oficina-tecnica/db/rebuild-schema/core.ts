/**
 * REBUILD-1B — Schema Drizzle (BORRADOR LOCAL)
 *
 * Definiciones de tablas del modelo de datos NUEVO descrito en
 * `docs/rebuild/REBUILD_1A_MODELO_DATOS.md`.
 *
 * IMPORTANTE:
 * - Este archivo NO se conecta a ninguna base de datos real.
 * - No genera ni ejecuta migraciones.
 * - No representa el schema legacy de Supabase (que queda congelado).
 * - NO incluye `requirements` / `requirement_items` (fuera de alcance
 *   hasta aprobación explícita del usuario — ver REBUILD-1A §7).
 * - La dependencia `drizzle-orm` aún NO está instalada en el proyecto;
 *   por lo tanto este archivo es una propuesta que todavía no puede
 *   typecheckearse contra el ORM real (ver README.md).
 *
 * Convenciones:
 * - PostgreSQL (pg-core).
 * - PK `id` uuid con default aleatorio.
 * - `createdAt` / `updatedAt` en todas las tablas de negocio.
 * - `deletedAt` (soft delete) solo en entidades con identidad propia.
 * - `status` como texto con default (no se usa pgEnum para no añadir
 *   objetos de tipo a la primera migración; se puede endurecer luego).
 * - Importes monetarios y cantidades como `numeric` (precisión fija).
 */

import {
  pgTable,
  uuid,
  text,
  numeric,
  integer,
  bigint,
  date,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";

/** Timestamps de auditoría comunes a las tablas de negocio. */
const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
};

/** Marca de borrado lógico (nullable). */
const softDelete = {
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
};

// ---------------------------------------------------------------------------
// clients
// ---------------------------------------------------------------------------
export const clients = pgTable(
  "clients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull().unique(),
    name: text("name").notNull(),
    ruc: text("ruc"),
    email: text("email"),
    phone: text("phone"),
    address: text("address"),
    status: text("status").notNull().default("active"),
    notes: text("notes"),
    ...timestamps,
    ...softDelete,
  },
  (t) => [index("clients_status_idx").on(t.status)],
);

// ---------------------------------------------------------------------------
// projects
// ---------------------------------------------------------------------------
export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id),
    code: text("code").notNull().unique(),
    name: text("name").notNull(),
    location: text("location"),
    status: text("status").notNull().default("active"),
    startDate: date("start_date"),
    endDate: date("end_date"),
    notes: text("notes"),
    ...timestamps,
    ...softDelete,
  },
  (t) => [
    index("projects_client_id_idx").on(t.clientId),
    index("projects_status_idx").on(t.status),
  ],
);

// ---------------------------------------------------------------------------
// suppliers
// ---------------------------------------------------------------------------
export const suppliers = pgTable(
  "suppliers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull().unique(),
    name: text("name").notNull(),
    ruc: text("ruc"),
    email: text("email"),
    phone: text("phone"),
    address: text("address"),
    status: text("status").notNull().default("active"),
    notes: text("notes"),
    ...timestamps,
    ...softDelete,
  },
  (t) => [index("suppliers_status_idx").on(t.status)],
);

// ---------------------------------------------------------------------------
// resources
// ---------------------------------------------------------------------------
export const resources = pgTable(
  "resources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull().unique(),
    description: text("description").notNull(),
    unit: text("unit").notNull(),
    category: text("category"),
    brand: text("brand"),
    model: text("model"),
    status: text("status").notNull().default("active"),
    notes: text("notes"),
    ...timestamps,
    ...softDelete,
  },
  (t) => [
    index("resources_category_idx").on(t.category),
    index("resources_status_idx").on(t.status),
  ],
);

// ---------------------------------------------------------------------------
// resource_prices  (histórico de precios; se versiona agregando filas)
// ---------------------------------------------------------------------------
export const resourcePrices = pgTable(
  "resource_prices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    resourceId: uuid("resource_id")
      .notNull()
      .references(() => resources.id),
    supplierId: uuid("supplier_id").references(() => suppliers.id),
    currency: text("currency").notNull().default("PEN"),
    unitPrice: numeric("unit_price", { precision: 14, scale: 2 }).notNull(),
    validFrom: date("valid_from"),
    validTo: date("valid_to"),
    source: text("source"),
    status: text("status").notNull().default("active"),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => [
    index("resource_prices_resource_id_idx").on(t.resourceId),
    index("resource_prices_supplier_id_idx").on(t.supplierId),
  ],
);

// ---------------------------------------------------------------------------
// quotes
// ---------------------------------------------------------------------------
export const quotes = pgTable(
  "quotes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").references(() => projects.id),
    clientId: uuid("client_id").references(() => clients.id),
    code: text("code").notNull().unique(),
    title: text("title").notNull(),
    currency: text("currency").notNull().default("PEN"),
    status: text("status").notNull().default("draft"),
    issueDate: date("issue_date"),
    dueDate: date("due_date"),
    subtotal: numeric("subtotal", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    taxTotal: numeric("tax_total", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    total: numeric("total", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    notes: text("notes"),
    ...timestamps,
    ...softDelete,
  },
  (t) => [
    index("quotes_client_id_idx").on(t.clientId),
    index("quotes_project_id_idx").on(t.projectId),
    index("quotes_status_idx").on(t.status),
  ],
);

// ---------------------------------------------------------------------------
// quote_items
// ---------------------------------------------------------------------------
export const quoteItems = pgTable(
  "quote_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    quoteId: uuid("quote_id")
      .notNull()
      .references(() => quotes.id, { onDelete: "cascade" }),
    resourceId: uuid("resource_id").references(() => resources.id),
    itemCode: text("item_code"),
    description: text("description").notNull(),
    unit: text("unit").notNull(),
    quantity: numeric("quantity", { precision: 14, scale: 4 }).notNull(),
    unitPrice: numeric("unit_price", { precision: 14, scale: 2 }).notNull(),
    total: numeric("total", { precision: 14, scale: 2 }).notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => [
    index("quote_items_quote_id_idx").on(t.quoteId),
    index("quote_items_resource_id_idx").on(t.resourceId),
  ],
);

// ---------------------------------------------------------------------------
// activity_logs  (auditoría ligera, polimórfica; sin FK fuerte)
// ---------------------------------------------------------------------------
export const activityLogs = pgTable(
  "activity_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id"),
    action: text("action").notNull(),
    message: text("message").notNull(),
    metadata: jsonb("metadata"),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("activity_logs_entity_idx").on(t.entityType, t.entityId),
    index("activity_logs_created_at_idx").on(t.createdAt),
  ],
);

// ---------------------------------------------------------------------------
// attachments  (solo metadata; el archivo vive en storage externo)
// ---------------------------------------------------------------------------
export const attachments = pgTable(
  "attachments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id"),
    fileName: text("file_name").notNull(),
    fileType: text("file_type"),
    fileSize: bigint("file_size", { mode: "number" }),
    storageProvider: text("storage_provider"),
    storagePath: text("storage_path"),
    description: text("description"),
    uploadedBy: text("uploaded_by"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("attachments_entity_idx").on(t.entityType, t.entityId)],
);

// ---------------------------------------------------------------------------
// Tipos inferidos (select / insert)
// ---------------------------------------------------------------------------
export type Client = typeof clients.$inferSelect;
export type NewClient = typeof clients.$inferInsert;

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;

export type Supplier = typeof suppliers.$inferSelect;
export type NewSupplier = typeof suppliers.$inferInsert;

export type Resource = typeof resources.$inferSelect;
export type NewResource = typeof resources.$inferInsert;

export type ResourcePrice = typeof resourcePrices.$inferSelect;
export type NewResourcePrice = typeof resourcePrices.$inferInsert;

export type Quote = typeof quotes.$inferSelect;
export type NewQuote = typeof quotes.$inferInsert;

export type QuoteItem = typeof quoteItems.$inferSelect;
export type NewQuoteItem = typeof quoteItems.$inferInsert;

export type ActivityLog = typeof activityLogs.$inferSelect;
export type NewActivityLog = typeof activityLogs.$inferInsert;

export type Attachment = typeof attachments.$inferSelect;
export type NewAttachment = typeof attachments.$inferInsert;
