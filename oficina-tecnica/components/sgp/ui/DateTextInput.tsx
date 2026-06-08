"use client";

import { useEffect, useState } from "react";
import { formatDate, normalizeDateForStorage } from "@/lib/sgp/utils";

type DateTextInputProps = {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
};

export function DateTextInput({ value, onChange, className, disabled }: DateTextInputProps) {
  const [text, setText] = useState("");

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

  return (
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
      className={className}
      disabled={disabled}
    />
  );
}
