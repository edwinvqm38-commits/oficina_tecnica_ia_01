"use client";

import { useEffect, useMemo, useState } from "react";
import { CatalogFormModal } from "@/components/sgp/catalogs/CatalogFormModal";
import { CatalogTable } from "@/components/sgp/catalogs/CatalogTable";
import { FieldLabelIcon } from "@/components/sgp/ui/FieldLabelIcon";
import {
  listCatalogMap,
  removeCatalogItem,
  saveCatalogItem,
  type CatalogKey as PersistedCatalogKey,
} from "@/lib/sgp/catalogsRepository";
import {
  type CatalogCodigoCliente,
  type CatalogCodigoUnidadTrabajo,
  type CatalogAprobacionItem,
  type CatalogArea,
  type CatalogEstadoCotizacion,
  type CatalogEstadoDetalleRq,
  type CatalogEstadoRecurso,
  type CatalogLogisticaCompraItem,
  type CatalogMarca,
  type CatalogMoneda,
  type CatalogProveedor,
  type CatalogSolicitanteCotizacion,
  type CatalogSolicitanteRq,
  type CatalogTipoServicio,
  type CatalogTipoRecurso,
  type CatalogUnidad,
  type ProyectoAdjudicado,
  demoData,
} from "@/lib/sgp/demoData";

type TabKey =
  | "tipos"
  | "unidades"
  | "marcas"
  | "proveedores"
  | "monedas"
  | "estados"
  | "estadoDetalle"
  | "eq"
  | "ll"
  | "hb"
  | "logistica"
  | "tipoServicio"
  | "area"
  | "solicitantesRq"
  | "solicitantesCotizacion"
  | "estadosCotizacion"
  | "codigosCliente"
  | "codigosUnidad"
  | "proyectosAdjudicados";
type CatalogRecord =
  | CatalogCodigoCliente
  | CatalogCodigoUnidadTrabajo
  | ProyectoAdjudicado
  | CatalogTipoRecurso
  | CatalogUnidad
  | CatalogMarca
  | CatalogProveedor
  | CatalogMoneda
  | CatalogEstadoRecurso
  | CatalogEstadoDetalleRq
  | CatalogAprobacionItem
  | CatalogLogisticaCompraItem
  | CatalogTipoServicio
  | CatalogArea
  | CatalogSolicitanteRq
  | CatalogSolicitanteCotizacion
  | CatalogEstadoCotizacion;
type CatalogField = { key: string; label: string; type: "text" | "number" | "email"; required?: boolean };
type CatalogColumn = { key: string; title: string };

const tabGroups: Array<{ group: string; tabs: Array<{ key: TabKey; label: string }> }> = [
  {
    group: "Recursos",
    tabs: [
      { key: "tipos", label: "Tipo recurso" },
      { key: "unidades", label: "Unidades" },
      { key: "marcas", label: "Marcas" },
      { key: "proveedores", label: "Proveedores" },
      { key: "monedas", label: "Monedas" },
      { key: "estados", label: "Estados recurso" },
    ],
  },
  {
    group: "Requerimientos",
    tabs: [
      { key: "tipoServicio", label: "Tipo de servicio" },
      { key: "area", label: "Área" },
      { key: "solicitantesRq", label: "Solicitantes de RQ" },
    ],
  },
  {
    group: "Detalle RQ",
    tabs: [
      { key: "estadoDetalle", label: "Estado detalle RQ" },
      { key: "eq", label: "VB Económico" },
      { key: "ll", label: "VB Técnico" },
      { key: "hb", label: "VB Atención" },
      { key: "logistica", label: "Logística compra" },
    ],
  },
  {
    group: "Cotizaciones",
    tabs: [
      { key: "solicitantesCotizacion", label: "Solicitantes de cotización" },
      { key: "estadosCotizacion", label: "Estado de oferta" },
      { key: "codigosCliente", label: "Leyenda clientes" },
      { key: "codigosUnidad", label: "Leyenda unidades" },
      { key: "proyectosAdjudicados", label: "Proyectos adjudicados / OC" },
    ],
  },
];

