"use client";

import { useEffect, useRef, useState } from "react";
import { formatDate, normalizeDateForStorage } from "@/lib/sgp/utils";

type DateTextInputProps = {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
};

export function DateTextInput({ value, onChange, className, disabled }: DateTextInputProps) {
  const [text, setText] = useState("");
  const pickerRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setText(formatDate(value));
  }, [value]);

  function commit(raw: string) {
    const trimmed = raw.trim();
    if (!trimmed) {
      onChange("");
      setText("");
      return;
    }
    const iso = normalizeDateForStorage(trimmed);
    if (!iso) {
      setText(formatDate(value));
      return;
    }
    onChange(iso);
    setText(formatDate(iso));
  }

  function openPicker() {
    const picker = pickerRef.current;
    if (!picker || disabled) return;
    if (typeof picker.showPicker === "function") {
      picker.showPicker();
      return;
    }
    picker.click();
  }

  return (
    <span className="relative inline-block align-middle">
      <input
        type="text"
        inputMode="numeric"
        placeholder="dd/mm/aaaa"
        value={text}
        onChange={(event) => setText(event.target.value)}
        onBlur={(event) => commit(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            commit((event.target as HTMLInputElement).value);
            (event.target as HTMLInputElement).blur();
          }
        }}
        className={`${className ?? ""} ${disabled ? "" : "pr-6"}`}
        disabled={disabled}
      />
      {!disabled ? (
        <>
          <input
            ref={pickerRef}
            type="date"
            value={normalizeDateForStorage(value) || ""}
            onChange={(event) => {
              onChange(event.target.value);
              setText(formatDate(event.target.value));
            }}
            className="pointer-events-none absolute right-0 top-0 h-full w-6 opacity-0"
            tabIndex={-1}
            aria-hidden="true"
          />
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={openPicker}
            className="absolute right-0 top-0 inline-flex h-full w-6 items-center justify-center rounded-r text-stone-400 hover:bg-stone-100 hover:text-stone-700"
            title="Seleccionar fecha"
            aria-label="Seleccionar fecha"
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" aria-hidden>
              <path
                d="M7 3v3M17 3v3M4.5 9.5h15M6 5h12a1.5 1.5 0 0 1 1.5 1.5v11A1.5 1.5 0 0 1 18 19H6a1.5 1.5 0 0 1-1.5-1.5v-11A1.5 1.5 0 0 1 6 5Z"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.7"
              />
            </svg>
          </button>
        </>
      ) : null}
    </span>
  );
}
