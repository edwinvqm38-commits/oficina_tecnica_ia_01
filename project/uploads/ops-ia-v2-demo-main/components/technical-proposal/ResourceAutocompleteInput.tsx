"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Recurso } from "@/lib/demoData";
import { formatCurrencyNumber } from "@/lib/utils";

type ResourceAutocompleteInputProps = {
  value: string;
  resources: Recurso[];
  placeholder?: string;
  className?: string;
  usedResourceLookup?: Map<string, { count: number; activityNumbers: string[] }>;
  onTextChange: (value: string) => void;
  onSelect: (resource: Recurso) => void;
  onActiveResource?: (resource: Recurso | null) => void;
  onCancel?: () => void;
};

function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function resourceMatches(resource: Recurso, query: string): boolean {
  const haystack = [
    resource.codigo_recurso,
    resource.codigo_fabricante,
    resource.descripcion,
    resource.tipo_recurso,
    resource.proveedor,
    resource.marca,
  ]
    .map(normalizeSearch)
    .join(" ");
  return haystack.includes(query);
}

export function ResourceAutocompleteInput({
  value,
  resources,
  placeholder = "Buscar o escribir recurso",
  className,
  usedResourceLookup,
  onTextChange,
  onSelect,
  onActiveResource,
  onCancel,
}: ResourceAutocompleteInputProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [dropdownRect, setDropdownRect] = useState<{ left: number; top: number; width: number } | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const query = useMemo(() => normalizeSearch(value), [value]);
  const suggestions = useMemo(() => {
    if (!query || query.length < 2) return [];
    return resources.filter((resource) => resourceMatches(resource, query)).slice(0, 10);
  }, [query, resources]);

  useEffect(() => {
    window.requestAnimationFrame(() => {
      const input = inputRef.current;
      if (!input) return;
      input.focus();
      input.select();
      const rect = input.getBoundingClientRect();
      setDropdownRect({ left: rect.left, top: rect.bottom + 4, width: rect.width });
      setOpen(true);
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    setActiveIndex(0);
    optionRefs.current = [];
  }, [open, query]);

  useEffect(() => {
    if (!open || suggestions.length === 0) {
      onActiveResource?.(null);
      return;
    }
    const safeIndex = Math.min(activeIndex, suggestions.length - 1);
    onActiveResource?.(suggestions[safeIndex] ?? null);
    optionRefs.current[safeIndex]?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, onActiveResource, open, suggestions]);

  function closeSoon() {
    blurTimerRef.current = setTimeout(() => {
      setOpen(false);
      onCancel?.();
    }, 120);
  }

  function cancelClose() {
    if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
  }

  function selectResource(resource: Recurso) {
    onSelect(resource);
    onActiveResource?.(resource);
    setOpen(false);
    window.requestAnimationFrame(() => inputRef.current?.focus());
  }

  function updateDropdownRect() {
    const input = inputRef.current;
    if (!input) return;
    const rect = input.getBoundingClientRect();
    setDropdownRect({
      left: rect.left,
      top: rect.bottom + 4,
      width: rect.width,
    });
  }

  useEffect(() => {
    if (!open) return;
    updateDropdownRect();

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node | null;
      if (target && rootRef.current?.contains(target)) return;
      if (target && dropdownRef.current?.contains(target)) return;
      setOpen(false);
      onCancel?.();
    }

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    window.addEventListener("resize", updateDropdownRect);
    window.addEventListener("scroll", updateDropdownRect, true);
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("resize", updateDropdownRect);
      window.removeEventListener("scroll", updateDropdownRect, true);
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onCancel, open]);

  return (
    <div ref={rootRef} className="relative">
      <input
        ref={inputRef}
        value={value}
        placeholder={placeholder}
        onChange={(event) => {
          onTextChange(event.target.value);
          setOpen(true);
          window.requestAnimationFrame(updateDropdownRect);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
            setActiveIndex((prev) => (suggestions.length ? (prev + 1) % suggestions.length : 0));
            window.requestAnimationFrame(updateDropdownRect);
            return;
          }
          if (event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
            setActiveIndex((prev) => (suggestions.length ? (prev - 1 + suggestions.length) % suggestions.length : 0));
            window.requestAnimationFrame(updateDropdownRect);
            return;
          }
          if (event.key === "Enter" && open && suggestions[activeIndex]) {
            event.preventDefault();
            selectResource(suggestions[activeIndex]);
            return;
          }
          if (event.key === "Escape") {
            event.preventDefault();
            setOpen(false);
            onCancel?.();
          }
        }}
        onFocus={() => {
          setOpen(true);
          window.requestAnimationFrame(updateDropdownRect);
        }}
        onBlur={closeSoon}
        className={className}
      />
      {open && query.length >= 2 && dropdownRect && typeof document !== "undefined" ? createPortal(
        <div
          ref={dropdownRef}
          onMouseDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
            cancelClose();
          }}
          className="fixed z-[9999] max-h-64 overflow-y-auto rounded-lg border border-stone-200 bg-white p-1 shadow-xl"
          style={{ left: dropdownRect.left, top: dropdownRect.top, width: dropdownRect.width }}
        >
          {suggestions.length === 0 ? (
            <div className="px-2 py-2 text-[11px] font-semibold text-stone-400">Sin recursos encontrados</div>
          ) : suggestions.map((resource, index) => (
            (() => {
              const usage = usedResourceLookup?.get(resource.id);
              const active = index === activeIndex;
              return (
            <button
              key={resource.id}
              ref={(node) => {
                optionRefs.current[index] = node;
              }}
              type="button"
              onMouseEnter={() => {
                setActiveIndex(index);
                onActiveResource?.(resource);
              }}
              onMouseDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
                selectResource(resource);
              }}
              className={`block w-full rounded-md px-2 py-1.5 text-left text-[11px] ${
                active ? "bg-teal-50 shadow-[inset_3px_0_0_#0f766e]" : "hover:bg-teal-50"
              } ${
                usage ? "border border-amber-200 bg-amber-50/70" : ""
              }`}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="truncate font-bold text-stone-800">{resource.codigo_recurso}</span>
                <span className="flex shrink-0 items-center gap-1">
                  {usage ? (
                    <span className="rounded-full border border-amber-300 bg-white px-2 py-0.5 text-[10px] font-bold text-amber-700">
                      Ya usado
                    </span>
                  ) : null}
                  <span className="rounded-full border border-stone-200 bg-stone-50 px-2 py-0.5 text-[10px] text-stone-500">
                    {resource.tipo_recurso || "Sin tipo"}
                  </span>
                </span>
              </span>
              <span className="block truncate text-stone-700">{resource.descripcion}</span>
              <span className="block truncate text-[10px] text-stone-400">
                {resource.unidad || "-"} · {resource.moneda} {formatCurrencyNumber(resource.precio_unitario_ref)} · {resource.marca || "-"} /{" "}
                {resource.proveedor || "-"}
              </span>
              {usage ? (
                <span className="block truncate text-[10px] font-semibold text-amber-700">
                  Usado en {usage.activityNumbers.join(", ")}
                </span>
              ) : null}
            </button>
              );
            })()
          ))}
        </div>,
        document.body,
      ) : null}
    </div>
  );
}