const tabCatalogKey: Record<TabKey, PersistedCatalogKey> = {
  tipos: "catalogTipoRecurso",
  unidades: "catalogUnidades",
  marcas: "catalogMarcas",
  proveedores: "catalogProveedores",
  monedas: "catalogMonedas",
  estados: "catalogEstadosRecurso",
  estadoDetalle: "catalogEstadoDetalleRq",
  eq: "catalogEq",
  ll: "catalogLl",
  hb: "catalogHb",
  logistica: "catalogLogisticaCompra",
  tipoServicio: "catalogTipoServicio",
  area: "catalogArea",
  solicitantesRq: "catalogSolicitanteRq",
  solicitantesCotizacion: "catalogSolicitanteCotizacion",
  estadosCotizacion: "catalogEstadoCotizacion",
  codigosCliente: "catalogCodigoClientes",
  codigosUnidad: "catalogCodigoUnidadesTrabajo",
  proyectosAdjudicados: "proyectosAdjudicados",
};

function safeUuid(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    // Fallback for insecure contexts (HTTP over LAN) where randomUUID may throw.
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export default function DatosContent() {
  const [activeTab, setActiveTab] = useState<TabKey>("tipos");
  const [tipos, setTipos] = useState(() => demoData.listCatalogTipoRecurso());
  const [unidades, setUnidades] = useState(() => demoData.listCatalogUnidades());
  const [marcas, setMarcas] = useState(() => demoData.listCatalogMarcas());
  const [proveedores, setProveedores] = useState(() => demoData.listCatalogProveedores());
  const [monedas, setMonedas] = useState(() => demoData.listCatalogMonedas());
  const [estados, setEstados] = useState(() => demoData.listCatalogEstadosRecurso());
  const [estadosDetalle, setEstadosDetalle] = useState(() => demoData.listCatalogEstadoDetalleRq());
  const [eqOptions, setEqOptions] = useState(() => demoData.listCatalogEq());
  const [llOptions, setLlOptions] = useState(() => demoData.listCatalogLl());
  const [hbOptions, setHbOptions] = useState(() => demoData.listCatalogHb());
  const [logisticaOptions, setLogisticaOptions] = useState(() => demoData.listCatalogLogisticaCompra());
  const [tiposServicio, setTiposServicio] = useState(() => demoData.listCatalogTipoServicio());
  const [areas, setAreas] = useState(() => demoData.listCatalogArea());
  const [solicitantesRq, setSolicitantesRq] = useState(() => demoData.listCatalogSolicitanteRq());
  const [solicitantesCotizacion, setSolicitantesCotizacion] = useState(() =>
    demoData.listCatalogSolicitanteCotizacion(),
  );
  const [estadosCotizacion, setEstadosCotizacion] = useState(() => demoData.listCatalogEstadoCotizacion());
  const [codigosCliente, setCodigosCliente] = useState(() => demoData.listCatalogCodigoClientes());
  const [codigosUnidad, setCodigosUnidad] = useState(() => demoData.listCatalogCodigoUnidadesTrabajo());
  const [proyectosAdjudicados, setProyectosAdjudicados] = useState(() => demoData.listProyectosAdjudicados());
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CatalogRecord | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [loadingCatalogs, setLoadingCatalogs] = useState(false);

  const resources = useMemo(() => demoData.listRecursos(), []);
  const requerimientos = useMemo(() => demoData.listRequerimientos(), []);
  const cotizaciones = useMemo(() => demoData.listCotizaciones(), []);

  function applyCatalogs(catalogs: Partial<Record<PersistedCatalogKey, CatalogRecord[]>>) {
    setTipos((catalogs.catalogTipoRecurso ?? demoData.listCatalogTipoRecurso()) as CatalogTipoRecurso[]);
    setUnidades((catalogs.catalogUnidades ?? demoData.listCatalogUnidades()) as CatalogUnidad[]);
    setMarcas((catalogs.catalogMarcas ?? demoData.listCatalogMarcas()) as CatalogMarca[]);
    setProveedores((catalogs.catalogProveedores ?? demoData.listCatalogProveedores()) as CatalogProveedor[]);
    setMonedas((catalogs.catalogMonedas ?? demoData.listCatalogMonedas()) as CatalogMoneda[]);
    setEstados((catalogs.catalogEstadosRecurso ?? demoData.listCatalogEstadosRecurso()) as CatalogEstadoRecurso[]);
    setEstadosDetalle((catalogs.catalogEstadoDetalleRq ?? demoData.listCatalogEstadoDetalleRq()) as CatalogEstadoDetalleRq[]);
    setEqOptions((catalogs.catalogEq ?? demoData.listCatalogEq()) as CatalogAprobacionItem[]);
    setLlOptions((catalogs.catalogLl ?? demoData.listCatalogLl()) as CatalogAprobacionItem[]);
    setHbOptions((catalogs.catalogHb ?? demoData.listCatalogHb()) as CatalogAprobacionItem[]);
    setLogisticaOptions(
      (catalogs.catalogLogisticaCompra ?? demoData.listCatalogLogisticaCompra()) as CatalogLogisticaCompraItem[],
    );
    setTiposServicio((catalogs.catalogTipoServicio ?? demoData.listCatalogTipoServicio()) as CatalogTipoServicio[]);
    setAreas((catalogs.catalogArea ?? demoData.listCatalogArea()) as CatalogArea[]);
    setSolicitantesRq((catalogs.catalogSolicitanteRq ?? demoData.listCatalogSolicitanteRq()) as CatalogSolicitanteRq[]);
    setSolicitantesCotizacion(
      (catalogs.catalogSolicitanteCotizacion ?? demoData.listCatalogSolicitanteCotizacion()) as CatalogSolicitanteCotizacion[],
    );
    setEstadosCotizacion((catalogs.catalogEstadoCotizacion ?? demoData.listCatalogEstadoCotizacion()) as CatalogEstadoCotizacion[]);
    setCodigosCliente((catalogs.catalogCodigoClientes ?? demoData.listCatalogCodigoClientes()) as CatalogCodigoCliente[]);
    setCodigosUnidad(
      (catalogs.catalogCodigoUnidadesTrabajo ?? demoData.listCatalogCodigoUnidadesTrabajo()) as CatalogCodigoUnidadTrabajo[],
    );
    setProyectosAdjudicados((catalogs.proyectosAdjudicados ?? demoData.listProyectosAdjudicados()) as ProyectoAdjudicado[]);
  }

  async function reloadCatalogsFromSupabase() {
    const result = await listCatalogMap();
    applyCatalogs(result.catalogs);
    setWarning(result.error ?? null);
  }

  function refresh() {
    setTipos(demoData.listCatalogTipoRecurso());
    setUnidades(demoData.listCatalogUnidades());
    setMarcas(demoData.listCatalogMarcas());
    setProveedores(demoData.listCatalogProveedores());
    setMonedas(demoData.listCatalogMonedas());
    setEstados(demoData.listCatalogEstadosRecurso());
    setEstadosDetalle(demoData.listCatalogEstadoDetalleRq());
    setEqOptions(demoData.listCatalogEq());
    setLlOptions(demoData.listCatalogLl());
    setHbOptions(demoData.listCatalogHb());
    setLogisticaOptions(demoData.listCatalogLogisticaCompra());
    setTiposServicio(demoData.listCatalogTipoServicio());
    setAreas(demoData.listCatalogArea());
    setSolicitantesRq(demoData.listCatalogSolicitanteRq());
    setSolicitantesCotizacion(demoData.listCatalogSolicitanteCotizacion());
    setEstadosCotizacion(demoData.listCatalogEstadoCotizacion());
    setCodigosCliente(demoData.listCatalogCodigoClientes());
    setCodigosUnidad(demoData.listCatalogCodigoUnidadesTrabajo());
    setProyectosAdjudicados(demoData.listProyectosAdjudicados());
  }

  useEffect(() => {
    let active = true;
    setLoadingCatalogs(true);
    listCatalogMap()
      .then((result) => {
        if (!active) return;
        applyCatalogs(result.catalogs);
        setWarning(result.error ?? null);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setWarning(error instanceof Error ? error.message : "No se pudieron cargar los catálogos desde Supabase.");
      })
      .finally(() => {
        if (active) setLoadingCatalogs(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const rows = useMemo(() => {
    if (activeTab === "tipos") return tipos;
    if (activeTab === "unidades") return unidades;
    if (activeTab === "marcas") return marcas;
    if (activeTab === "proveedores") return proveedores;
    if (activeTab === "monedas") return monedas;
    if (activeTab === "estadoDetalle") return estadosDetalle;
    if (activeTab === "eq") return eqOptions;
    if (activeTab === "ll") return llOptions;
    if (activeTab === "hb") return hbOptions;
    if (activeTab === "logistica") return logisticaOptions;
    if (activeTab === "tipoServicio") return tiposServicio;
    if (activeTab === "area") return areas;
    if (activeTab === "solicitantesRq") return solicitantesRq;
    if (activeTab === "solicitantesCotizacion") return solicitantesCotizacion;
    if (activeTab === "estadosCotizacion") return estadosCotizacion;
    if (activeTab === "codigosCliente") return codigosCliente;
    if (activeTab === "codigosUnidad") return codigosUnidad;
    if (activeTab === "proyectosAdjudicados") return proyectosAdjudicados;
    return estados;
  }, [
    activeTab,
    tipos,
    unidades,
    marcas,
    proveedores,
    monedas,
    estados,
    estadosDetalle,
    eqOptions,
    llOptions,
    hbOptions,
    logisticaOptions,
    tiposServicio,
    areas,
    solicitantesRq,
    solicitantesCotizacion,
    estadosCotizacion,
    codigosCliente,
    codigosUnidad,
    proyectosAdjudicados,
  ]);

  const fields = useMemo<CatalogField[]>(() => {
    if (activeTab === "tipos") {
      return [
        { key: "nombre", label: "Nombre", type: "text", required: true },
        { key: "codigo", label: "Código", type: "text", required: true },
        { key: "orden", label: "Orden", type: "number" },
        { key: "observaciones", label: "Observaciones", type: "text" },
      ];
    }
    if (activeTab === "unidades") {
      return [
        { key: "codigo", label: "Código", type: "text", required: true },
        { key: "nombre", label: "Nombre", type: "text", required: true },
        { key: "orden", label: "Orden", type: "number" },
      ];
    }
    if (activeTab === "marcas") {
      return [
        { key: "nombre", label: "Nombre", type: "text", required: true },
        { key: "observaciones", label: "Observaciones", type: "text" },
      ];
    }
    if (activeTab === "proveedores") {
      return [
        { key: "nombre", label: "Nombre", type: "text", required: true },
        { key: "ruc", label: "RUC", type: "text" },
        { key: "contacto", label: "Contacto", type: "text" },
        { key: "telefono", label: "Teléfono", type: "text" },
        { key: "email", label: "Email", type: "email" },
        { key: "tiempo_entrega_ref", label: "Tiempo entrega", type: "text" },
        { key: "observaciones", label: "Observaciones", type: "text" },
      ];
    }
    if (activeTab === "monedas") {
      return [
        { key: "codigo", label: "Código", type: "text", required: true },
        { key: "simbolo", label: "Símbolo", type: "text", required: true },
        { key: "nombre", label: "Nombre", type: "text", required: true },
      ];
    }
    if (
      activeTab === "estadoDetalle" ||
      activeTab === "eq" ||
      activeTab === "ll" ||
      activeTab === "hb" ||
      activeTab === "logistica" ||
      activeTab === "tipoServicio" ||
      activeTab === "area" ||
      activeTab === "solicitantesRq" ||
      activeTab === "solicitantesCotizacion" ||
      activeTab === "estadosCotizacion"
    ) {
      return [
        { key: "nombre", label: "Nombre", type: "text", required: true },
        { key: "orden", label: "Orden", type: "number" },
      ];
    }
    if (activeTab === "codigosCliente") {
      return [
        { key: "cliente", label: "Cliente", type: "text", required: true },
        { key: "codigo_cliente", label: "Código cliente", type: "text", required: true },
        { key: "estado", label: "Estado", type: "text", required: true },
        { key: "observaciones", label: "Observaciones", type: "text" },
      ];
    }
    if (activeTab === "codigosUnidad") {
      return [
        { key: "unidad_trabajo", label: "Unidad de trabajo", type: "text", required: true },
        { key: "codigo_unidad", label: "Código unidad", type: "text", required: true },
        { key: "estado", label: "Estado", type: "text", required: true },
        { key: "observaciones", label: "Observaciones", type: "text" },
      ];
    }
    if (activeTab === "proyectosAdjudicados") {
      return [
        { key: "anio", label: "Año", type: "number", required: true },
        { key: "codigo_proyecto", label: "Código proyecto", type: "text", required: true },
        { key: "cotizacion", label: "Cotización", type: "text", required: true },
        { key: "oc", label: "OC", type: "text", required: true },
        { key: "cliente", label: "Cliente", type: "text", required: true },
        { key: "codigo_cliente", label: "Código cliente", type: "text", required: true },
        { key: "unidad_trabajo", label: "Unidad de trabajo", type: "text", required: true },
        { key: "codigo_unidad", label: "Código unidad", type: "text", required: true },
        { key: "fecha_adjudicacion", label: "Fecha adjudicación", type: "text", required: true },
        { key: "estado", label: "Estado", type: "text", required: true },
      ];
    }
    return [
      { key: "nombre", label: "Nombre", type: "text", required: true },
      { key: "orden", label: "Orden", type: "number" },
    ];
  }, [activeTab]);

  const columns = useMemo<CatalogColumn[]>(() => {
    if (activeTab === "tipos") {
      return [
        { key: "nombre", title: "Nombre" },
        { key: "codigo", title: "Código" },
        { key: "orden", title: "Orden" },
        { key: "activo", title: "Activo" },
      ];
    }
    if (activeTab === "unidades") {
      return [
        { key: "codigo", title: "Código" },
        { key: "nombre", title: "Nombre" },
        { key: "orden", title: "Orden" },
        { key: "activo", title: "Activo" },
      ];
    }
    if (activeTab === "marcas") {
      return [
        { key: "nombre", title: "Nombre" },
        { key: "activo", title: "Activo" },
      ];
    }
    if (activeTab === "proveedores") {
      return [
        { key: "nombre", title: "Nombre" },
        { key: "ruc", title: "RUC" },
        { key: "contacto", title: "Contacto" },
        { key: "email", title: "Email" },
        { key: "activo", title: "Activo" },
      ];
    }
    if (activeTab === "monedas") {
      return [
        { key: "codigo", title: "Código" },
        { key: "simbolo", title: "Símbolo" },
        { key: "nombre", title: "Nombre" },
        { key: "activo", title: "Activo" },
      ];
    }
    if (
      activeTab === "estadoDetalle" ||
      activeTab === "eq" ||
      activeTab === "ll" ||
      activeTab === "hb" ||
      activeTab === "logistica" ||
      activeTab === "tipoServicio" ||
      activeTab === "area" ||
      activeTab === "solicitantesRq" ||
      activeTab === "solicitantesCotizacion" ||
      activeTab === "estadosCotizacion"
    ) {
      return [
        { key: "nombre", title: "Nombre" },
        { key: "orden", title: "Orden" },
        { key: "activo", title: "Activo" },
      ];
    }
    if (activeTab === "codigosCliente") {
      return [
        { key: "cliente", title: "Cliente" },
        { key: "codigo_cliente", title: "Código cliente" },
        { key: "estado", title: "Estado" },
        { key: "observaciones", title: "Observaciones" },
        { key: "activo", title: "Activo" },
      ];
    }
    if (activeTab === "codigosUnidad") {
      return [
        { key: "unidad_trabajo", title: "Unidad de trabajo" },
        { key: "codigo_unidad", title: "Código unidad" },
        { key: "estado", title: "Estado" },
        { key: "observaciones", title: "Observaciones" },
        { key: "activo", title: "Activo" },
      ];
    }
    if (activeTab === "proyectosAdjudicados") {
      return [
        { key: "anio", title: "Año" },
        { key: "codigo_proyecto", title: "Código proyecto" },
        { key: "cotizacion", title: "Cotización" },
        { key: "oc", title: "OC" },
        { key: "cliente", title: "Cliente" },
        { key: "codigo_cliente", title: "Código cliente" },
        { key: "unidad_trabajo", title: "Unidad de trabajo" },
        { key: "codigo_unidad", title: "Código unidad" },
        { key: "fecha_adjudicacion", title: "Fecha adjudicación" },
        { key: "estado", title: "Estado" },
        { key: "activo", title: "Activo" },
      ];
    }
    return [
      { key: "nombre", title: "Nombre" },
      { key: "orden", title: "Orden" },
      { key: "activo", title: "Activo" },
    ];
  }, [activeTab]);

  function openNew() {
    const baseId = `cat-${safeUuid()}`;
    if (activeTab === "tipos") {
      setEditing({ id: baseId, nombre: "", codigo: "", activo: true, orden: tipos.length + 1, observaciones: "" });
    } else if (activeTab === "unidades") {
      setEditing({ id: baseId, codigo: "", nombre: "", activo: true, orden: unidades.length + 1 });
    } else if (activeTab === "marcas") {
      setEditing({ id: baseId, nombre: "", activo: true, observaciones: "" });
    } else if (activeTab === "proveedores") {
      setEditing({
        id: baseId,
        nombre: "",
        ruc: "",
        contacto: "",
        telefono: "",
        email: "",
        tiempo_entrega_ref: "",
        activo: true,
        observaciones: "",
      });
    } else if (activeTab === "monedas") {
      setEditing({ id: baseId, codigo: "", simbolo: "", nombre: "", activo: true });
    } else if (activeTab === "estadoDetalle") {
      setEditing({ id: baseId, nombre: "", activo: true, orden: estadosDetalle.length + 1 });
    } else if (activeTab === "eq") {
      setEditing({ id: baseId, nombre: "", activo: true, orden: eqOptions.length + 1 });
    } else if (activeTab === "ll") {
      setEditing({ id: baseId, nombre: "", activo: true, orden: llOptions.length + 1 });
    } else if (activeTab === "hb") {
      setEditing({ id: baseId, nombre: "", activo: true, orden: hbOptions.length + 1 });
    } else if (activeTab === "logistica") {
      setEditing({ id: baseId, nombre: "", activo: true, orden: logisticaOptions.length + 1 });
    } else if (activeTab === "tipoServicio") {
      setEditing({ id: baseId, nombre: "", activo: true, orden: tiposServicio.length + 1 });
    } else if (activeTab === "area") {
      setEditing({ id: baseId, nombre: "", activo: true, orden: areas.length + 1 });
    } else if (activeTab === "solicitantesRq") {
      setEditing({ id: baseId, nombre: "", activo: true, orden: solicitantesRq.length + 1 });
    } else if (activeTab === "solicitantesCotizacion") {
      setEditing({ id: baseId, nombre: "", activo: true, orden: solicitantesCotizacion.length + 1 });
    } else if (activeTab === "estadosCotizacion") {
      setEditing({ id: baseId, nombre: "Pendiente", activo: true, orden: estadosCotizacion.length + 1 });
    } else if (activeTab === "codigosCliente") {
      setEditing({
        id: baseId,
        cliente: "",
        codigo_cliente: "",
        estado: "Activo",
        observaciones: "",
        activo: true,
      });
    } else if (activeTab === "codigosUnidad") {
      setEditing({
        id: baseId,
        unidad_trabajo: "",
        codigo_unidad: "",
        estado: "Activo",
        observaciones: "",
        activo: true,
      });
    } else if (activeTab === "proyectosAdjudicados") {
      setEditing({
        id: baseId,
        anio: new Date().getFullYear(),
        codigo_proyecto: "P001",
        cotizacion: "",
        oc: "",
        cliente: "",
        codigo_cliente: "",
        unidad_trabajo: "",
        codigo_unidad: "",
        fecha_adjudicacion: "",
        estado: "Activo",
        activo: true,
      });
    } else {
      setEditing({ id: baseId, nombre: "", activo: true, orden: estados.length + 1 });
    }
    setWarning(null);
    setFormOpen(true);
  }

  async function save(value: CatalogRecord) {
    try {
      await saveCatalogItem(tabCatalogKey[activeTab], value);
      await reloadCatalogsFromSupabase();
      setFormOpen(false);
      setEditing(null);
    } catch (error) {
      setWarning(error instanceof Error ? error.message : "No se pudo guardar el catálogo en Supabase.");
    }
  }

  function deactivate(row: CatalogRecord) {
    save({ ...row, activo: false } as CatalogRecord);
  }

  async function deleteRow(row: CatalogRecord) {
    const currentCotizaciones = demoData.listCotizaciones();
    const currentRequerimientos = demoData.listRequerimientos();
    const currentProjects = demoData.listProyectosAdjudicados();
    const isUsed =
      (activeTab === "tipos" && resources.some((r) => r.tipo_recurso === String((row as CatalogTipoRecurso).nombre))) ||
      (activeTab === "unidades" && resources.some((r) => r.unidad === String((row as CatalogUnidad).codigo))) ||
      (activeTab === "marcas" && resources.some((r) => r.marca === String((row as CatalogMarca).nombre))) ||
      (activeTab === "proveedores" &&
        resources.some((r) => r.proveedor === String((row as CatalogProveedor).nombre))) ||
      (activeTab === "monedas" && resources.some((r) => r.moneda === String((row as CatalogMoneda).codigo))) ||
      (activeTab === "estados" &&
        resources.some((r) => r.estado === String((row as CatalogEstadoRecurso).nombre))) ||
      (activeTab === "tipoServicio" &&
        requerimientos.some((rq) => rq.tipo_servicio === String((row as CatalogTipoServicio).nombre))) ||
      (activeTab === "area" && requerimientos.some((rq) => rq.area === String((row as CatalogArea).nombre))) ||
      (activeTab === "solicitantesRq" &&
        requerimientos.some((rq) => rq.solicitante_rq === String((row as CatalogSolicitanteRq).nombre))) ||
      (activeTab === "solicitantesCotizacion" &&
        cotizaciones.some((cot) => cot.solicitante === String((row as CatalogSolicitanteCotizacion).nombre))) ||
      (activeTab === "estadosCotizacion" &&
        cotizaciones.some((cot) => cot.estado === String((row as CatalogEstadoCotizacion).nombre))) ||
      (activeTab === "codigosCliente" &&
        (currentCotizaciones.some((cot) => cot.cliente === String((row as CatalogCodigoCliente).cliente)) ||
          currentRequerimientos.some(
            (rq) => rq.codigo_cliente === String((row as CatalogCodigoCliente).codigo_cliente),
          ) ||
          currentProjects.some(
            (project) => project.codigo_cliente === String((row as CatalogCodigoCliente).codigo_cliente),
          ))) ||
      (activeTab === "codigosUnidad" &&
        (currentCotizaciones.some(
          (cot) => cot.unidad_trabajo === String((row as CatalogCodigoUnidadTrabajo).unidad_trabajo),
        ) ||
          currentRequerimientos.some(
            (rq) => rq.codigo_unidad === String((row as CatalogCodigoUnidadTrabajo).codigo_unidad),
          ) ||
          currentProjects.some(
            (project) => project.codigo_unidad === String((row as CatalogCodigoUnidadTrabajo).codigo_unidad),
          ))) ||
      (activeTab === "proyectosAdjudicados" &&
        currentRequerimientos.some(
          (rq) =>
            rq.codigo_proyecto_adjudicado === String((row as ProyectoAdjudicado).codigo_proyecto) &&
            rq.anio === Number((row as ProyectoAdjudicado).anio),
        ));

    if (isUsed) {
      setWarning("No se puede eliminar: este registro está usado por información existente. Puedes desactivarlo.");
      return;
    }

    try {
      await removeCatalogItem(tabCatalogKey[activeTab], row.id);
      await reloadCatalogsFromSupabase();
    } catch (error) {
      setWarning(error instanceof Error ? error.message : "No se pudo eliminar el catálogo en Supabase.");
      return;
    }

  }

  return (
    <section className="sgp-page app-table-section min-w-0">
      <div className="mb-3 flex items-center justify-between">
        <FieldLabelIcon icon="layout-grid" label="Datos y catálogos" className="text-sm font-semibold text-stone-700" />
        <button
          onClick={openNew}
          className="inline-flex h-7 items-center rounded-md border border-border px-2.5 text-xs text-stone-700 hover:bg-stone-100"
        >
          + Agregar
        </button>
      </div>

      <div className="mb-3 grid gap-2 md:grid-cols-2">
        {tabGroups.map((group) => (
          <div key={group.group} className="rounded-lg border border-border bg-panel px-2 py-2">
            <p className="mb-1 text-[11px] font-semibold text-stone-600">{group.group}</p>
            <div className="flex flex-wrap gap-1">
              {group.tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => {
                    setActiveTab(tab.key);
                    setWarning(null);
                  }}
                  className={`rounded-md border px-2 py-1 text-xs ${
                    activeTab === tab.key ? "border-stone-300 bg-stone-100" : "border-border bg-panel"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {loadingCatalogs ? <p className="mb-2 text-xs text-stone-500">Cargando catálogos desde Supabase...</p> : null}
      {warning ? <p className="mb-2 text-xs text-amber-700">{warning}</p> : null}

      <CatalogTable
        rows={rows}
        columns={columns}
        onEdit={(row) => {
          setEditing(row);
          setFormOpen(true);
        }}
        onDeactivate={deactivate}
        onDelete={deleteRow}
      />

      <CatalogFormModal
        open={formOpen}
        title={editing?.id?.startsWith("cat-") ? "Nuevo registro" : "Editar registro"}
        fields={fields}
        initial={editing as Record<string, unknown> | null}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        onSave={(value) => save(value as CatalogRecord)}
      />
    </section>
  );
}
