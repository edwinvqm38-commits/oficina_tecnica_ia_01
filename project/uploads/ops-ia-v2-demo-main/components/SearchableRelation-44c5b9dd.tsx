"use client";

import { useMemo, useState } from "react";

type Option = {
  id: string;
  label: string;
};

type SearchableRelationProps = {
  options: Option[];
  placeholder?: string;
  onSelect: (id: string) => void;
  value?: string;
  className?: string;
  showSearchInput?: boolean;
};

export function SearchableRelation({
  options,
  placeholder = "Buscar relación...",
  onSelect,
  value,
  className,
  showSearchInput = true,
}: SearchableRelationProps) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!query.trim()) return options;
    const lower = query.toLowerCase();
    return options.filter((option) => option.label.toLowerCase().includes(lower));
  }, [options, query]);

  return (
    <div className={showSearchInput ? "space-y-2" : ""}>
      {showSearchInput ? (
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={placeholder}
          className="w-full rounded-md border border-border bg-panel px-3 py-2 text-sm outline-none focus:border-stone-400"
        />
      ) : null}
      <select
        className={`w-full rounded-md border border-border bg-panel px-3 py-2 text-sm outline-none ${className ?? ""}`}
        onChange={(event) => {
          if (event.target.value) onSelect(event.target.value);
        }}
        value={value ?? ""}
      >
        <option value="" disabled>
          Seleccionar recurso
        </option>
        {filtered.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
