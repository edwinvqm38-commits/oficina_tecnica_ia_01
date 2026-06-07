"use client";

type IconName =
  | "file-text"
  | "clipboard-list"
  | "building"
  | "map-pin"
  | "user"
  | "circle-dot"
  | "calendar"
  | "calendar-days"
  | "tags"
  | "layout-grid"
  | "pie-chart"
  | "barcode"
  | "align-left"
  | "ruler"
  | "hash"
  | "dollar"
  | "coins"
  | "calculator"
  | "store"
  | "file-up"
  | "receipt"
  | "clock"
  | "check-circle"
  | "calendar-check"
  | "truck"
  | "paperclip"
  | "sliders-horizontal"
  | "clipboard-check"
  | "shopping-cart"
  | "badge-dollar-sign"
  | "percent"
  | "list-checks"
  | "shield-check"
  | "settings2"
  | "image"
  | "files"
  | "archive"
  | "table"
  | "file-type"
  | "file-cog"
  | "hard-hat"
  | "users"
  | "shield"
  | "heart-pulse"
  | "graduation-cap"
  | "book-open"
  | "book-marked"
  | "shirt"
  | "file-search"
  | "package"
  | "package-open"
  | "wrench"
  | "cog"
  | "bus"
  | "handshake"
  | "wallet";

type FieldLabelIconProps = {
  icon: IconName;
  label: string;
  className?: string;
};

function iconBaseClassName(): string {
  return "h-[14px] w-[14px] text-stone-400";
}

