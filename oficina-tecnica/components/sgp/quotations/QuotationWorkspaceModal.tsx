"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import { FieldLabelIcon, type IconName } from "@/components/sgp/ui/FieldLabelIcon";
import { FieldLockButton } from "@/components/sgp/ui/FieldLockButton";
import { DateTextInput } from "@/components/sgp/ui/DateTextInput";
import { QuotationCashflowDashboardView } from "@/components/sgp/quotations/QuotationCashflowDashboardView";
import { QuotationCashflowDrilldownPanel } from "@/components/sgp/quotations/QuotationCashflowDrilldownPanel";
import { QuotationMonthlyCashflowView } from "@/components/sgp/quotations/QuotationMonthlyCashflowView";
import { TechnicalProposalWorkspaceModal } from "@/components/sgp/quotations/TechnicalProposalWorkspaceModal";
import type { Cotizacion, DetalleRequerimientoItem, Recurso, Requerimiento } from "@/lib/sgp/demoData";
import { computeQuotationEconomicRows } from "@/lib/sgp/quotationEconomics";
import { collectQuotationCashflowItems, computeQuotationCashflow, computeQuotationCashflowWeeklyDrilldown, type QuotationCashflowData } from "@/lib/sgp/quotationCashflow";
import { formatCurrencyNumber, formatDate, normalizeDateForStorage } from "@/lib/sgp/utils";

type QuotationWorkspaceModalProps = {
  open: boolean;
  draft: Cotizacion | null;
  requerimientos: Requerimiento[];
  detalleItems: DetalleRequerimientoItem[];
  recursos: Recurso[];
  clientOptions: string[];
  unitOptions: string[];
  serviceTypeOptions: string[];
  solicitanteOptions: string[];
  technicalResponsibleOptions: string[];
  economicResponsibleOptions: string[];
  proposalStatusOptions: string[];
  statusOptions: Array<Cotizacion["estado"]>;
  priorityOptions: Array<Cotizacion["prioridad"]>;
  autoEditOnOpen?: boolean;
  canEditQuotation?: boolean;
  isSavingQuotation?: boolean;
  onClose: () => void;
  onSave: (finalPatch?: Partial<Cotizacion>) => boolean | void | Promise<boolean | void>;
  onDraftChange: (patch: Partial<Cotizacion>) => void;
  onEconomicRowChange: (
    tipo_recurso: string,
    patch: Partial<{ base: number; oferta: number; margen_ofertado_manual: number | null }>,
  ) => void;
  onOpenRequirement?: (requirementId: string) => void;
  onCreateRequirement?: () => RequirementCreationResult | void | Promise<RequirementCreationResult | void>;
  onDeleteRequirement?: (requirementId: string) => boolean | void | Promise<boolean | void>;
  canDeleteAssociatedRequirements?: boolean;
  requirementCreationError?: string | null;
  hiddenBusinessFields?: string[];
  canViewPrices?: boolean;
  viewGroupPermissions?: {
    quotation_general_data?: boolean;
    quotation_economic_summary?: boolean;
    quotation_related_requirements?: boolean;
    quotation_documents?: boolean;
    quotation_traceability?: boolean;
    quotation_actions?: boolean;
  };
};

type LabelValueRowProps = {
  icon: IconName;
  label: string;
  value: ReactNode;
  noBorder?: boolean;
  className?: string;
  valueAlign?: "left" | "right";
  hidden?: boolean;
};
type RequirementCreationResult = { ok: true } | { ok: false; message: string };
type PendingConfirm = {
  message: string;
  onAccept: () => unknown | Promise<unknown>;
  acceptLabel?: string;
};

const ECONOMIC_DEFAULT_COL_WIDTHS = [220, 110, 110, 130, 150, 130, 130, 120] as const;
const ECONOMIC_MIN_COL_WIDTHS = [180, 90, 90, 110, 120, 110, 110, 100] as const;
const RQ_DEFAULT_COL_WIDTHS = [230, 90, 90, 60, 30] as const;
const RQ_MIN_COL_WIDTHS = [180, 70, 80, 70, 28] as const;
const DELETABLE_NEW_RQ_CODE_PATTERN = /^RQ-\d{4}-[A-Z0-9]+-[A-Z0-9]+-P\d{3}-(\d{3}|\d{4})$/;

function compactInfoRowClassName(): string {
  return "flex h-[26px] min-h-[26px] items-center justify-between gap-2 border-b border-stone-200 py-0 leading-none";
}

function compactInputClassName(size: "sm" | "md" | "lg" | "xl" = "md"): string {
if (size === "sm") return "my-0 block h-[22px] w-[110px] min-w-[110px] max-w-[110px] self-center rounded border border-stone-300 bg-white px-1 py-0 text-[11px] leading-[20px] align-middle outline-none";  if (size === "xl") return "my-0 block h-[22px] w-full max-w-none self-center rounded border border-stone-300 bg-white px-1.5 py-0 text-[11px] leading-[20px] align-middle outline-none";
  if (size === "lg") return "my-0 block h-[22px] w-full max-w-[220px] self-center rounded border border-stone-300 bg-white px-1.5 py-0 text-[11px] leading-[20px] align-middle outline-none";
  return "my-0 block h-[22px] w-full max-w-[150px] self-center rounded border border-stone-300 bg-white px-1.5 py-0 text-[11px] leading-[20px] align-middle outline-none";
}

function editableInputClassName(size: "sm" | "md" | "lg" | "xl", editable: boolean): string {
  return `${compactInputClassName(size)} ${
    editable
      ? "text-stone-800 font-medium"
      : "cursor-default border-transparent bg-transparent text-stone-700 shadow-none appearance-none pointer-events-none text-right font-semibold"
  }`;
}

function economicInputClassName(): string {
  return "h-full w-full min-w-0 border-0 bg-transparent px-0 text-right text-[11px] font-medium leading-none text-stone-800 tabular-nums outline-none";
}

function economicMoneyCellShellClassName(editable: boolean): string {
  return `inline-flex h-6 w-full min-w-0 items-center justify-end gap-0 rounded pl-1 pr-1.5 tabular-nums ${
    editable ? "border border-transparent bg-white outline outline-1 outline-stone-300" : "border border-transparent bg-transparent"
  }`;
}

function economicReadValueClassName(): string {
  return "text-right text-[11px] leading-none text-stone-700 tabular-nums";
}

function formatSummaryNumber(value: number | null | undefined): string {
  const safeValue = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return formatCurrencyNumber(safeValue);
}

function formatSummaryEditableNumber(value: number | null | undefined): string {
  const safeValue = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return safeValue.toFixed(2);
}

function formatEditableMoneyInput(rawValue: string): string {
  const cleaned = rawValue.replace(/[^0-9.,]/g, "").replace(/,/g, "");
  if (!cleaned) return "";

  const firstDotIndex = cleaned.indexOf(".");
  const normalized =
    firstDotIndex >= 0
      ? `${cleaned.slice(0, firstDotIndex + 1)}${cleaned.slice(firstDotIndex + 1).replace(/\./g, "")}`
      : cleaned;

  const hasDot = normalized.includes(".");
  const [integerPartRaw, decimalPartRaw = ""] = normalized.split(".");
  const limitedDecimalPart = decimalPartRaw.slice(0, 4);
  const integerDigits = integerPartRaw.replace(/^0+(?=\d)/, "") || "0";
  const formattedInteger = integerDigits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  if (hasDot) return `${formattedInteger}.${limitedDecimalPart}`;
  return formattedInteger;
}

function summaryIconForType(typeName: string): IconName {
  const key = typeName.toLowerCase();
  if (key.includes("mano de obra directa")) return "hard-hat";
  if (key.includes("mano de obra indirecta")) return "users";
  if (key.includes("epps")) return "shield";
  if (key.includes("examen médico")) return "heart-pulse";
  if (key.includes("capacitaciones")) return "graduation-cap";
  if (key.includes("inducción")) return "book-open";
  if (key.includes("eka")) return "book-marked";
  if (key.includes("lavado")) return "shirt";
  if (key.includes("alimentación")) return "store";
  if (key.includes("reglamento")) return "clipboard-list";
  if (key.includes("antecedentes")) return "file-search";
  if (key.includes("materiales")) return "package";
  if (key.includes("consumibles")) return "package-open";
  if (key.includes("herramientas")) return "wrench";
  if (key.includes("equipos")) return "cog";
  if (key.includes("vehículos")) return "truck";
  if (key.includes("transporte")) return "bus";
  if (key.includes("sub contratos")) return "handshake";
  if (key.includes("gastos generales")) return "wallet";
  return "tags";
}

function readOnlyValueClassName(size: "sm" | "md" | "lg" | "xl" = "md", align: "left" | "right" = "right"): string {
  return `${compactInputClassName(size)} inline-flex items-center border-transparent bg-transparent text-stone-700 shadow-none font-semibold ${
    align === "right" ? "justify-end text-right" : "justify-start text-left"
  }`;
}

function LabelValueRow({ icon, label, value, noBorder = false, className, valueAlign = "right", hidden = false }: LabelValueRowProps) {
  return (
    <div className={`${compactInfoRowClassName()} ${noBorder ? "!border-b-0" : ""} ${className ?? ""}`}>
      {hidden ? <span className="block h-[22px]" /> : <FieldLabelIcon icon={icon} label={label} className="whitespace-nowrap leading-[22px]" />}
      <div
        className={`flex h-[22px] min-w-0 flex-1 items-center text-[11px] leading-none text-stone-700 ${
          valueAlign === "right" ? "justify-end" : "justify-start"
        }`}
      >
        {hidden ? null : value}
      </div>
    </div>
  );
}

function ModalActionIcon({ name }: { name: "cancel" | "save" | "close" }) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  if (name === "cancel") {
    return (
      <svg viewBox="0 0 24 24" className="h-[14px] w-[14px]" aria-hidden>
        <circle {...common} cx="12" cy="12" r="8" />
        <path {...common} d="m9.2 9.2 5.6 5.6M14.8 9.2l-5.6 5.6" />
      </svg>
    );
  }
  if (name === "save") {
    return (
      <svg viewBox="0 0 24 24" className="h-[14px] w-[14px]" aria-hidden>
        <path {...common} d="M5 4h11l3 3v13H5z" />
        <path {...common} d="M8 4v5h8V4M9 20v-5h6v5" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="h-[14px] w-[14px]" aria-hidden>
      <path {...common} d="m8 8 8 8M16 8l-8 8" />
    </svg>
  );
}

function actionButtonClassName(iconOnly = false): string {
  return `inline-flex h-6 min-h-6 items-center justify-center gap-1 rounded border border-stone-200 text-[11px] leading-none text-stone-500 hover:bg-stone-100 hover:border-stone-300 active:bg-stone-200 ${
    iconOnly ? "w-6 px-0" : "px-1.5 whitespace-nowrap"
  }`;
}

function requirementProgress(detail: DetalleRequerimientoItem[]): number {
  const total = detail.length;
  if (total === 0) return 0;
  const attended = detail.filter((item) => item.estado.toLowerCase().includes("atendid")).length;
  return Math.round((attended / total) * 100);
}

