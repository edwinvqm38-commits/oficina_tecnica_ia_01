export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

type DateParts = {
  year: number;
  month: number;
  day: number;
};

function parseFlexibleDate(value: string): DateParts | null {
  const raw = value.trim();
  if (!raw) return null;

  let match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
  }

  match = raw.match(/^(\d{4})\/(\d{2})\/(\d{2})$/);
  if (match) {
    return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
  }

  match = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (match) {
    return { year: Number(match[3]), month: Number(match[2]), day: Number(match[1]) };
  }

  return null;
}

function isValidDateParts(parts: DateParts): boolean {
  const date = new Date(parts.year, parts.month - 1, parts.day);
  return (
    date.getFullYear() === parts.year &&
    date.getMonth() === parts.month - 1 &&
    date.getDate() === parts.day
  );
}

function toIsoDate(parts: DateParts): string {
  return `${String(parts.year).padStart(4, "0")}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

export function normalizeDateForStorage(value: string): string {
  const parts = parseFlexibleDate(value);
  if (!parts || !isValidDateParts(parts)) return "";
  return toIsoDate(parts);
}

export function toDateInputValue(value: string): string {
  return normalizeDateForStorage(value);
}

export function formatDate(value: string): string {
  const iso = normalizeDateForStorage(value);
  if (!iso) return "";
  const [, month, day] = iso.split("-");
  const year = iso.slice(0, 4);
  return `${day}/${month}/${year}`;
}

export function formatCurrencyNumber(value: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}