function IconGlyph({ icon }: { icon: IconName }) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  if (icon === "file-text" || icon === "clipboard-list" || icon === "receipt") {
    return (
      <svg viewBox="0 0 24 24" className={iconBaseClassName()} aria-hidden>
        <path {...common} d="M7 3h8l4 4v14H7z" />
        <path {...common} d="M15 3v5h5" />
        <path {...common} d="M10 12h6M10 16h6" />
      </svg>
    );
  }
  if (icon === "building") {
    return (
      <svg viewBox="0 0 24 24" className={iconBaseClassName()} aria-hidden>
        <path {...common} d="M4 21V6l8-3 8 3v15" />
        <path {...common} d="M9 10h1M14 10h1M9 14h1M14 14h1M11 21v-3h2v3" />
      </svg>
    );
  }
  if (icon === "map-pin") {
    return (
      <svg viewBox="0 0 24 24" className={iconBaseClassName()} aria-hidden>
        <path {...common} d="M12 21s7-5.1 7-11a7 7 0 1 0-14 0c0 5.9 7 11 7 11z" />
        <circle {...common} cx="12" cy="10" r="2.4" />
      </svg>
    );
  }
  if (icon === "user") {
    return (
      <svg viewBox="0 0 24 24" className={iconBaseClassName()} aria-hidden>
        <circle {...common} cx="12" cy="8" r="3.2" />
        <path {...common} d="M5 20a7 7 0 0 1 14 0" />
      </svg>
    );
  }
  if (icon === "circle-dot") {
    return (
      <svg viewBox="0 0 24 24" className={iconBaseClassName()} aria-hidden>
        <circle {...common} cx="12" cy="12" r="7.5" />
        <circle cx="12" cy="12" r="2.1" fill="currentColor" />
      </svg>
    );
  }
  if (icon === "calendar" || icon === "calendar-days" || icon === "calendar-check") {
    return (
      <svg viewBox="0 0 24 24" className={iconBaseClassName()} aria-hidden>
        <path {...common} d="M4 7h16v13H4zM8 3v4M16 3v4M4 11h16" />
        {icon === "calendar-check" ? <path {...common} d="m9.5 16 1.6 1.7 3.5-3.7" /> : null}
      </svg>
    );
  }
  if (icon === "tags") {
    return (
      <svg viewBox="0 0 24 24" className={iconBaseClassName()} aria-hidden>
        <path {...common} d="m3 12 9-9h7l2 2v7l-9 9L3 12z" />
        <circle {...common} cx="16" cy="8" r="1.2" />
      </svg>
    );
  }
  if (icon === "layout-grid") {
    return (
      <svg viewBox="0 0 24 24" className={iconBaseClassName()} aria-hidden>
        <rect {...common} x="4" y="4" width="7" height="7" />
        <rect {...common} x="13" y="4" width="7" height="7" />
        <rect {...common} x="4" y="13" width="7" height="7" />
        <rect {...common} x="13" y="13" width="7" height="7" />
      </svg>
    );
  }
  if (icon === "pie-chart") {
    return (
      <svg viewBox="0 0 24 24" className={iconBaseClassName()} aria-hidden>
        <path {...common} d="M12 3v9h9A9 9 0 1 1 12 3z" />
        <path {...common} d="M12 3a9 9 0 0 1 9 9" />
      </svg>
    );
  }
  if (icon === "barcode") {
    return (
      <svg viewBox="0 0 24 24" className={iconBaseClassName()} aria-hidden>
        <path {...common} d="M5 5v14M8 5v14M12 5v14M15 5v14M19 5v14" />
      </svg>
    );
  }
  if (icon === "align-left") {
    return (
      <svg viewBox="0 0 24 24" className={iconBaseClassName()} aria-hidden>
        <path {...common} d="M5 7h14M5 11h10M5 15h14M5 19h8" />
      </svg>
    );
  }
  if (icon === "ruler") {
    return (
      <svg viewBox="0 0 24 24" className={iconBaseClassName()} aria-hidden>
        <path {...common} d="m4 16 8-8 8 8-8 8-8-8z" transform="translate(0 -4)" />
        <path {...common} d="M9 11h1M11 13h1M13 15h1M15 17h1" />
      </svg>
    );
  }
  if (icon === "hash") {
    return (
      <svg viewBox="0 0 24 24" className={iconBaseClassName()} aria-hidden>
        <path {...common} d="M9 4 7 20M17 4l-2 16M4 9h16M3 15h16" />
      </svg>
    );
  }
  if (icon === "dollar" || icon === "coins") {
    return (
      <svg viewBox="0 0 24 24" className={iconBaseClassName()} aria-hidden>
        <circle {...common} cx="12" cy="12" r="7.5" />
        <path {...common} d="M12 8v8M9.5 10.2c.3-1 1.2-1.6 2.5-1.6 1.5 0 2.5.8 2.5 2 0 2.5-5 1.5-5 4 0 1.3 1.1 2 2.5 2 1.3 0 2.2-.6 2.5-1.6" />
      </svg>
    );
  }
  if (icon === "calculator") {
    return (
      <svg viewBox="0 0 24 24" className={iconBaseClassName()} aria-hidden>
        <rect {...common} x="6" y="3.5" width="12" height="17" rx="1.5" />
        <path {...common} d="M8.5 7.5h7M9 12h1M12 12h1M15 12h1M9 15h1M12 15h1M15 15h1" />
      </svg>
    );
  }
  if (icon === "store") {
    return (
      <svg viewBox="0 0 24 24" className={iconBaseClassName()} aria-hidden>
        <path {...common} d="M4 10h16l-1.3-5H5.3L4 10zM6 10v9h12v-9M10 19v-5h4v5" />
      </svg>
    );
  }
  if (icon === "file-up") {
    return (
      <svg viewBox="0 0 24 24" className={iconBaseClassName()} aria-hidden>
        <path {...common} d="M7 3h8l4 4v14H7z" />
        <path {...common} d="M15 3v5h5M12 17v-6m0 0-2 2m2-2 2 2" />
      </svg>
    );
  }
  if (icon === "clock") {
    return (
      <svg viewBox="0 0 24 24" className={iconBaseClassName()} aria-hidden>
        <circle {...common} cx="12" cy="12" r="8" />
        <path {...common} d="M12 8v4l3 2" />
      </svg>
    );
  }
  if (icon === "check-circle") {
    return (
      <svg viewBox="0 0 24 24" className={iconBaseClassName()} aria-hidden>
        <circle {...common} cx="12" cy="12" r="8" />
        <path {...common} d="m8.5 12.3 2.1 2.2 4.8-4.9" />
      </svg>
    );
  }
  if (icon === "truck") {
    return (
      <svg viewBox="0 0 24 24" className={iconBaseClassName()} aria-hidden>
        <path {...common} d="M3 7h11v8H3zM14 10h3l3 3v2h-6z" />
        <circle {...common} cx="8" cy="17" r="1.8" />
        <circle {...common} cx="18" cy="17" r="1.8" />
      </svg>
    );
  }
  if (icon === "paperclip") {
    return (
      <svg viewBox="0 0 24 24" className={iconBaseClassName()} aria-hidden>
        <path {...common} d="m9.5 12.5 5.7-5.7a3 3 0 1 1 4.2 4.2l-7.8 7.8a5 5 0 0 1-7.1-7.1l7.8-7.8" />
      </svg>
    );
  }
  if (icon === "sliders-horizontal") {
    return (
      <svg viewBox="0 0 24 24" className={iconBaseClassName()} aria-hidden>
        <path {...common} d="M4 7h16M4 12h16M4 17h16" />
        <circle {...common} cx="9" cy="7" r="1.7" />
        <circle {...common} cx="15" cy="12" r="1.7" />
        <circle {...common} cx="11" cy="17" r="1.7" />
      </svg>
    );
  }
  if (icon === "clipboard-check") {
    return (
      <svg viewBox="0 0 24 24" className={iconBaseClassName()} aria-hidden>
        <rect {...common} x="7" y="4" width="10" height="16" rx="1.8" />
        <path {...common} d="M10 4.5h4M9.3 13.2l1.9 1.9 3.6-3.8" />
      </svg>
    );
  }
  if (icon === "shopping-cart") {
    return (
      <svg viewBox="0 0 24 24" className={iconBaseClassName()} aria-hidden>
        <circle {...common} cx="10" cy="19" r="1.5" />
        <circle {...common} cx="17" cy="19" r="1.5" />
        <path {...common} d="M3 5h2l2 10h11l2-7H7" />
      </svg>
    );
  }
  if (icon === "badge-dollar-sign") {
    return (
      <svg viewBox="0 0 24 24" className={iconBaseClassName()} aria-hidden>
        <path {...common} d="m12 3 2.1 1.2 2.4-.3 1.2 2.1 2.1 1.2-.3 2.4 1.2 2.1-1.2 2.1.3 2.4-2.1 1.2-1.2 2.1-2.4-.3L12 21l-2.1-1.2-2.4.3-1.2-2.1-2.1-1.2.3-2.4L3 12l1.2-2.1-.3-2.4 2.1-1.2 1.2-2.1 2.4.3z" />
        <path {...common} d="M12 8v8M10.2 10.1c.2-1 1-1.5 2-1.5 1.2 0 2 .7 2 1.6 0 2-4 1.2-4 3.2 0 1.1.9 1.7 2 1.7 1 0 1.8-.5 2-1.4" />
      </svg>
    );
  }
  if (icon === "percent") {
    return (
      <svg viewBox="0 0 24 24" className={iconBaseClassName()} aria-hidden>
        <path {...common} d="m6 18 12-12" />
        <circle {...common} cx="8" cy="8" r="2.2" />
        <circle {...common} cx="16" cy="16" r="2.2" />
      </svg>
    );
  }
  if (icon === "list-checks") {
    return (
      <svg viewBox="0 0 24 24" className={iconBaseClassName()} aria-hidden>
        <path {...common} d="M9 7h10M9 12h10M9 17h10M4.5 7.2l1.2 1.2 1.8-1.8M4.5 12.2l1.2 1.2 1.8-1.8M4.5 17.2l1.2 1.2 1.8-1.8" />
      </svg>
    );
  }
  if (icon === "shield-check") {
    return (
      <svg viewBox="0 0 24 24" className={iconBaseClassName()} aria-hidden>
        <path {...common} d="m12 3 7 3v5c0 5-3.2 8.6-7 10-3.8-1.4-7-5-7-10V6z" />
        <path {...common} d="m9.4 12.3 1.8 1.9 3.5-3.7" />
      </svg>
    );
  }
  if (icon === "settings2") {
    return (
      <svg viewBox="0 0 24 24" className={iconBaseClassName()} aria-hidden>
        <path {...common} d="M4 7h8M15 7h5M4 12h5M12 12h8M4 17h10M17 17h3" />
        <circle {...common} cx="13" cy="7" r="1.6" />
        <circle {...common} cx="9" cy="12" r="1.6" />
        <circle {...common} cx="15" cy="17" r="1.6" />
      </svg>
    );
  }
  if (icon === "image") {
    return (
      <svg viewBox="0 0 24 24" className={iconBaseClassName()} aria-hidden>
        <rect {...common} x="4" y="5" width="16" height="14" rx="1.8" />
        <circle {...common} cx="10" cy="10" r="1.5" />
        <path {...common} d="m7 16 4-4 2.8 2.8 2.2-2.2L19 16" />
      </svg>
    );
  }
  if (icon === "files") {
    return (
      <svg viewBox="0 0 24 24" className={iconBaseClassName()} aria-hidden>
        <path {...common} d="M8 3h9l3 3v13H8z" />
        <path {...common} d="M8 7H5v14h11" />
      </svg>
    );
  }
  if (icon === "archive") {
    return (
      <svg viewBox="0 0 24 24" className={iconBaseClassName()} aria-hidden>
        <rect {...common} x="4" y="6" width="16" height="4" rx="1" />
        <path {...common} d="M6 10h12v9H6zM10 13h4" />
      </svg>
    );
  }
  if (icon === "table") {
    return (
      <svg viewBox="0 0 24 24" className={iconBaseClassName()} aria-hidden>
        <rect {...common} x="4" y="5" width="16" height="14" rx="1.5" />
        <path {...common} d="M4 10h16M9 5v14M15 5v14" />
      </svg>
    );
  }
  if (icon === "file-type") {
    return (
      <svg viewBox="0 0 24 24" className={iconBaseClassName()} aria-hidden>
        <path {...common} d="M7 3h8l4 4v14H7zM15 3v5h5" />
        <path {...common} d="M9.5 15h5M9.5 12h5" />
      </svg>
    );
  }
  if (icon === "file-cog") {
    return (
      <svg viewBox="0 0 24 24" className={iconBaseClassName()} aria-hidden>
        <path {...common} d="M7 3h8l4 4v14H7zM15 3v5h5" />
        <circle {...common} cx="11" cy="15" r="2" />
        <path {...common} d="M11 12.6v.8M11 16.6v.8M8.9 15h.8M12.3 15h.8" />
      </svg>
    );
  }
  if (icon === "hard-hat") {
    return (
      <svg viewBox="0 0 24 24" className={iconBaseClassName()} aria-hidden>
        <path {...common} d="M5 13a7 7 0 0 1 14 0v4H5z" />
        <path {...common} d="M12 6v3M9 13V9.5M15 13V9.5" />
      </svg>
    );
  }
  if (icon === "users") {
    return (
      <svg viewBox="0 0 24 24" className={iconBaseClassName()} aria-hidden>
        <circle {...common} cx="9" cy="9" r="2.5" />
        <circle {...common} cx="15.5" cy="9.5" r="2.1" />
        <path {...common} d="M4.5 19a5 5 0 0 1 9 0M12.5 19a4 4 0 0 1 7 0" />
      </svg>
    );
  }
  if (icon === "shield") {
    return (
      <svg viewBox="0 0 24 24" className={iconBaseClassName()} aria-hidden>
        <path {...common} d="m12 3 7 3v5c0 5-3.2 8.6-7 10-3.8-1.4-7-5-7-10V6z" />
      </svg>
    );
  }
  if (icon === "heart-pulse") {
    return (
      <svg viewBox="0 0 24 24" className={iconBaseClassName()} aria-hidden>
        <path {...common} d="M4 12h3l2-3 2.5 6 2-4H20" />
        <path {...common} d="M12 21s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 11c0 5.5-7 10-7 10z" />
      </svg>
    );
  }
  if (icon === "graduation-cap") {
    return (
      <svg viewBox="0 0 24 24" className={iconBaseClassName()} aria-hidden>
        <path {...common} d="m3 10 9-4 9 4-9 4zM7 12v4c0 1.5 2.2 2.8 5 2.8s5-1.3 5-2.8v-4" />
      </svg>
    );
  }
  if (icon === "book-open") {
    return (
      <svg viewBox="0 0 24 24" className={iconBaseClassName()} aria-hidden>
        <path {...common} d="M4 6.5c2.2-1.2 4.8-1.2 7 0V19c-2.2-1.2-4.8-1.2-7 0zM20 6.5c-2.2-1.2-4.8-1.2-7 0V19c2.2-1.2 4.8-1.2 7 0z" />
      </svg>
    );
  }
  if (icon === "book-marked") {
    return (
      <svg viewBox="0 0 24 24" className={iconBaseClassName()} aria-hidden>
        <path {...common} d="M6 4h10a2 2 0 0 1 2 2v14H6z" />
        <path {...common} d="m12 4 0 7 2-1.4 2 1.4V4" />
      </svg>
    );
  }
  if (icon === "shirt") {
    return (
      <svg viewBox="0 0 24 24" className={iconBaseClassName()} aria-hidden>
        <path {...common} d="m8 5 4 2 4-2 3 4-3 2v8H8v-8L5 9z" />
      </svg>
    );
  }
  if (icon === "file-search") {
    return (
      <svg viewBox="0 0 24 24" className={iconBaseClassName()} aria-hidden>
        <path {...common} d="M7 3h8l4 4v14H7zM15 3v5h5" />
        <circle {...common} cx="12" cy="14" r="2.2" />
        <path {...common} d="m13.8 15.8 1.6 1.6" />
      </svg>
    );
  }
  if (icon === "package") {
    return (
      <svg viewBox="0 0 24 24" className={iconBaseClassName()} aria-hidden>
        <path {...common} d="m12 3 8 4.5v9L12 21l-8-4.5v-9zM12 3v9m8-4.5-8 4.5-8-4.5" />
      </svg>
    );
  }
  if (icon === "package-open") {
    return (
      <svg viewBox="0 0 24 24" className={iconBaseClassName()} aria-hidden>
        <path {...common} d="m12 3 8 4.5-8 4.5-8-4.5zM4 10.5V17l8 4 8-4v-6.5" />
      </svg>
    );
  }
  if (icon === "wrench") {
    return (
      <svg viewBox="0 0 24 24" className={iconBaseClassName()} aria-hidden>
        <path {...common} d="m14 6 4 4-8.5 8.5a2 2 0 0 1-2.8-2.8zM13 7a4 4 0 0 1 5-5l-2 2 2 2 2-2a4 4 0 0 1-5 5" />
      </svg>
    );
  }
  if (icon === "cog") {
    return (
      <svg viewBox="0 0 24 24" className={iconBaseClassName()} aria-hidden>
        <circle {...common} cx="12" cy="12" r="2.8" />
        <path {...common} d="M12 4v2M12 18v2M4 12h2M18 12h2M6.3 6.3l1.4 1.4M16.3 16.3l1.4 1.4M17.7 6.3l-1.4 1.4M7.7 16.3l-1.4 1.4" />
      </svg>
    );
  }
  if (icon === "bus") {
    return (
      <svg viewBox="0 0 24 24" className={iconBaseClassName()} aria-hidden>
        <rect {...common} x="5" y="4" width="14" height="13" rx="2" />
        <path {...common} d="M5 10h14M7 17v3M17 17v3M8 20h0M16 20h0" />
      </svg>
    );
  }
  if (icon === "handshake") {
    return (
      <svg viewBox="0 0 24 24" className={iconBaseClassName()} aria-hidden>
        <path {...common} d="m8 12 2-2a2 2 0 0 1 3 0l3 3M4 10l3 3m13-3-3 3" />
        <path {...common} d="m8 12 2 2m-1 1 2 2m-1 1 1 1a2 2 0 0 0 2.8 0l4.2-4.2a2 2 0 0 0 0-2.8L15 10" />
      </svg>
    );
  }
  if (icon === "wallet") {
    return (
      <svg viewBox="0 0 24 24" className={iconBaseClassName()} aria-hidden>
        <rect {...common} x="3" y="6" width="18" height="12" rx="2" />
        <path {...common} d="M17 12h4M6 6V4h10v2" />
        <circle {...common} cx="16" cy="12" r="0.8" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className={iconBaseClassName()} aria-hidden>
      <circle {...common} cx="12" cy="12" r="7.5" />
    </svg>
  );
}

export function FieldLabelIcon({ icon, label, className }: FieldLabelIconProps) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] text-muted ${className ?? ""}`}>
      <IconGlyph icon={icon} />
      <span>{label}</span>
    </span>
  );
}

export type { IconName };