function percentLabel(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

function isDeletableNewRequirementCode(value: string): boolean {
  return DELETABLE_NEW_RQ_CODE_PATTERN.test(value.trim().toUpperCase());
}

function normalizeBusinessFieldKey(value: string): string {
  return value.trim().toLowerCase();
}

function sanitizeNumber(value: string): number {
  const normalized = value.replace(/,/g, "").trim();
  if (!normalized) return 0;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function addMonthsToIsoDate(dateValue: string, monthsToAdd: number): string {
  const normalized = normalizeDateForStorage(dateValue);
  if (!normalized) return "";
  const [year, month, day] = normalized.split("-").map(Number);
  const shifted = new Date(year, month - 1 + monthsToAdd, day);
  return normalizeDateForStorage(
    `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, "0")}-${String(shifted.getDate()).padStart(2, "0")}`,
  );
}

function countInclusiveMonths(startDateValue: string, endDateValue: string): number {
  const start = normalizeDateForStorage(startDateValue);
  const end = normalizeDateForStorage(endDateValue);
  if (!start || !end) return 0;
  const [startYear, startMonth] = start.split("-").map(Number);
  const [endYear, endMonth] = end.split("-").map(Number);
  return Math.max(0, (endYear - startYear) * 12 + (endMonth - startMonth) + 1);
}

function filterCashflowData(
  data: QuotationCashflowData,
  options: { typeFilters: string[]; startMonthKey: string | null; endMonthKey: string | null },
): QuotationCashflowData {
  const { typeFilters, startMonthKey, endMonthKey } = options;
  const hasTypeFilter = typeFilters.length > 0;
  const startIndex = startMonthKey ? Math.max(0, data.months.findIndex((month) => month.key === startMonthKey)) : 0;
  const endIndex = endMonthKey
    ? Math.max(startIndex, data.months.findIndex((month) => month.key === endMonthKey))
    : data.months.length - 1;
  const safeEndIndex = endIndex < 0 ? data.months.length - 1 : endIndex;
  const months = data.months.slice(startIndex, safeEndIndex + 1);
  const rows = data.rows
    .filter((row) => !hasTypeFilter || typeFilters.includes(row.tipo_recurso))
    .map((row) => ({
      ...row,
      baseByMonth: row.baseByMonth.slice(startIndex, safeEndIndex + 1),
      ofertaByMonth: row.ofertaByMonth.slice(startIndex, safeEndIndex + 1),
      realByMonth: row.realByMonth.slice(startIndex, safeEndIndex + 1),
      totalBase: Number(row.baseByMonth.slice(startIndex, safeEndIndex + 1).reduce((acc, value) => acc + value, 0).toFixed(2)),
      totalOferta: Number(row.ofertaByMonth.slice(startIndex, safeEndIndex + 1).reduce((acc, value) => acc + value, 0).toFixed(2)),
      totalReal: Number(row.realByMonth.slice(startIndex, safeEndIndex + 1).reduce((acc, value) => acc + value, 0).toFixed(2)),
    }))
    .filter((row) => row.totalBase > 0 || row.totalOferta > 0 || row.totalReal > 0);

  return {
    months,
    projectStartKey: data.projectStartKey,
    projectEndKey: data.projectEndKey,
    visibleEndKey: months.at(-1)?.key ?? data.visibleEndKey,
    totalProjectMonths: data.totalProjectMonths,
    rows,
    totals: {
      baseByMonth: months.map((_, index) => Number(rows.reduce((acc, row) => acc + (row.baseByMonth[index] ?? 0), 0).toFixed(2))),
      ofertaByMonth: months.map((_, index) =>
        Number(rows.reduce((acc, row) => acc + (row.ofertaByMonth[index] ?? 0), 0).toFixed(2)),
      ),
      realByMonth: months.map((_, index) => Number(rows.reduce((acc, row) => acc + (row.realByMonth[index] ?? 0), 0).toFixed(2))),
      totalBase: Number(rows.reduce((acc, row) => acc + row.totalBase, 0).toFixed(2)),
      totalOferta: Number(rows.reduce((acc, row) => acc + row.totalOferta, 0).toFixed(2)),
      totalReal: Number(rows.reduce((acc, row) => acc + row.totalReal, 0).toFixed(2)),
    },
  };
}

export function QuotationWorkspaceModal({
  open,
  draft,
  requerimientos,
  detalleItems,
  recursos,
  clientOptions,
  unitOptions,
  serviceTypeOptions,
  solicitanteOptions,
  technicalResponsibleOptions,
  economicResponsibleOptions,
  proposalStatusOptions,
  statusOptions,
  priorityOptions,
  autoEditOnOpen = false,
  canEditQuotation = true,
  isSavingQuotation = false,
  onClose,
  onSave,
  onDraftChange,
  onEconomicRowChange,
  onOpenRequirement,
  onCreateRequirement,
  onDeleteRequirement,
  canDeleteAssociatedRequirements = false,
  requirementCreationError,
  hiddenBusinessFields = [],
  canViewPrices = true,
  viewGroupPermissions,
}: QuotationWorkspaceModalProps) {
  const [isQuotationEditing, setIsQuotationEditing] = useState(false);
  const [isEconomicEditing, setIsEconomicEditing] = useState(false);
  const [summaryViewMode, setSummaryViewMode] = useState<"economic" | "cashflow">("economic");
  const [cashflowViewMode, setCashflowViewMode] = useState<"summary" | "dashboard">("summary");
  const [cashflowTypeFilters, setCashflowTypeFilters] = useState<string[]>([]);
  const [cashflowFilterOpen, setCashflowFilterOpen] = useState(false);
  const [cashflowConfigOpen, setCashflowConfigOpen] = useState(false);
  const [cashflowStartMonthKey, setCashflowStartMonthKey] = useState<string | null>(null);
  const [cashflowEndMonthKey, setCashflowEndMonthKey] = useState<string | null>(null);
  const [cashflowConfigDraft, setCashflowConfigDraft] = useState<{ start: string; end: string; months: string }>({
    start: "",
    end: "",
    months: "",
  });
  const [selectedCashflowMonth, setSelectedCashflowMonth] = useState<string | null>(null);
  const [selectedCashflowDrill, setSelectedCashflowDrill] = useState<{ tipo_recurso: string; weekIndex: number | null } | null>(
    null,
  );
  const [economicTypeDrill, setEconomicTypeDrill] = useState<string | null>(null);
  const [economicRightPanelView, setEconomicRightPanelView] = useState<"requirements" | "resources">("requirements");
  const [economicEditDrafts, setEconomicEditDrafts] = useState<Record<string, { base?: string; oferta?: string }>>({});
  const [flatMensualDraft, setFlatMensualDraft] = useState<boolean>(false);
  const [montoDraft, setMontoDraft] = useState<string | null>(null);
  const [avanceDraft, setAvanceDraft] = useState<string | null>(null);
  const [technicalProposalOpen, setTechnicalProposalOpen] = useState(false);
  const leftWorkspaceRef = useRef<HTMLDivElement | null>(null);
  const rqBodyScrollRef = useRef<HTMLDivElement | null>(null);
  const cashflowFilterRef = useRef<HTMLDivElement | null>(null);
  const [leftWorkspaceHeight, setLeftWorkspaceHeight] = useState<number | null>(null);
  const [rqScrollbarWidth, setRqScrollbarWidth] = useState(0);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);
  const [economicColWidths, setEconomicColWidths] = useState<number[]>([...ECONOMIC_DEFAULT_COL_WIDTHS]);
  const [rqColWidths, setRqColWidths] = useState<number[]>([...RQ_DEFAULT_COL_WIDTHS]);
  const hiddenBusinessFieldSet = useMemo(
    () => new Set(hiddenBusinessFields.map((field) => normalizeBusinessFieldKey(field))),
    [hiddenBusinessFields],
  );

  const isBusinessFieldHidden = (fieldKey: string): boolean => hiddenBusinessFieldSet.has(normalizeBusinessFieldKey(fieldKey));
  const canViewQuotationGeneralData = viewGroupPermissions?.quotation_general_data !== false;
  const canViewQuotationEconomicSummary = viewGroupPermissions?.quotation_economic_summary !== false;
  const canViewQuotationRelatedRequirements = viewGroupPermissions?.quotation_related_requirements !== false;
  const canViewQuotationActions = viewGroupPermissions?.quotation_actions !== false;

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setIsQuotationEditing(autoEditOnOpen);
    setIsEconomicEditing(false);
    setEconomicEditDrafts({});
    setMontoDraft(null);
    setAvanceDraft(null);
    setPendingConfirm(null);
    setCashflowViewMode("summary");
    setCashflowTypeFilters([]);
    setCashflowFilterOpen(false);
    setCashflowConfigOpen(false);
    setCashflowStartMonthKey(null);
    setCashflowEndMonthKey(null);
    setCashflowConfigDraft({ start: "", end: "", months: "" });
    setSelectedCashflowMonth(null);
    setSelectedCashflowDrill(null);
    setEconomicTypeDrill(null);
    setEconomicRightPanelView("requirements");
    setFlatMensualDraft(Boolean(draft?.flat_mensual));
  }, [open, draft?.id, draft?.flat_mensual, autoEditOnOpen]);

  useEffect(() => {
    if (open) return;
    setPendingConfirm(null);
    setTechnicalProposalOpen(false);
  }, [open]);

  useEffect(() => {
    if (!open || isEconomicEditing) return;
    setFlatMensualDraft(Boolean(draft?.flat_mensual));
  }, [open, isEconomicEditing, draft?.flat_mensual]);

  useEffect(() => {
    if (!open) return;
    const element = leftWorkspaceRef.current;
    if (!element) return;

    const updateHeight = () => {
      const nextHeight = Math.round(element.getBoundingClientRect().height);
      setLeftWorkspaceHeight((prev) => (prev === nextHeight ? prev : nextHeight));
    };

    updateHeight();
    if (typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(() => updateHeight());
    observer.observe(element);
    return () => observer.disconnect();
  }, [open, draft?.id, isQuotationEditing, requirementCreationError]);

  useEffect(() => {
    if (!open) return;
    const element = rqBodyScrollRef.current;
    if (!element) return;

    const updateScrollbarWidth = () => {
      const next = Math.max(0, Math.round(element.offsetWidth - element.clientWidth));
      setRqScrollbarWidth((prev) => (prev === next ? prev : next));
    };

    updateScrollbarWidth();
    if (typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(() => updateScrollbarWidth());
    observer.observe(element);
    return () => observer.disconnect();
  }, [open, draft?.id, requerimientos.length, detalleItems.length]);

  const economics = useMemo(() => {
    if (!draft) return null;
    return computeQuotationEconomicRows({
      cotizacion: draft,
      requerimientos,
      detalleItems,
      recursos,
    });
  }, [draft, requerimientos, detalleItems, recursos]);

  const monthlyCashflow = useMemo(() => {
    if (!draft) return null;
    return computeQuotationCashflow({
      cotizacion: draft,
      requerimientos,
      detalleItems,
      recursos,
    });
  }, [draft, requerimientos, detalleItems, recursos]);

  const cashflowItems = useMemo(() => {
    if (!draft) return [];
    return collectQuotationCashflowItems({
      cotizacion: draft,
      requerimientos,
      detalleItems,
      recursos,
    });
  }, [draft, requerimientos, detalleItems, recursos]);

  const filteredMonthlyCashflow = useMemo(
    () =>
      monthlyCashflow
        ? filterCashflowData(monthlyCashflow, {
            typeFilters: cashflowTypeFilters,
            startMonthKey: cashflowStartMonthKey,
            endMonthKey: cashflowEndMonthKey,
          })
        : null,
    [monthlyCashflow, cashflowTypeFilters, cashflowStartMonthKey, cashflowEndMonthKey],
  );

  const monthlyCashflowWeekly = useMemo(() => {
    if (!draft || !selectedCashflowMonth) return null;
    return computeQuotationCashflowWeeklyDrilldown({
      cotizacion: draft,
      requerimientos,
      detalleItems,
      recursos,
      monthKey: selectedCashflowMonth,
    });
  }, [draft, requerimientos, detalleItems, recursos, selectedCashflowMonth]);

  const filteredCashflowItems = useMemo(() => {
    const hasTypeFilter = cashflowTypeFilters.length > 0;
    return cashflowItems.filter((item) => {
      if (hasTypeFilter && !cashflowTypeFilters.includes(item.tipo_recurso)) return false;
      if (cashflowStartMonthKey && item.monthKey < cashflowStartMonthKey) return false;
      if (cashflowEndMonthKey && item.monthKey > cashflowEndMonthKey) return false;
      return true;
    });
  }, [cashflowItems, cashflowTypeFilters, cashflowStartMonthKey, cashflowEndMonthKey]);

  const filteredCashflowRequirementCodes = useMemo(
    () => new Set(filteredCashflowItems.map((item) => item.rqCodigo).filter(Boolean)),
    [filteredCashflowItems],
  );

  const availableCashflowTypes = useMemo(
    () => monthlyCashflow?.rows.map((row) => row.tipo_recurso) ?? [],
    [monthlyCashflow],
  );

  const filteredMonthlyCashflowWeekly = useMemo(() => {
    if (!monthlyCashflowWeekly) return null;
    const hasTypeFilter = cashflowTypeFilters.length > 0;
    const rows = monthlyCashflowWeekly.rows.filter(
      (row) => !hasTypeFilter || cashflowTypeFilters.includes(row.tipo_recurso),
    );
    const items = monthlyCashflowWeekly.items.filter(
      (item) => !hasTypeFilter || cashflowTypeFilters.includes(item.tipo_recurso),
    );

    return {
      ...monthlyCashflowWeekly,
      rows,
      items,
      totals: {
        weekValues: Array.from({ length: 5 }, (_, weekIndex) =>
          Number(rows.reduce((acc, row) => acc + row.weekValues[weekIndex], 0).toFixed(2)),
        ),
        monthBase: Number(rows.reduce((acc, row) => acc + row.monthBase, 0).toFixed(2)),
        monthOferta: Number(rows.reduce((acc, row) => acc + row.monthOferta, 0).toFixed(2)),
        monthReal: Number(rows.reduce((acc, row) => acc + row.monthReal, 0).toFixed(2)),
        requirementCount: new Set(items.map((item) => item.rqCodigo).filter(Boolean)).size,
        itemCount: items.length,
      },
    };
  }, [monthlyCashflowWeekly, cashflowTypeFilters]);

  useEffect(() => {
    if (summaryViewMode === "economic") {
      setSelectedCashflowMonth(null);
      setSelectedCashflowDrill(null);
    }
  }, [summaryViewMode]);

  useEffect(() => {
    if (!draft?.flat_mensual && summaryViewMode === "cashflow") {
      setSummaryViewMode("economic");
      setCashflowViewMode("summary");
      setSelectedCashflowMonth(null);
      setSelectedCashflowDrill(null);
    }
  }, [draft?.flat_mensual, summaryViewMode]);

  useEffect(() => {
    if (!cashflowFilterOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (!cashflowFilterRef.current) return;
      if (!cashflowFilterRef.current.contains(event.target as Node)) {
        setCashflowFilterOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [cashflowFilterOpen]);

  useEffect(() => {
    if (!monthlyCashflow) return;
    if (cashflowStartMonthKey && !monthlyCashflow.months.some((month) => month.key === cashflowStartMonthKey)) {
      setCashflowStartMonthKey(null);
    }
    if (cashflowEndMonthKey && !monthlyCashflow.months.some((month) => month.key === cashflowEndMonthKey)) {
      setCashflowEndMonthKey(null);
    }
  }, [monthlyCashflow, cashflowStartMonthKey, cashflowEndMonthKey]);

  useEffect(() => {
    setCashflowTypeFilters((prev) => prev.filter((type) => availableCashflowTypes.includes(type)));
  }, [availableCashflowTypes]);

  useEffect(() => {
    if (!filteredMonthlyCashflow) return;
    if (selectedCashflowMonth && !filteredMonthlyCashflow.months.some((month) => month.key === selectedCashflowMonth)) {
      setSelectedCashflowMonth(null);
      setSelectedCashflowDrill(null);
    }
  }, [filteredMonthlyCashflow, selectedCashflowMonth]);

  useEffect(() => {
    if (cashflowTypeFilters.length === 0) return;
    if (selectedCashflowDrill && !cashflowTypeFilters.includes(selectedCashflowDrill.tipo_recurso)) {
      setSelectedCashflowDrill(null);
    }
  }, [cashflowTypeFilters, selectedCashflowDrill]);

  const relatedRequirements = useMemo(() => {
    if (!economics) return [];
    return economics.relatedRequirements.map((rq) => {
      const detail = detalleItems.filter((item) => item.requerimiento_id === rq.id);
      const totalRq = detail.reduce((acc, item) => acc + item.costo_total_presupuestado, 0);
      return {
        ...rq,
        totalRq,
        avance: requirementProgress(detail),
      };
    });
  }, [economics, detalleItems]);

  const filteredCashflowRequirements = useMemo(
    () => relatedRequirements.filter((rq) => filteredCashflowRequirementCodes.has(rq.codigo)),
    [relatedRequirements, filteredCashflowRequirementCodes],
  );

  const relatedRequirementIds = useMemo(() => new Set(relatedRequirements.map((rq) => rq.id)), [relatedRequirements]);
  const resourceById = useMemo(() => new Map(recursos.map((resource) => [resource.id, resource])), [recursos]);

  const economicTypeMatchedItems = useMemo(() => {
    if (!economicTypeDrill) return [];
    return detalleItems.filter((item) => {
      if (!relatedRequirementIds.has(item.requerimiento_id)) return false;
      return resourceById.get(item.recurso_id)?.tipo_recurso === economicTypeDrill;
    });
  }, [economicTypeDrill, detalleItems, relatedRequirementIds, resourceById]);

  const economicTypeRequirementIds = useMemo(
    () => new Set(economicTypeMatchedItems.map((item) => item.requerimiento_id)),
    [economicTypeMatchedItems],
  );

  const economicTypeRequirementRows = useMemo(() => {
    if (!economicTypeDrill) return [];
    return relatedRequirements
      .filter((rq) => economicTypeRequirementIds.has(rq.id))
      .map((rq) => {
        const rqItems = economicTypeMatchedItems.filter((item) => item.requerimiento_id === rq.id);
        const typeCost = rqItems.reduce((acc, item) => acc + item.costo_total_presupuestado, 0);
        return {
          ...rq,
          typeCost: Number(typeCost.toFixed(2)),
          itemCount: rqItems.length,
        };
      })
      .sort((a, b) => b.typeCost - a.typeCost);
  }, [economicTypeDrill, relatedRequirements, economicTypeRequirementIds, economicTypeMatchedItems]);

  const economicTypeResourceRows = useMemo(() => {
    if (!economicTypeDrill) return [];
    return detalleItems
      .filter((item) => economicTypeRequirementIds.has(item.requerimiento_id))
      .map((item) => {
        const recurso = resourceById.get(item.recurso_id);
        const requirement = relatedRequirements.find((rq) => rq.id === item.requerimiento_id);
        return {
          id: item.id,
          tipo_recurso: recurso?.tipo_recurso ?? "",
          descripcion: recurso?.descripcion || item.historical_item_source?.descripcion || "Sin descripción",
          codigo_rq: requirement?.codigo ?? "-",
          cantidad: item.cantidad,
          costo: item.costo_total_presupuestado,
          destacado: (recurso?.tipo_recurso ?? "") === economicTypeDrill,
        };
      })
      .sort((a, b) => b.costo - a.costo);
  }, [economicTypeDrill, detalleItems, economicTypeRequirementIds, resourceById, relatedRequirements]);

  if (!open || !draft || !economics || !monthlyCashflow || !filteredMonthlyCashflow) return null;

  const gastosGeneralesRow = economics.rows.find((row) => row.tipo_recurso === "Gastos generales");
  const utilidadesRow = economics.rows.find((row) => row.tipo_recurso === "Utilidades");
  const regularEconomicRows = economics.rows.filter(
    (row) => row.tipo_recurso !== "Gastos generales" && row.tipo_recurso !== "Utilidades",
  );

  const orderedRows = [
    ...regularEconomicRows,
    economics.subtotal,
    ...(gastosGeneralesRow ? [gastosGeneralesRow] : []),
    ...(utilidadesRow ? [utilidadesRow] : []),
    economics.total,
  ];
  const economicRowsWithoutTotal = orderedRows.filter((row) => row.tipo_recurso !== "Total");
  const economicTotalRow = economics.total;

  const clampedAvance = Math.max(0, Math.min(100, Number.isFinite(draft.avance) ? draft.avance : 0));
  const relatedRequirementsTotal = relatedRequirements.reduce((acc, item) => acc + item.totalRq, 0);
  const relatedRequirementsAverageAdvance =
    relatedRequirements.length > 0
      ? Math.round(relatedRequirements.reduce((acc, item) => acc + item.avance, 0) / relatedRequirements.length)
      : 0;
  const canShowEconomicValues =
    canViewQuotationEconomicSummary &&
    canViewPrices &&
    !isBusinessFieldHidden("monto") &&
    !isBusinessFieldHidden("moneda_cotizacion");
  const sectionDynamicStyle: CSSProperties | undefined = leftWorkspaceHeight
    ? ({ ["--quotation-left-height" as string]: `${leftWorkspaceHeight}px` } as CSSProperties)
    : undefined;

  function toggleQuotationEdition() {
    if (isSavingQuotation) return;
    if (!canEditQuotation) {
      setPendingConfirm({
        message: "No tienes permiso para editar esta cotización.",
        onAccept: () => undefined,
      });
      return;
    }
    if (!isQuotationEditing) {
      setPendingConfirm({
        message: "¿Deseas editar los datos de la cotización?",
        onAccept: () => setIsQuotationEditing(true),
      });
      return;
    }
    setPendingConfirm({
      message: "¿Deseas guardar los cambios de la cotización?",
      onAccept: async () => {
        const draftSnapshot = draft;
        const finalPatch: Partial<Cotizacion> = {};
        if (montoDraft !== null) {
          finalPatch.monto = sanitizeNumber(montoDraft);
          onDraftChange({ monto: finalPatch.monto });
          setMontoDraft(null);
        }
        if (avanceDraft !== null) {
          finalPatch.avance = Number(Math.max(0, Math.min(100, sanitizeNumber(avanceDraft))).toFixed(2));
          onDraftChange({ avance: finalPatch.avance });
          setAvanceDraft(null);
        }
        if (process.env.NODE_ENV === "development") {
          console.debug("[QuotationWorkspaceModal] Guardar cotización aceptado", {
            id: draftSnapshot?.id,
            codigo: draftSnapshot?.codigo,
            finalPatch,
          });
        }
        const saved = await onSave(finalPatch);
        if (saved === false) return;
        setIsQuotationEditing(false);
        setIsEconomicEditing(false);
        setEconomicEditDrafts({});
      },
    });
  }

  function commitAllEconomicDrafts() {
    const rows = Object.entries(economicEditDrafts);
    for (const [rowType, rowDraft] of rows) {
      if (rowDraft.base !== undefined) {
        onEconomicRowChange(rowType, { base: sanitizeNumber(rowDraft.base) });
      }
      if (rowDraft.oferta !== undefined) {
        onEconomicRowChange(rowType, { oferta: sanitizeNumber(rowDraft.oferta) });
      }
    }
    setEconomicEditDrafts({});
  }

  function toggleEconomicEdition() {
    if (!isEconomicEditing) {
      setPendingConfirm({
        message: "¿Deseas editar el resumen económico?",
        onAccept: () => {
          setFlatMensualDraft(Boolean(draft?.flat_mensual));
          setIsEconomicEditing(true);
        },
      });
      return;
    }
    setPendingConfirm({
      message: "¿Deseas guardar los cambios del resumen económico?",
      onAccept: () => {
        commitAllEconomicDrafts();
        onDraftChange({ flat_mensual: flatMensualDraft });
        setIsEconomicEditing(false);
      },
    });
  }

  function setEconomicDraftValue(rowType: string, field: "base" | "oferta", value: string) {
    setEconomicEditDrafts((prev) => ({
      ...prev,
      [rowType]: {
        ...prev[rowType],
        [field]: value,
      },
    }));
  }

  function clearEconomicDraftValue(rowType: string, field: "base" | "oferta") {
    setEconomicEditDrafts((prev) => {
      const rowDraft = prev[rowType];
      if (!rowDraft || rowDraft[field] === undefined) return prev;
      const nextRow = { ...rowDraft };
      delete nextRow[field];
      if (nextRow.base === undefined && nextRow.oferta === undefined) {
        const { [rowType]: removedRow, ...rest } = prev;
        void removedRow;
        return rest;
      }
      return { ...prev, [rowType]: nextRow };
    });
  }

  function commitEconomicDraftValue(rowType: string, field: "base" | "oferta") {
    const raw = economicEditDrafts[rowType]?.[field];
    if (raw === undefined) return;
    const parsed = sanitizeNumber(raw);
    onEconomicRowChange(rowType, field === "base" ? { base: parsed } : { oferta: parsed });
    clearEconomicDraftValue(rowType, field);
  }

  function handleCreateRequirement() {
    setPendingConfirm({
      message: "¿Deseas crear un nuevo requerimiento (RQ)?",
      onAccept: () => onCreateRequirement?.(),
    });
  }

  function handleDeleteRequirement(requirementId: string, codigo: string) {
    const isDeletableNewCode = isDeletableNewRequirementCode(codigo);
    if (process.env.NODE_ENV === "development") {
      console.debug("[QuotationWorkspaceModal] accion X RQ asociado", {
        requirementId,
        codigo,
        hasDeleteHandler: Boolean(onDeleteRequirement),
        canDeleteAssociatedRequirements,
        isDeletableNewCode,
      });
    }
    if (!canDeleteAssociatedRequirements) {
      setPendingConfirm({
        message: "No tienes permiso para eliminar RQ.",
        onAccept: () => undefined,
      });
      return;
    }
    if (!isDeletableNewCode) {
      setPendingConfirm({
        message: `RQ histórico conservado. No se elimina desde esta vista: ${codigo}.`,
        onAccept: () => undefined,
      });
      return;
    }
    if (!onDeleteRequirement) {
      setPendingConfirm({
        message: `No hay una acción segura configurada para eliminar el requerimiento ${codigo}.`,
        onAccept: () => undefined,
      });
      return;
    }
    setPendingConfirm({
      message: "¿Estás seguro de eliminar este RQ? Esta acción solo está permitida para RQ nuevos sin detalle asociado. No aplica para RQ históricos.",
      onAccept: () => onDeleteRequirement(requirementId),
      acceptLabel: "Eliminar RQ",
    });
  }

  function closePendingConfirm() {
    setPendingConfirm(null);
  }

  function acceptPendingConfirm() {
    if (!pendingConfirm) return;
    const nextAction = pendingConfirm.onAccept;
    setPendingConfirm(null);
    void Promise.resolve(nextAction());
  }

  function handleActivateCashflowMonth(monthKey: string) {
    setSelectedCashflowMonth(monthKey);
    setSelectedCashflowDrill(null);
  }

  function handleClearCashflowMonth() {
    setSelectedCashflowMonth(null);
    setSelectedCashflowDrill(null);
  }

  function handleSelectCashflowDrill(selection: { tipo_recurso: string; weekIndex: number | null }) {
    setSelectedCashflowDrill(selection);
  }

  function handleClearCashflowDrill() {
    setSelectedCashflowDrill(null);
  }

  function handleOpenEconomicTypeDrill(tipoRecurso: string) {
    setEconomicTypeDrill(tipoRecurso);
    setEconomicRightPanelView("requirements");
  }

  function handleClearEconomicTypeDrill() {
    setEconomicTypeDrill(null);
    setEconomicRightPanelView("requirements");
  }

  function openCashflowConfig() {
    if (!draft || !monthlyCashflow) return;
    setCashflowConfigDraft({
      start:
        normalizeDateForStorage(draft.fecha_inicio_analisis || "") ||
        `${monthlyCashflow.projectStartKey}-01`,
      end:
        normalizeDateForStorage(draft.fecha_fin_analisis || "") ||
        `${monthlyCashflow.projectEndKey}-01`,
      months:
        draft.meses_analisis && draft.meses_analisis > 0
          ? String(draft.meses_analisis)
          : String(monthlyCashflow.totalProjectMonths),
    });
    setCashflowConfigOpen(true);
  }

  function applyCashflowConfig() {
    if (!draft) return;
    const start = normalizeDateForStorage(cashflowConfigDraft.start);
    const end = normalizeDateForStorage(cashflowConfigDraft.end);
    const parsedMonths = Number.parseInt(cashflowConfigDraft.months, 10);
    const months = Number.isFinite(parsedMonths) && parsedMonths > 0 ? parsedMonths : null;
    const normalizedEnd = start && months ? addMonthsToIsoDate(start, months - 1) : end;
    const safeEnd = start && normalizedEnd && normalizedEnd < start ? start : normalizedEnd;
    const safeMonths = start && safeEnd ? countInclusiveMonths(start, safeEnd) : months;

    onDraftChange({
      fecha_inicio_analisis: start,
      fecha_fin_analisis: safeEnd,
      meses_analisis: safeMonths || null,
    });
    setCashflowStartMonthKey(null);
    setCashflowEndMonthKey(null);
    setCashflowConfigOpen(false);
  }

  function toggleCashflowType(type: string) {
    setCashflowTypeFilters((prev) =>
      prev.includes(type) ? prev.filter((item) => item !== type) : [...prev, type],
    );
  }

  function clearCashflowTypeFilters() {
    setCashflowTypeFilters([]);
  }

  function selectAllCashflowTypes() {
    setCashflowTypeFilters(availableCashflowTypes);
  }

  const cashflowFilterLabel =
    cashflowTypeFilters.length === 0
      ? "Todos los tipos de recurso"
      : cashflowTypeFilters.length === 1
        ? cashflowTypeFilters[0]
        : `${cashflowTypeFilters.length} tipos seleccionados`;

  function startColumnResize(
    group: "economic" | "rq",
    columnIndex: number,
    event: ReactMouseEvent<HTMLButtonElement>,
  ) {
    event.preventDefault();
    event.stopPropagation();

    const widths = group === "economic" ? economicColWidths : rqColWidths;
    const minWidths = group === "economic" ? ECONOMIC_MIN_COL_WIDTHS : RQ_MIN_COL_WIDTHS;
    const setWidths = group === "economic" ? setEconomicColWidths : setRqColWidths;
    const nextIndex = columnIndex + 1;
    if (nextIndex >= widths.length) return;

    const startX = event.clientX;
    const startCurrent = widths[columnIndex];
    const startNext = widths[nextIndex];

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      let current = startCurrent + deltaX;
      let next = startNext - deltaX;

      if (current < minWidths[columnIndex]) {
        const diff = minWidths[columnIndex] - current;
        current = minWidths[columnIndex];
        next -= diff;
      }

      if (next < minWidths[nextIndex]) {
        const diff = minWidths[nextIndex] - next;
        next = minWidths[nextIndex];
        current -= diff;
      }

      const updated = [...widths];
      updated[columnIndex] = Math.round(current);
      updated[nextIndex] = Math.round(next);
      setWidths(updated);
    };

    const onMouseUp = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-1.5">
      <div className="relative flex h-auto max-h-[calc(100dvh-12px)] w-[97vw] max-w-[1860px] flex-col overflow-hidden rounded-xl border border-border bg-panel shadow-lg">
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden p-2.5 xl:overflow-hidden">
          <section
            className="mb-2 flex flex-col gap-2 xl:min-h-0 xl:flex-1 xl:flex-row xl:items-stretch"
            style={sectionDynamicStyle}
          >
            <div
              ref={leftWorkspaceRef}
              className="flex flex-col gap-1 xl:min-h-0 xl:flex-1 xl:overflow-hidden xl:basis-[calc(100%-520px)] xl:max-w-[calc(100%-520px)]"
            >
              <div className="flex min-h-6 items-center justify-between gap-2">
                <FieldLabelIcon icon="file-text" label="Datos de la cotización" className="text-[11px] font-medium" />
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setTechnicalProposalOpen(true)}
                    className={actionButtonClassName()}
                    title="Abrir Propuesta Técnica REV00"
                  >
                    <FieldLabelIcon icon="file-text" label="PT REV00" className="text-[11px] font-medium" />
                  </button>
                  {canViewQuotationActions && canViewQuotationGeneralData ? (
                  <FieldLockButton
                    locked={!isQuotationEditing}
                    label={isSavingQuotation ? "Guardando..." : isQuotationEditing ? "Guardar cotización" : "Editar cotización"}
                    onToggle={toggleQuotationEdition}
                    lockedTitle="Editar cotización"
                    unlockedTitle="Guardar cotización"
                  />
                  ) : null}
                  <button onClick={onClose} className={actionButtonClassName(true)} title="Cerrar" aria-label="Cerrar">
                    <ModalActionIcon name="close" />
                  </button>
                </div>
              </div>
              {canViewQuotationGeneralData ? (
              <div className="rounded border border-border bg-white px-2 pt-2 pb-2">
                <div className="grid grid-cols-1 gap-x-3 border-t border-stone-200 md:grid-cols-2 xl:grid-cols-4">
                  <LabelValueRow
                    icon="file-text"
                    label="Cotización"
                    valueAlign="left"
                    value={
                      <input
                        value={draft.codigo}
                        onChange={(event) => onDraftChange({ codigo: event.target.value })}
                        disabled={!isQuotationEditing}
                        className={`${editableInputClassName("xl", isQuotationEditing)} text-left`}
                      />
                    }
                  />
                  <LabelValueRow
                    icon="align-left"
                    label="Proyecto"
                    className="xl:col-span-2"
                    valueAlign="left"
                    hidden={isBusinessFieldHidden("proyecto")}
                    value={
                      <input
                        value={draft.proyecto}
                        onChange={(event) => onDraftChange({ proyecto: event.target.value })}
                        disabled={!isQuotationEditing}
                        className={`${editableInputClassName("xl", isQuotationEditing)} text-left`}
                      />
                    }
                  />
                  <LabelValueRow
                    icon="clipboard-check"
                    label="Estado propuesta"
                    value={
                      isQuotationEditing ? (
                        <select
                          value={draft.estado_propuesta}
                          onChange={(event) => onDraftChange({ estado_propuesta: event.target.value })}
                          className={editableInputClassName("md", true)}
                        >
                          <option value=""></option>
                          {proposalStatusOptions.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className={readOnlyValueClassName("md")}>{draft.estado_propuesta}</span>
                      )
                    }
                  />
                  <LabelValueRow
                    icon="building"
                    label="Cliente"
                    hidden={isBusinessFieldHidden("cliente")}
                    value={
                      isQuotationEditing ? (
                        <select
                          value={draft.cliente}
                          onChange={(event) => onDraftChange({ cliente: event.target.value })}
                          className={editableInputClassName("lg", true)}
                        >
                          <option value=""></option>
                          {clientOptions.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className={readOnlyValueClassName("lg")}>{draft.cliente}</span>
                      )
                    }
                  />
                  <LabelValueRow
                    icon="map-pin"
                    label="Unidad de trabajo"
                    hidden={isBusinessFieldHidden("unidad_trabajo")}
                    value={
                      isQuotationEditing ? (
                        <select
                          value={draft.unidad_trabajo}
                          onChange={(event) => onDraftChange({ unidad_trabajo: event.target.value })}
                          className={editableInputClassName("lg", true)}
                        >
                          <option value=""></option>
                          {unitOptions.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className={readOnlyValueClassName("lg")}>{draft.unidad_trabajo}</span>
                      )
                    }
                  />
                  <LabelValueRow
                    icon="user"
                    label="Solicitante"
                    value={
                      isQuotationEditing ? (
                        <select
                          value={draft.solicitante}
                          onChange={(event) => onDraftChange({ solicitante: event.target.value })}
                          className={editableInputClassName("md", true)}
                        >
                          <option value=""></option>
                          {solicitanteOptions.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className={readOnlyValueClassName("md")}>{draft.solicitante}</span>
                      )
                    }
                  />
                  <LabelValueRow
                    icon="shield-check"
                    label="Prioridad"
                    value={
                      isQuotationEditing ? (
                        <select
                          value={draft.prioridad}
                          onChange={(event) => onDraftChange({ prioridad: event.target.value as Cotizacion["prioridad"] })}
                          className={editableInputClassName("sm", true)}
                        >
                          <option value=""></option>
                          {priorityOptions.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className={readOnlyValueClassName("sm")}>{draft.prioridad}</span>
                      )
                    }
                  />
                  <LabelValueRow
                    icon="tags"
                    label="Tipo de servicio"
                    value={
                      isQuotationEditing ? (
                        <select
                          value={draft.tipo_servicio}
                          onChange={(event) => onDraftChange({ tipo_servicio: event.target.value })}
                          className={editableInputClassName("md", true)}
                        >
                          <option value=""></option>
                          {serviceTypeOptions.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className={readOnlyValueClassName("md")}>{draft.tipo_servicio}</span>
                      )
                    }
                  />
                  <LabelValueRow
                    icon="user"
                    label="Responsable técnico"
                    value={
                      isQuotationEditing ? (
                        <select
                          value={draft.responsable_tecnico}
                          onChange={(event) => onDraftChange({ responsable_tecnico: event.target.value })}
                          className={editableInputClassName("md", true)}
                        >
                          <option value=""></option>
                          {technicalResponsibleOptions.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className={readOnlyValueClassName("md")}>{draft.responsable_tecnico}</span>
                      )
                    }
                  />
                  <LabelValueRow
                    icon="users"
                    label="Responsable económico"
                    value={
                      isQuotationEditing ? (
                        <select
                          value={draft.responsable_economico}
                          onChange={(event) => onDraftChange({ responsable_economico: event.target.value })}
                          className={editableInputClassName("md", true)}
                        >
                          <option value=""></option>
                          {economicResponsibleOptions.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className={readOnlyValueClassName("md")}>{draft.responsable_economico}</span>
                      )
                    }
                  />
                  <LabelValueRow
                    icon="percent"
                    label="Avance"
                    valueAlign="right"
                    value={
                      <div className="ml-auto flex w-[110px] min-w-[110px] max-w-[110px] justify-end">
                        <input
                          type="text"
                          inputMode="decimal"
                          min={0}
                          max={100}
                          step={0.01}
                          value={`${isQuotationEditing ? avanceDraft ?? clampedAvance.toFixed(2) : clampedAvance.toFixed(2)}%`}
                          onFocus={(event) => {
                            if (!isQuotationEditing) return;
                            setAvanceDraft(clampedAvance.toFixed(2));
                            event.currentTarget.select();
                          }}
                          onChange={(event) => {
                            if (!isQuotationEditing) return;
                            const raw = event.target.value.replace(",", ".").replace(/[^0-9.]/g, "");
                            const parts = raw.split(".");
                            const normalized = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join("")}` : raw;
                            setAvanceDraft(normalized);
                          }}
                          onBlur={() => {
                            if (!isQuotationEditing) return;
                            if (avanceDraft === null) return;
                            const next = Number(Math.max(0, Math.min(100, sanitizeNumber(avanceDraft))).toFixed(2));
                            onDraftChange({ avance: next });
                            setAvanceDraft(null);
                          }}
                          onKeyDown={(event) => {
                            if (!isQuotationEditing) return;
                            if (event.key === "Enter") {
                              const next = Number(
                                Math.max(0, Math.min(100, sanitizeNumber(avanceDraft ?? String(clampedAvance)))).toFixed(2),
                              );
                              onDraftChange({ avance: next });
                              setAvanceDraft(null);
                              event.currentTarget.blur();
                            }
                            if (event.key === "Escape") {
                              setAvanceDraft(null);
                              event.currentTarget.blur();
                            }
                          }}
                          disabled={!isQuotationEditing}
                          className={`h-6 w-full rounded px-1 text-right text-[11px] font-medium tabular-nums outline-none ${
                            isQuotationEditing
                              ? "border border-stone-300 bg-white text-stone-800"
                              : "border border-transparent bg-transparent text-stone-700"
                          }`}
                        />
                      </div>
                    }
                  />
                  <LabelValueRow
                    icon="calendar"
                    label="Fecha registro"
                    value={
                      <DateTextInput
                        value={draft.fecha_registro}
                        onChange={(value) => onDraftChange({ fecha_registro: value })}
                        disabled={!isQuotationEditing}
                        className={editableInputClassName("md", isQuotationEditing)}
                      />
                    }
                  />
                  <LabelValueRow
                    icon="calendar"
                    label="Fecha invitación"
                    value={
                      <DateTextInput
                        value={draft.fecha_invitacion}
                        onChange={(value) => onDraftChange({ fecha_invitacion: value })}
                        disabled={!isQuotationEditing}
                        className={editableInputClassName("md", isQuotationEditing)}
                      />
                    }
                  />
                  <LabelValueRow
                    icon="clock"
                    label="Fecha visita téc."
                    value={
                      <DateTextInput
                        value={draft.fecha_visita_tecnica}
                        onChange={(value) => onDraftChange({ fecha_visita_tecnica: value })}
                        disabled={!isQuotationEditing}
                        className={editableInputClassName("md", isQuotationEditing)}
                      />
                    }
                  />
                  <LabelValueRow
                    icon="file-search"
                    label="Fecha consultas"
                    value={
                      <DateTextInput
                        value={draft.fecha_consultas}
                        onChange={(value) => onDraftChange({ fecha_consultas: value })}
                        disabled={!isQuotationEditing}
                        className={editableInputClassName("md", isQuotationEditing)}
                      />
                    }
                  />
                  <LabelValueRow
                    icon="clipboard-check"
                    label="Fecha abs. consultas"
                    value={
                      <DateTextInput
                        value={draft.fecha_abs_consultas}
                        onChange={(value) => onDraftChange({ fecha_abs_consultas: value })}
                        disabled={!isQuotationEditing}
                        className={editableInputClassName("md", isQuotationEditing)}
                      />
                    }
                  />
                  <LabelValueRow
                    icon="calendar-days"
                    label="Fecha entrega"
                    value={
                      <DateTextInput
                        value={draft.fecha_entrega}
                        onChange={(value) => onDraftChange({ fecha_entrega: value })}
                        disabled={!isQuotationEditing}
                        className={editableInputClassName("md", isQuotationEditing)}
                      />
                    }
                  />
                  <LabelValueRow
                    icon="calendar-check"
                    label="Fecha entregada"
                    value={
                      <DateTextInput
                        value={draft.fecha_entregada}
                        onChange={(value) => onDraftChange({ fecha_entregada: value })}
                        disabled={!isQuotationEditing}
                        className={editableInputClassName("md", isQuotationEditing)}
                      />
                    }
                  />
                  <LabelValueRow
                    icon="calendar-check"
                    label="Fecha OC"
                    value={
                      <DateTextInput
                        value={draft.fecha_oc}
                        onChange={(value) => onDraftChange({ fecha_oc: value })}
                        disabled={!isQuotationEditing}
                        className={editableInputClassName("md", isQuotationEditing)}
                      />
                    }
                  />
                  <LabelValueRow
                    icon="coins"
                    label="Moneda cotización"
                    hidden={isBusinessFieldHidden("moneda_cotizacion")}
                    value={
                      isQuotationEditing ? (
                        <select
                          value={draft.moneda_cotizacion}
                          onChange={(event) =>
                            onDraftChange({ moneda_cotizacion: event.target.value as Cotizacion["moneda_cotizacion"] })
                          }
                          className={editableInputClassName("sm", true)}
                        >
                          <option value=""></option>
                          <option value="PEN">PEN</option>
                          <option value="USD">USD</option>
                        </select>
                      ) : (
                        <span className={readOnlyValueClassName("sm")}>{draft.moneda_cotizacion}</span>
                      )
                    }
                  />
                  <LabelValueRow
                    icon="calculator"
                    label="Monto ofertado"
                    hidden={isBusinessFieldHidden("monto") || !canViewPrices}
                    value={
                      <input
                        type="text"
                        inputMode="decimal"
                        value={montoDraft ?? formatCurrencyNumber(draft.monto)}
                        disabled={!isQuotationEditing}
                        onFocus={(event) => {
                          if (!isQuotationEditing) return;
                          setMontoDraft(String(draft.monto.toFixed(2)));
                          event.currentTarget.select();
                        }}
                        onChange={(event) => {
                          if (!isQuotationEditing) return;
                          setMontoDraft(event.target.value);
                        }}
                        onBlur={() => {
                          if (!isQuotationEditing) return;
                          if (montoDraft === null) return;
                          onDraftChange({ monto: sanitizeNumber(montoDraft) });
                          setMontoDraft(null);
                        }}
                        onKeyDown={(event) => {
                          if (!isQuotationEditing) return;
                          if (event.key === "Enter") {
                            if (montoDraft !== null) {
                              onDraftChange({ monto: sanitizeNumber(montoDraft) });
                              setMontoDraft(null);
                            }
                            (event.currentTarget as HTMLInputElement).blur();
                          }
                          if (event.key === "Escape") {
                            setMontoDraft(null);
                            (event.currentTarget as HTMLInputElement).blur();
                          }
                        }}
                        className={`${editableInputClassName("md", isQuotationEditing)} text-right tabular-nums`}
                      />
                    }
                  />
                  <LabelValueRow
                    icon="circle-dot"
                    label="Estado de oferta"
                    value={
                      isQuotationEditing ? (
                        <select
                          value={draft.estado}
                          onChange={(event) => onDraftChange({ estado: event.target.value as Cotizacion["estado"] })}
                          className={editableInputClassName("md", true)}
                        >
                          <option value=""></option>
                          {statusOptions.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className={readOnlyValueClassName("md")}>{draft.estado}</span>
                      )
                    }
                  />
                  <LabelValueRow
                    icon="file-text"
                    label="OC"
                    hidden={isBusinessFieldHidden("oc")}
                    value={
                      <input
                        value={draft.oc}
                        onChange={(event) => onDraftChange({ oc: event.target.value })}
                        disabled={!isQuotationEditing}
                        className={editableInputClassName("md", isQuotationEditing)}
                      />
                    }
                  />
                </div>
              </div>
              ) : (
                <div className="rounded border border-border bg-white px-3 py-8 text-center text-[11px] text-stone-500">
                  Datos de la cotización ocultos por permisos.
                </div>
              )}

              {canViewQuotationEconomicSummary ? (
              <div className="flex min-h-0 flex-col overflow-hidden">
                <div className="mb-1 flex min-h-6 shrink-0 items-center justify-between gap-2 px-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <FieldLabelIcon icon="pie-chart" label="Resumen económico" className="text-[11px] font-medium" />
                    <div className="inline-flex rounded-md border border-stone-200 bg-white p-[2px]">
                      <button
                        type="button"
                        onClick={() => setSummaryViewMode("economic")}
                        className={`rounded px-2 py-0.5 text-[10px] font-medium ${
                          summaryViewMode === "economic" ? "bg-stone-100 text-stone-700" : "text-stone-500"
                        }`}
                      >
                        Resumen
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (!draft.flat_mensual) return;
                          setSummaryViewMode("cashflow");
                        }}
                        disabled={!draft.flat_mensual}
                        className={`rounded px-2 py-0.5 text-[10px] font-medium ${
                          !draft.flat_mensual
                            ? "cursor-not-allowed text-stone-300"
                            : summaryViewMode === "cashflow"
                              ? "bg-stone-100 text-stone-700"
                              : "text-stone-500"
                        }`}
                        title={draft.flat_mensual ? "Ver flujo mensual" : "Disponible solo para proyectos con flat mensual"}
                      >
                        Flujo mensual
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <label
                      className={`inline-flex h-6 items-center gap-1 rounded border px-2 text-[10px] ${
                        isEconomicEditing
                          ? "border-stone-200 bg-white text-stone-600"
                          : "border-stone-100 bg-stone-50 text-stone-400"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={flatMensualDraft}
                        onChange={(event) => setFlatMensualDraft(event.target.checked)}
                        disabled={!isEconomicEditing}
                        className="h-3.5 w-3.5 rounded border-stone-300 text-stone-700"
                      />
                      <span className="whitespace-nowrap">Flat mensual</span>
                    </label>
                    {summaryViewMode === "economic" && canViewQuotationActions ? (
                      <FieldLockButton
                        locked={!isEconomicEditing}
                        label={isEconomicEditing ? "Guardar resumen" : "Editar resumen"}
                        onToggle={toggleEconomicEdition}
                        lockedTitle="Editar resumen"
                        unlockedTitle="Guardar resumen"
                      />
                    ) : (
                      <div />
                    )}
                  </div>
                </div>
                <div className="min-h-0 rounded border border-border bg-white px-2 pt-2 pb-0">
                  {summaryViewMode === "economic" ? (
                  canShowEconomicValues ? (
                  <div className="app-table-scroll min-h-0 overflow-auto border-t border-stone-200">
                    <table className="economic-summary-table w-full table-fixed border-collapse text-[11px] [&_td]:border-r [&_td]:border-stone-200/60 [&_td:last-child]:border-r-0 [&_th]:border-r [&_th]:border-stone-200/70 [&_th:last-child]:border-r-0">
                    <colgroup>
                      {economicColWidths.map((width, index) => (
                        <col key={`economic-col-${index}`} style={{ width: `${width}px` }} />
                      ))}
                    </colgroup>
                    <thead className="sticky top-0 z-10 bg-stone-50 text-muted">
                      <tr>
                        {[
                          { label: "Tipo recurso", align: "text-left" },
                          { label: "Base", align: "text-right" },
                          { label: "Oferta", align: "text-right" },
                          { label: "Real", align: "text-right" },
                          { label: "Marg. ofertado", align: "text-right" },
                          { label: "% marg. ofertado", align: "text-right" },
                          { label: "Marg. real", align: "text-right" },
                          { label: "% marg. real", align: "text-right" },
                        ].map((header, index) => (
                          <th
                            key={header.label}
                            className={`relative h-[26px] border-b border-border px-2 py-0 ${header.align} font-semibold`}
                          >
                            {header.label}
                            {index < economicColWidths.length - 1 ? (
                              <button
                                type="button"
                                onMouseDown={(event) => startColumnResize("economic", index, event)}
                                className="absolute right-[-2px] top-0 h-full w-1 cursor-col-resize bg-transparent hover:bg-stone-300/60"
                                aria-label={`Ajustar ancho de ${header.label}`}
                                title={`Ajustar ancho de ${header.label}`}
                              />
                            ) : null}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {economicRowsWithoutTotal.map((row) => {
                        const canEditSummaryValue = isEconomicEditing;
                        const baseDraftValue =
                          economicEditDrafts[row.tipo_recurso]?.base ??
                          formatEditableMoneyInput(formatSummaryEditableNumber(row.base));
                        const ofertaDraftValue =
                          economicEditDrafts[row.tipo_recurso]?.oferta ??
                          formatEditableMoneyInput(formatSummaryEditableNumber(row.oferta));
                        const canOpenEconomicDrill =
                          row.real > 0 && row.tipo_recurso !== "Sub total" && row.tipo_recurso !== "Total";

                        return (
                          <tr
                            key={row.tipo_recurso}
                            className={`h-[26px] border-t align-middle ${
                              row.tipo_recurso === "Sub total" ||
                              row.tipo_recurso === "Gastos generales" ||
                              row.tipo_recurso === "Utilidades"
                                ? "border-stone-300 bg-stone-50 font-semibold"
                                : "border-border"
                            }`}
                          >
                          <td className="h-[26px] max-w-[190px] px-2 py-0 align-middle">
                            <div className="flex min-w-0 items-center gap-1">
                              <FieldLabelIcon
                                icon={summaryIconForType(row.tipo_recurso)}
                                label=""
                                className="shrink-0 [&>span:last-child]:hidden"
                              />
                              <span className="block truncate" title={row.tipo_recurso}>
                                {row.tipo_recurso}
                              </span>
                            </div>
                          </td>
                          <td className="h-[26px] pl-2 pr-0 py-0 text-right align-middle">
                            {canEditSummaryValue ? (
                              <span className={economicMoneyCellShellClassName(true)}>
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={baseDraftValue}
                                  onChange={(event) => {
                                    const inputElement = event.currentTarget;
                                    const rawValue = inputElement.value;
                                    const caret = inputElement.selectionStart ?? rawValue.length;
                                    const beforeCaretRaw = rawValue.slice(0, Math.max(0, caret));
                                    const beforeCaretFormatted = formatEditableMoneyInput(beforeCaretRaw);
                                    const next = formatEditableMoneyInput(rawValue);
                                    setEconomicDraftValue(row.tipo_recurso, "base", next);
                                    requestAnimationFrame(() => {
                                      if (document.activeElement !== inputElement) return;
                                      const nextCaret = beforeCaretFormatted.length;
                                      inputElement.setSelectionRange(nextCaret, nextCaret);
                                    });
                                  }}
                                  onBlur={() => commitEconomicDraftValue(row.tipo_recurso, "base")}
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                      commitEconomicDraftValue(row.tipo_recurso, "base");
                                      event.currentTarget.blur();
                                    }
                                    if (event.key === "Escape") {
                                      clearEconomicDraftValue(row.tipo_recurso, "base");
                                      event.currentTarget.blur();
                                    }
                                  }}
                                  className={economicInputClassName()}
                                />
                              </span>
                            ) : (
                              <span className={economicMoneyCellShellClassName(false)}>
                                <span className={economicReadValueClassName()}>
                                  {formatSummaryNumber(row.base)}
                                </span>
                              </span>
                            )}
                          </td>
                          <td className="h-[26px] pl-2 pr-0 py-0 text-right align-middle">
                            {canEditSummaryValue ? (
                              <span className={economicMoneyCellShellClassName(true)}>
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={ofertaDraftValue}
                                  onChange={(event) => {
                                    const inputElement = event.currentTarget;
                                    const rawValue = inputElement.value;
                                    const caret = inputElement.selectionStart ?? rawValue.length;
                                    const beforeCaretRaw = rawValue.slice(0, Math.max(0, caret));
                                    const beforeCaretFormatted = formatEditableMoneyInput(beforeCaretRaw);
                                    const next = formatEditableMoneyInput(rawValue);
                                    setEconomicDraftValue(row.tipo_recurso, "oferta", next);
                                    requestAnimationFrame(() => {
                                      if (document.activeElement !== inputElement) return;
                                      const nextCaret = beforeCaretFormatted.length;
                                      inputElement.setSelectionRange(nextCaret, nextCaret);
                                    });
                                  }}
                                  onBlur={() => commitEconomicDraftValue(row.tipo_recurso, "oferta")}
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                      commitEconomicDraftValue(row.tipo_recurso, "oferta");
                                      event.currentTarget.blur();
                                    }
                                    if (event.key === "Escape") {
                                      clearEconomicDraftValue(row.tipo_recurso, "oferta");
                                      event.currentTarget.blur();
                                    }
                                  }}
                                  className={economicInputClassName()}
                                />
                              </span>
                            ) : (
                              <span className={economicMoneyCellShellClassName(false)}>
                                <span className={economicReadValueClassName()}>
                                  {formatSummaryNumber(row.oferta)}
                                </span>
                              </span>
                            )}
                          </td>
                          <td className="h-[26px] px-2 py-0 text-right align-middle">
                            {canOpenEconomicDrill ? (
                              <button
                                type="button"
                                onDoubleClick={() => handleOpenEconomicTypeDrill(row.tipo_recurso)}
                                className="w-full rounded px-1 text-right hover:bg-stone-100"
                                title={`Doble clic para analizar ${row.tipo_recurso}`}
                              >
                                {formatSummaryNumber(row.real)}
                              </button>
                            ) : (
                              formatSummaryNumber(row.real)
                            )}
                          </td>
                          <td className="h-[26px] px-2 py-0 text-right align-middle">
                            {formatSummaryNumber(row.margen_ofertado)}
                          </td>
                          <td className="h-[26px] px-2 py-0 text-right align-middle">
                            {percentLabel(row.porcentaje_margen_ofertado)}
                          </td>
                          <td
                            className={`h-[26px] px-2 py-0 text-right align-middle ${
                              row.margen_real < 0 ? "font-semibold text-rose-700" : ""
                            }`}
                          >
                            {formatSummaryNumber(row.margen_real)}
                          </td>
                          <td className={`h-[26px] px-2 py-0 text-right align-middle ${row.margen_real < 0 ? "text-rose-700" : ""}`}>
                            {percentLabel(row.porcentaje_margen_real)}
                          </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="border-t border-stone-300 bg-stone-50">
                      <tr
                        key={economicTotalRow.tipo_recurso}
                        className="h-[26px] border-t border-stone-300 bg-stone-50 font-semibold align-middle"
                      >
                        <td className="h-[26px] max-w-[190px] px-2 py-0 align-middle">
                          <span className="block truncate" title={economicTotalRow.tipo_recurso}>
                            {economicTotalRow.tipo_recurso}
                          </span>
                        </td>
                        <td className="h-[26px] pl-2 pr-0 py-0 text-right align-middle">
                          <span className={economicMoneyCellShellClassName(false)}>
                            {formatSummaryNumber(economicTotalRow.base)}
                          </span>
                        </td>
                        <td className="h-[26px] pl-2 pr-0 py-0 text-right align-middle">
                          <span className={economicMoneyCellShellClassName(false)}>
                            {formatSummaryNumber(economicTotalRow.oferta)}
                          </span>
                        </td>
                        <td className="h-[26px] px-2 py-0 text-right align-middle">
                          {formatSummaryNumber(economicTotalRow.real)}
                        </td>
                        <td className="h-[26px] px-2 py-0 text-right align-middle">
                          {formatSummaryNumber(economicTotalRow.margen_ofertado)}
                        </td>
                        <td className="h-[26px] px-2 py-0 text-right align-middle">
                          {percentLabel(economicTotalRow.porcentaje_margen_ofertado)}
                        </td>
                        <td
                          className={`h-[26px] px-2 py-0 text-right align-middle ${
                            economicTotalRow.margen_real < 0 ? "font-semibold text-rose-700" : ""
                          }`}
                        >
                          {formatSummaryNumber(economicTotalRow.margen_real)}
                        </td>
                        <td className={`h-[26px] px-2 py-0 text-right align-middle ${economicTotalRow.margen_real < 0 ? "text-rose-700" : ""}`}>
                          {percentLabel(economicTotalRow.porcentaje_margen_real)}
                        </td>
                      </tr>
                    </tfoot>
                    </table>
                  </div>
                  ) : (
                    <div className="flex min-h-0 h-full items-center justify-center border-t border-stone-200 px-3 py-6 text-[11px] text-stone-500">
                      Información económica oculta por permisos.
                    </div>
                  )
                  ) : (
                    <div className="flex min-h-0 flex-col border-t border-stone-200 pt-2">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <div ref={cashflowFilterRef} className="relative">
                          <button
                            type="button"
                            onClick={() => setCashflowFilterOpen((prev) => !prev)}
                            className="inline-flex h-7 min-w-[230px] items-center justify-between gap-2 rounded border border-stone-200 bg-white px-2 text-[11px] text-stone-700 hover:bg-stone-50"
                          >
                            <span className="truncate">{cashflowFilterLabel}</span>
                            <span className="text-[10px] text-stone-400">{cashflowFilterOpen ? "▴" : "▾"}</span>
                          </button>
                          {cashflowFilterOpen ? (
                            <div className="absolute left-0 top-[calc(100%+4px)] z-[70] w-[260px] rounded-md border border-stone-200 bg-white p-2 shadow-lg">
                              <div className="mb-2 flex items-center justify-between gap-2">
                                <button
                                  type="button"
                                  onClick={clearCashflowTypeFilters}
                                  className="rounded border border-stone-200 px-2 py-1 text-[10px] text-stone-500 hover:bg-stone-100"
                                >
                                  Todo
                                </button>
                                <button
                                  type="button"
                                  onClick={selectAllCashflowTypes}
                                  className="rounded border border-stone-200 px-2 py-1 text-[10px] text-stone-500 hover:bg-stone-100"
                                >
                                  Marcar todo
                                </button>
                              </div>
                              <div className="max-h-[220px] space-y-1 overflow-auto pr-1">
                                {availableCashflowTypes.map((type) => {
                                  const checked = cashflowTypeFilters.includes(type);
                                  return (
                                    <label
                                      key={type}
                                      className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-[11px] text-stone-700 hover:bg-stone-50"
                                    >
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={() => toggleCashflowType(type)}
                                        className="h-3.5 w-3.5 rounded border-stone-300 text-stone-700"
                                      />
                                      <span className="truncate">{type}</span>
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          ) : null}
                        </div>
                        <div className="inline-flex rounded-md border border-stone-200 bg-white p-[2px]">
                          <button
                            type="button"
                            onClick={() => setCashflowViewMode("summary")}
                            className={`rounded px-2 py-0.5 text-[10px] font-medium ${
                              cashflowViewMode === "summary" ? "bg-stone-100 text-stone-700" : "text-stone-500"
                            }`}
                          >
                            Resumen
                          </button>
                          <button
                            type="button"
                            onClick={() => setCashflowViewMode("dashboard")}
                            className={`rounded px-2 py-0.5 text-[10px] font-medium ${
                              cashflowViewMode === "dashboard" ? "bg-stone-100 text-stone-700" : "text-stone-500"
                            }`}
                          >
                            Dashboard
                          </button>
                        </div>
                        {canViewQuotationActions ? (
                        <button
                          type="button"
                          onClick={openCashflowConfig}
                          className="inline-flex h-7 items-center gap-1 rounded border border-stone-200 bg-white px-2 text-[10px] text-stone-600 hover:bg-stone-100"
                        >
                          <FieldLabelIcon icon="settings2" label="" className="[&>span:last-child]:hidden" />
                          Configuración del proyecto
                        </button>
                        ) : null}
                        <div className="ml-auto flex flex-wrap items-center gap-2 rounded border border-stone-200 bg-stone-50 px-2 py-1.5 text-[10px] text-stone-500">
                          <span className="font-medium text-stone-600">
                            Periodo: {filteredMonthlyCashflow.months[0]?.label ?? "-"} a {filteredMonthlyCashflow.months.at(-1)?.label ?? "-"}
                          </span>
                          <span className="rounded-full border border-stone-200 bg-white px-2 py-0.5">
                          Tipos visibles: {filteredMonthlyCashflow.rows.length}
                          </span>
                          <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-sky-700">
                          Base: {draft.moneda_cotizacion} {formatCurrencyNumber(filteredMonthlyCashflow.totals.totalBase)}
                          </span>
                          <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-amber-700">
                          Oferta: {draft.moneda_cotizacion} {formatCurrencyNumber(filteredMonthlyCashflow.totals.totalOferta)}
                          </span>
                          <span
                            className={`rounded-full border px-2 py-0.5 ${
                              filteredMonthlyCashflow.totals.totalReal > filteredMonthlyCashflow.totals.totalOferta &&
                              filteredMonthlyCashflow.totals.totalOferta > 0
                                ? "border-rose-200 bg-rose-50 text-rose-700"
                                : filteredMonthlyCashflow.totals.totalBase > 0 &&
                                    filteredMonthlyCashflow.totals.totalReal >= filteredMonthlyCashflow.totals.totalBase
                                  ? "border-amber-200 bg-amber-50 text-amber-700"
                                  : "border-emerald-200 bg-emerald-50 text-emerald-700"
                            }`}
                          >
                          Real: {draft.moneda_cotizacion} {formatCurrencyNumber(filteredMonthlyCashflow.totals.totalReal)}
                          </span>
                        </div>
                      </div>
                      {cashflowViewMode === "summary" ? (
                        <QuotationMonthlyCashflowView
                          data={filteredMonthlyCashflow}
                          currency={draft.moneda_cotizacion}
                          activeMonthKey={selectedCashflowMonth}
                          onMonthDoubleClick={handleActivateCashflowMonth}
                        />
                      ) : (
                        <QuotationCashflowDashboardView
                          data={filteredMonthlyCashflow}
                          currency={draft.moneda_cotizacion}
                          requirements={filteredCashflowRequirements}
                          items={filteredCashflowItems}
                        />
                      )}
                    </div>
                  )}
                </div>
              </div>
              ) : (
                <div className="flex min-h-0 flex-1 items-center justify-center rounded border border-border bg-white px-3 py-8 text-[11px] text-stone-500">
                  Resumen económico oculto por permisos.
                </div>
              )}
            </div>

            <div className="flex max-h-[60vh] w-full flex-col overflow-hidden xl:max-h-none xl:h-[var(--quotation-left-height)] xl:min-h-0 xl:w-[520px] xl:min-w-[520px]">
              <div className="flex min-h-6 items-center justify-between gap-2">
                <FieldLabelIcon
                  icon="clipboard-list"
                  label={summaryViewMode === "economic" ? "Requerimientos asociados" : "Detalle mensual"}
                  className="text-[11px] font-medium"
                />
                {summaryViewMode === "economic" ? (
                  economicTypeDrill ? (
                    <div className="flex items-center gap-1.5">
                      <div className="rounded border border-stone-200 bg-stone-50 px-2 py-1 text-[10px] text-stone-600">
                        {economicTypeDrill}
                      </div>
                      <button type="button" onClick={handleClearEconomicTypeDrill} className={actionButtonClassName()}>
                        Cerrar análisis
                      </button>
                    </div>
                  ) : (
                    canViewQuotationRelatedRequirements && canViewQuotationActions ? (
                    <div className="flex items-center gap-1.5">
                      <button type="button" onClick={handleCreateRequirement} className={actionButtonClassName()}>
                        <span className="text-sm leading-none">+</span>
                        <span>Nuevo RQ</span>
                      </button>
                    </div>
                    ) : null
                  )
                ) : (
                  <div className="rounded border border-stone-200 bg-stone-50 px-2 py-1 text-[10px] text-stone-500">
                    Semanas e ítems del gasto real
                  </div>
                )}
              </div>
              {summaryViewMode === "economic" && requirementCreationError ? (
                <p className="mb-1 whitespace-pre-line rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] text-amber-700">
                  {requirementCreationError}
                </p>
              ) : null}
              {!canViewQuotationRelatedRequirements ? (
                <div className="mt-1 flex min-h-0 flex-1 items-center justify-center rounded border border-border bg-white px-3 py-8 text-center text-[11px] text-stone-500">
                  Requerimientos asociados ocultos por permisos.
                </div>
              ) : summaryViewMode === "economic" ? (
              <div className="mt-1 flex min-h-0 flex-1 flex-col rounded border border-border bg-white px-2 pt-2 pb-0">
                {economicTypeDrill ? (
                  <>
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <div className="text-[11px] font-semibold text-stone-700">
                        Análisis resumido de {economicTypeDrill}
                      </div>
                      <div className="inline-flex rounded-md border border-stone-200 bg-white p-[2px]">
                        <button
                          type="button"
                          onClick={() => setEconomicRightPanelView("requirements")}
                          className={`rounded px-2 py-0.5 text-[10px] font-medium ${
                            economicRightPanelView === "requirements" ? "bg-stone-100 text-stone-700" : "text-stone-500"
                          }`}
                        >
                          Requerimientos
                        </button>
                        <button
                          type="button"
                          onClick={() => setEconomicRightPanelView("resources")}
                          className={`rounded px-2 py-0.5 text-[10px] font-medium ${
                            economicRightPanelView === "resources" ? "bg-stone-100 text-stone-700" : "text-stone-500"
                          }`}
                        >
                          Recursos
                        </button>
                      </div>
                    </div>
                    {economicRightPanelView === "requirements" ? (
                      <div className="app-table-scroll min-h-0 flex-1 overflow-auto border-t border-stone-200">
                        <table className="w-full table-fixed border-collapse text-[11px] [&_td]:border-r [&_td]:border-stone-200/60 [&_td:last-child]:border-r-0 [&_th]:border-r [&_th]:border-stone-200/70 [&_th:last-child]:border-r-0">
                          <colgroup>
                            <col style={{ width: "170px" }} />
                            <col style={{ width: "80px" }} />
                            <col style={{ width: "92px" }} />
                            <col style={{ width: "64px" }} />
                          </colgroup>
                          <thead className="sticky top-0 z-10 bg-stone-50 text-muted">
                            <tr>
                              <th className="h-[26px] px-2 py-0 text-left font-semibold">Código RQ</th>
                              <th className="h-[26px] px-2 py-0 text-left font-semibold">Fecha</th>
                              <th className="h-[26px] px-2 py-0 text-right font-semibold">
                                {canShowEconomicValues ? "Costo tipo" : ""}
                              </th>
                              <th className="h-[26px] px-2 py-0 text-right font-semibold">Ítems</th>
                            </tr>
                          </thead>
                          <tbody>
                            {economicTypeRequirementRows.map((rq) => (
                              <tr key={`type-rq-${rq.id}`} className="h-[26px] border-t border-border">
                                <td className="h-[26px] px-2 py-0 whitespace-nowrap">
                                  <button
                                    type="button"
                                    onClick={() => onOpenRequirement?.(rq.id)}
                                    className="cursor-pointer rounded-sm text-left text-[11px] text-sky-700 underline-offset-2 hover:underline hover:text-sky-800"
                                    title={`Abrir detalle de ${rq.codigo}`}
                                  >
                                    {rq.codigo}
                                  </button>
                                </td>
                                <td className="h-[26px] px-2 py-0 whitespace-nowrap">{formatDate(rq.fecha_solicitud) || "-"}</td>
                                <td className="h-[26px] px-2 py-0 text-right">
                                  {canShowEconomicValues ? `${draft.moneda_cotizacion} ${formatCurrencyNumber(rq.typeCost)}` : ""}
                                </td>
                                <td className="h-[26px] px-2 py-0 text-right">{rq.itemCount}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="app-table-scroll min-h-0 flex-1 overflow-auto border-t border-stone-200">
                        <table className="w-full min-w-0 table-fixed border-collapse text-[11px] [&_td]:border-r [&_td]:border-stone-200/60 [&_td:last-child]:border-r-0 [&_th]:border-r [&_th]:border-stone-200/70 [&_th:last-child]:border-r-0">
                          <colgroup>
                            <col style={{ width: "110px" }} />
                            <col style={{ width: "170px" }} />
                            <col style={{ width: "160px" }} />
                            <col style={{ width: "54px" }} />
                            <col style={{ width: "82px" }} />
                          </colgroup>
                          <thead className="sticky top-0 z-10 bg-stone-50 text-muted">
                            <tr>
                              <th className="h-[26px] px-2 py-0 text-left font-semibold">Tipo</th>
                              <th className="h-[26px] px-2 py-0 text-left font-semibold">Descripción</th>
                              <th className="h-[26px] px-2 py-0 text-left font-semibold">RQ</th>
                              <th className="h-[26px] px-2 py-0 text-right font-semibold">Cant.</th>
                              <th className="h-[26px] px-2 py-0 text-right font-semibold">{canShowEconomicValues ? "Costo" : ""}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {economicTypeResourceRows.map((item) => (
                              <tr
                                key={`type-resource-${item.id}`}
                                className={`h-[26px] border-t ${item.destacado ? "border-stone-300 bg-amber-50/40" : "border-border"}`}
                              >
                                <td className="h-[26px] px-2 py-0">
                                  <span className="block truncate" title={item.tipo_recurso}>
                                    {item.tipo_recurso}
                                  </span>
                                </td>
                                <td className="h-[26px] px-2 py-0">
                                  <span className="block truncate" title={item.descripcion}>
                                    {item.descripcion}
                                  </span>
                                </td>
                                <td className="h-[26px] px-2 py-0 whitespace-nowrap">
                                  <span className="block truncate" title={item.codigo_rq}>
                                    {item.codigo_rq}
                                  </span>
                                </td>
                                <td className="h-[26px] px-2 py-0 text-right whitespace-nowrap">{item.cantidad.toFixed(2)}</td>
                                <td className="h-[26px] px-2 py-0 text-right">
                                  {canShowEconomicValues ? (
                                    <span className="block truncate whitespace-nowrap" title={`${draft.moneda_cotizacion} ${formatCurrencyNumber(item.costo)}`}>
                                      {draft.moneda_cotizacion} {formatCurrencyNumber(item.costo)}
                                    </span>
                                  ) : (
                                    <span className="block truncate whitespace-nowrap" title="" />
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="w-full" style={{ paddingRight: rqScrollbarWidth > 0 ? `${rqScrollbarWidth}px` : undefined }}>
                      <table className="w-full table-fixed border-collapse text-[11px] [&_td]:border-r [&_td]:border-stone-200/60 [&_td:last-child]:border-r-0 [&_th]:border-r [&_th]:border-stone-200/70 [&_th:last-child]:border-r-0">
                        <colgroup>
                          {rqColWidths.map((width, index) => (
                            <col key={`rq-head-col-${index}`} style={{ width: `${width}px` }} />
                          ))}
                        </colgroup>
                        <thead className="bg-stone-50 text-muted">
                          <tr>
                            {[
                              { label: "Código RQ", align: "text-left" },
                              { label: "Fecha", align: "text-left" },
                              { label: canShowEconomicValues ? "Costo" : "", align: "text-right" },
                              { label: "% Avance", align: "text-right" },
                              { label: "X", align: "text-center" },
                            ].map((header, index) => (
                              <th
                                key={header.label}
                                className={`relative h-[26px] border-t border-border ${
                                  header.label === "X" ? "px-1" : "px-2"
                                } py-0 ${header.align} font-semibold`}
                              >
                                {header.label}
                                {index < rqColWidths.length - 1 ? (
                                  <button
                                    type="button"
                                    onMouseDown={(event) => startColumnResize("rq", index, event)}
                                    className="absolute right-[-2px] top-0 h-full w-1 cursor-col-resize bg-transparent hover:bg-stone-300/60"
                                    aria-label={`Ajustar ancho de ${header.label}`}
                                    title={`Ajustar ancho de ${header.label}`}
                                  />
                                ) : null}
                              </th>
                            ))}
                          </tr>
                        </thead>
                      </table>
                    </div>
                    <div ref={rqBodyScrollRef} className="app-table-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
                      <table className="w-full table-fixed border-collapse text-[11px] [&_td]:border-r [&_td]:border-stone-200/60 [&_td:last-child]:border-r-0">
                        <colgroup>
                          {rqColWidths.map((width, index) => (
                            <col key={`rq-body-col-${index}`} style={{ width: `${width}px` }} />
                          ))}
                        </colgroup>
                        <tbody>
                          {relatedRequirements.map((rq) => {
                            const isDeletableNewCode = isDeletableNewRequirementCode(rq.codigo);
                            const canDeleteThisRequirement = canDeleteAssociatedRequirements && isDeletableNewCode;
                            const deleteTitle = !canDeleteAssociatedRequirements
                              ? "No tienes permiso para eliminar RQ."
                              : isDeletableNewCode
                                ? `Eliminar ${rq.codigo}`
                                : "RQ histórico conservado. No se elimina desde esta vista.";
                            return (
                            <tr key={rq.id} className="h-[26px] border-t border-border">
                              <td className="h-[26px] px-2 py-0 whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() => onOpenRequirement?.(rq.id)}
                                  className="cursor-pointer rounded-sm text-left text-[11px] text-sky-700 underline-offset-2 hover:underline hover:text-sky-800"
                                  title={`Abrir detalle de ${rq.codigo}`}
                                >
                                  {rq.codigo}
                                </button>
                              </td>
                              <td className="h-[26px] px-2 py-0 whitespace-nowrap">{formatDate(rq.fecha_solicitud) || "-"}</td>
                              <td className="h-[26px] px-2 py-0 text-right">
                                {canShowEconomicValues ? `${draft.moneda_cotizacion} ${formatCurrencyNumber(rq.totalRq)}` : ""}
                              </td>
                              <td className="h-[26px] px-2 py-0 text-right">{rq.avance}%</td>
                              <td className="h-[26px] px-1 py-0 text-center">
                                {canViewQuotationActions ? (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteRequirement(rq.id, rq.codigo)}
                                  disabled={!canDeleteThisRequirement}
                                  className="inline-flex h-5 w-5 items-center justify-center rounded border border-stone-200 text-[11px] text-stone-500 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:border-stone-200 disabled:hover:bg-transparent disabled:hover:text-stone-500"
                                  title={deleteTitle}
                                  aria-label={deleteTitle}
                                >
                                  X
                                </button>
                                ) : null}
                              </td>
                            </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <div className="w-full" style={{ paddingRight: rqScrollbarWidth > 0 ? `${rqScrollbarWidth}px` : undefined }}>
                      <table className="w-full table-fixed border-collapse text-[11px] [&_td]:border-r [&_td]:border-stone-200/60 [&_td:last-child]:border-r-0">
                        <colgroup>
                          {rqColWidths.map((width, index) => (
                            <col key={`rq-foot-col-${index}`} style={{ width: `${width}px` }} />
                          ))}
                        </colgroup>
                        <tbody>
                          <tr className="h-[26px] border-t border-stone-300 bg-stone-50 font-semibold">
                            <td className="h-[26px] px-2 py-0" colSpan={2}>
                              Total RQ
                            </td>
                            <td className="h-[26px] px-2 py-0 text-right">
                              {canShowEconomicValues ? `${draft.moneda_cotizacion} ${formatCurrencyNumber(relatedRequirementsTotal)}` : ""}
                            </td>
                            <td className="h-[26px] px-2 py-0 text-right">{relatedRequirementsAverageAdvance}%</td>
                            <td className="h-[26px] px-1 py-0" />
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
              ) : canViewQuotationEconomicSummary ? (
                <QuotationCashflowDrilldownPanel
                  currency={draft.moneda_cotizacion}
                  selectedMonthLabel={filteredMonthlyCashflowWeekly?.monthLabel ?? null}
                  weeklyData={filteredMonthlyCashflowWeekly}
                  selection={selectedCashflowDrill}
                  onOpenRequirement={canViewQuotationRelatedRequirements ? onOpenRequirement : undefined}
                  onClearMonth={handleClearCashflowMonth}
                  onSelectDrill={handleSelectCashflowDrill}
                  onClearDrill={handleClearCashflowDrill}
                />
              ) : (
                <div className="mt-1 flex min-h-0 flex-1 items-center justify-center rounded border border-border bg-white px-3 py-8 text-center text-[11px] text-stone-500">
                  Resumen económico oculto por permisos.
                </div>
              )}
            </div>
          </section>
        </div>
        {cashflowConfigOpen ? (
          <div className="absolute inset-0 z-[85] flex items-center justify-center bg-black/20 p-3">
            <div className="w-full max-w-[430px] rounded-lg border border-stone-300 bg-panel p-3 shadow-md">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[12px] font-medium text-stone-700">Configuración del proyecto</p>
                <button type="button" onClick={() => setCashflowConfigOpen(false)} className={actionButtonClassName(true)} title="Cerrar" aria-label="Cerrar">
                  <ModalActionIcon name="close" />
                </button>
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-stone-500">
                Define el inicio y fin del análisis. También puedes indicar la cantidad de meses para calcular automáticamente el fin del proyecto.
              </p>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-stone-500">Inicio del análisis</span>
                  <input
                    type="date"
                    value={cashflowConfigDraft.start}
                    onChange={(event) => {
                      const nextStart = normalizeDateForStorage(event.target.value);
                      setCashflowConfigDraft((prev) => {
                        const nextMonths = Number.parseInt(prev.months, 10);
                        const nextEnd =
                          nextStart && Number.isFinite(nextMonths) && nextMonths > 0
                            ? addMonthsToIsoDate(nextStart, nextMonths - 1)
                            : prev.end;
                        return { ...prev, start: nextStart, end: nextEnd };
                      });
                    }}
                    className="h-8 rounded border border-stone-200 bg-white px-2 text-[11px] text-stone-700 outline-none"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-stone-500">Fin del análisis</span>
                  <input
                    type="date"
                    value={cashflowConfigDraft.end}
                    onChange={(event) => {
                      const nextEnd = normalizeDateForStorage(event.target.value);
                      setCashflowConfigDraft((prev) => ({
                        ...prev,
                        end: nextEnd,
                        months:
                          prev.start && nextEnd && nextEnd >= prev.start ? String(countInclusiveMonths(prev.start, nextEnd)) : prev.months,
                      }));
                    }}
                    className="h-8 rounded border border-stone-200 bg-white px-2 text-[11px] text-stone-700 outline-none"
                  />
                </label>
                <label className="flex flex-col gap-1 sm:col-span-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-stone-500">Cantidad de meses</span>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={cashflowConfigDraft.months}
                    onChange={(event) => {
                      const nextMonths = event.target.value.replace(/[^\d]/g, "");
                      setCashflowConfigDraft((prev) => {
                        const parsed = Number.parseInt(nextMonths, 10);
                        const nextEnd =
                          prev.start && Number.isFinite(parsed) && parsed > 0
                            ? addMonthsToIsoDate(prev.start, parsed - 1)
                            : prev.end;
                        return { ...prev, months: nextMonths, end: nextEnd };
                      });
                    }}
                    placeholder="Ejemplo: 12"
                    className="h-8 rounded border border-stone-200 bg-white px-2 text-[11px] text-stone-700 outline-none"
                  />
                </label>
              </div>
              <div className="mt-4 flex items-center justify-end gap-2">
                <button type="button" onClick={() => setCashflowConfigOpen(false)} className={actionButtonClassName()}>
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={applyCashflowConfig}
                  className={`${actionButtonClassName()} border-stone-300 bg-stone-100 text-stone-700 hover:bg-stone-200`}
                >
                  Aplicar
                </button>
              </div>
            </div>
          </div>
        ) : null}
        {pendingConfirm ? (
          <div className="absolute inset-0 z-[90] flex items-center justify-center bg-black/25 p-3">
            <div className="w-full max-w-[420px] rounded-lg border border-stone-300 bg-panel p-3 shadow-md">
              <p className="text-[12px] font-medium text-stone-700">{pendingConfirm.message}</p>
              <div className="mt-3 flex items-center justify-end gap-2">
                <button type="button" onClick={closePendingConfirm} className={actionButtonClassName()}>
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={acceptPendingConfirm}
                  className={`${actionButtonClassName()} border-stone-300 bg-stone-100 text-stone-700 hover:bg-stone-200`}
                >
                  {pendingConfirm.acceptLabel ?? "Aceptar"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
        {technicalProposalOpen ? (
          <TechnicalProposalWorkspaceModal
            open={technicalProposalOpen}
            cotizacion={draft}
            recursos={recursos}
            onClose={() => setTechnicalProposalOpen(false)}
          />
        ) : null}
      </div>
    </div>
  );
}


